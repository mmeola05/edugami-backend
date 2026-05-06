const { query, transaction } = require("../config/db");
const realtime = require("../utils/realtime");
const { redactValue } = require("../observability/privacy");
const alertRules = require("./alertRules.service");

let schemaReady = false;
let legacyMirrorReady = false;

async function ensureSchema() {
  if (schemaReady) return;

  const result = await query(`
    SELECT
      to_regclass('public.audit_logs')::text AS audit_logs_table,
      to_regclass('public.audit_log_outbox')::text AS audit_log_outbox_table,
      to_regclass('public.platform_audit_events')::text AS legacy_table,
      EXISTS (
        SELECT 1
        FROM pg_partitioned_table pt
        JOIN pg_class c ON c.oid = pt.partrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'audit_logs'
      ) AS audit_logs_partitioned
  `);

  const state = result.rows[0];
  if (!state.audit_logs_table || !state.audit_log_outbox_table || !state.audit_logs_partitioned) {
    throw new Error("AUDIT_SCHEMA_NOT_READY: ejecuta npm run db:migrate antes de iniciar platform-api");
  }

  legacyMirrorReady = Boolean(state.legacy_table);
  schemaReady = true;
}

function buildDiff(before, after) {
  if (!before || !after || typeof before !== "object" || typeof after !== "object") return null;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diff = {};

  for (const key of keys) {
    const previous = before[key];
    const next = after[key];
    if (JSON.stringify(previous) === JSON.stringify(next)) continue;
    diff[key] = {
      before: redactValue(previous),
      after: redactValue(next)
    };
  }

  return Object.keys(diff).length ? diff : null;
}

function normalizeModuleKey(moduleKey, eventType = "") {
  if (moduleKey) return moduleKey;
  if (eventType.includes("module")) return "GLOBAL_MODULES";
  if (eventType.includes("role") || eventType.includes("permissions")) return "RBAC";
  if (eventType.includes("service")) return "SERVICES";
  return null;
}

function buildContext(context = {}) {
  return {
    requestId: context.requestId || null,
    correlationId: context.correlationId || null,
    ipAddress: context.ipAddress || null,
    userAgent: context.userAgent || null,
    method: context.method || null,
    routePath: context.routePath || null,
    sessionId: context.sessionId || null
  };
}

async function recordBase({
  actor,
  eventType,
  entityType,
  entityId,
  action,
  before = null,
  after = null,
  metadata = {},
  context = {},
  category = "business",
  severity = "info",
  moduleKey = null,
  outcomeStatus = "success",
  sourceService = "platform-api",
  sourceChannel = "api",
  error = null
}) {
  await ensureSchema();

  const safeBefore = before ? redactValue(before) : null;
  const safeAfter = after ? redactValue(after) : null;
  const safeMetadata = redactValue(metadata || {});
  const diff = buildDiff(safeBefore, safeAfter);
  const requestContext = buildContext(context);
  const normalizedModuleKey = normalizeModuleKey(moduleKey, eventType);

  return transaction(async (client) => {
    const actorEmail = actor?.email || null;
    const actorRole = actor?.role || null;
    const actorType = actor?.sub ? "platform_account" : "system";

    const inserted = await client.query(`
      INSERT INTO audit_logs (
        occurred_at,
        event_key,
        category,
        severity,
        module_key,
        actor_type,
        actor_platform_account_id,
        actor_scope,
        actor_role,
        actor_email,
        actor_tenant_id,
        entity_type,
        entity_id,
        action,
        outcome_status,
        http_method,
        route_path,
        ip_address,
        user_agent,
        request_id,
        correlation_id,
        session_id,
        source_service,
        source_channel,
        before_json,
        after_json,
        diff_json,
        metadata_json,
        error_json,
        created_at
      )
      VALUES (
        NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
        $17::inet, $18, $19::uuid, $20::uuid, $21, $22, $23, $24::jsonb, $25::jsonb,
        $26::jsonb, $27::jsonb, $28::jsonb, NOW()
      )
      RETURNING occurred_at, audit_log_id, event_key, module_key, actor_email, entity_type, entity_id, action, outcome_status, metadata_json, diff_json
    `, [
      eventType,
      category,
      severity,
      normalizedModuleKey,
      actorType,
      actor?.sub || null,
      actor?.scope || "platform",
      actorRole,
      actorEmail,
      actor?.tenantId || null,
      entityType,
      entityId || null,
      action,
      outcomeStatus,
      requestContext.method,
      requestContext.routePath,
      requestContext.ipAddress,
      requestContext.userAgent,
      requestContext.requestId,
      requestContext.correlationId,
      requestContext.sessionId,
      sourceService,
      sourceChannel,
      safeBefore ? JSON.stringify(safeBefore) : null,
      safeAfter ? JSON.stringify(safeAfter) : null,
      diff ? JSON.stringify(diff) : null,
      JSON.stringify(safeMetadata),
      error ? JSON.stringify(redactValue(error)) : null
    ]);

    await client.query(`
      INSERT INTO audit_log_outbox (
        topic,
        aggregate_type,
        aggregate_id,
        event_key,
        payload_json,
        status,
        available_at,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', NOW(), NOW())
    `, [
      "audit.recorded",
      entityType,
      entityId || null,
      eventType,
      JSON.stringify({
        eventKey: eventType,
        moduleKey: normalizedModuleKey,
        entityType,
        entityId: entityId || null,
        action,
        correlationId: requestContext.correlationId,
        requestId: requestContext.requestId,
        occurredAt: inserted.rows[0].occurred_at
      })
    ]);

    if (legacyMirrorReady) {
      await client.query(`
        INSERT INTO platform_audit_events (
          actor_platform_account_id,
          actor_scope,
          event_type,
          entity_type,
          entity_id,
          action,
          before_json,
          after_json,
          metadata_json,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, NOW())
      `, [
        actor?.sub || null,
        actor?.scope || "platform",
        eventType,
        entityType,
        entityId || null,
        action,
        safeBefore ? JSON.stringify(safeBefore) : null,
        safeAfter ? JSON.stringify(safeAfter) : null,
        JSON.stringify({
          ...safeMetadata,
          request_id: requestContext.requestId,
          correlation_id: requestContext.correlationId
        })
      ]);
    }

    realtime.publish("audit", {
      eventKey: eventType,
      entityType,
      entityId: entityId || null,
      action,
      moduleKey: normalizedModuleKey,
      correlationId: requestContext.correlationId,
      occurredAt: inserted.rows[0].occurred_at
    });

    return inserted.rows[0];
  });
}

async function record(input) {
  const result = await recordBase(input);
  await alertRules.handleAuditEvent(result, input);
  return result;
}

async function list(params = {}) {
  await ensureSchema();

  const limit = Math.min(Number(params.limit || 100), 250);
  const values = [];
  const where = [];

  if (params.eventType && params.eventType !== "ALL") {
    values.push(params.eventType);
    where.push(`a.event_key = $${values.length}`);
  }
  if (params.actor) {
    values.push(`%${String(params.actor).toLowerCase()}%`);
    where.push(`LOWER(COALESCE(a.actor_email, pa.email, '')) LIKE $${values.length}`);
  }
  if (params.entityType) {
    values.push(params.entityType);
    where.push(`a.entity_type = $${values.length}`);
  }
  if (params.from) {
    values.push(params.from);
    where.push(`a.occurred_at >= $${values.length}::timestamptz`);
  }
  if (params.to) {
    values.push(params.to);
    where.push(`a.occurred_at <= $${values.length}::timestamptz`);
  }

  values.push(limit);

  const result = await query(`
    SELECT
      a.audit_log_id AS audit_event_id,
      a.actor_platform_account_id,
      COALESCE(a.actor_email, pa.email) AS actor_email,
      a.actor_scope,
      a.actor_role,
      a.actor_type,
      a.event_key AS event_type,
      a.category,
      a.severity,
      a.module_key,
      a.entity_type,
      a.entity_id,
      a.action,
      a.outcome_status,
      a.http_method,
      a.route_path,
      host(a.ip_address) AS ip_address,
      a.user_agent,
      a.request_id,
      a.correlation_id,
      a.session_id,
      a.source_service,
      a.source_channel,
      a.before_json,
      a.after_json,
      a.diff_json,
      a.metadata_json,
      a.error_json,
      a.occurred_at AS created_at
    FROM audit_logs a
    LEFT JOIN platform_accounts pa ON pa.platform_account_id = a.actor_platform_account_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY a.occurred_at DESC
    LIMIT $${values.length}
  `, values);

  return result.rows;
}

module.exports = { ensureSchema, record, list };
