const { query, transaction } = require("../config/db");
const { sendEmail } = require("./email.service");
const { sendTelegram } = require("./telegram.service");
const { sendWhatsApp } = require("./whatsapp.service");
const { config } = require("../config/config");
const { alertTemplate } = require("../utils/emailTemplates.util");
const realtime = require("../realtime");

const ACTIVE_STATUSES = ["PENDIENTE", "EN_INVESTIGACION", "MITIGADO"];
const SEVERITY_ORDER = { info: 1, warning: 2, error: 3, fatal: 4 };

function normalizeStatus(status) {
  const value = String(status || "PENDIENTE").toUpperCase();
  if (value === "OPEN") return "PENDIENTE";
  if (value === "RESOLVED") return "RESUELTO";
  return value;
}

function severityRank(severity) {
  return SEVERITY_ORDER[String(severity || "warning").toLowerCase()] || 1;
}

function defaultSlaDueAt(severity) {
  const minutes =
    String(severity).toLowerCase() === "fatal"
      ? config.ALERT_SLA_FATAL_MINUTES
      : String(severity).toLowerCase() === "error"
        ? config.ALERT_SLA_ERROR_MINUTES
        : config.ALERT_SLA_WARNING_MINUTES;

  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function shouldAutoEmail(severity) {
  return severityRank(severity) >= severityRank(config.ALERT_EMAIL_MIN_SEVERITY);
}

async function rootRecipients() {
  const result = await query(`
    SELECT email
    FROM platform_accounts
    WHERE role = 'ROOT'
      AND status = 'active'
      AND email IS NOT NULL
    ORDER BY created_at ASC
  `);

  const values = new Set(
    [
      ...result.rows.map((row) => row.email).filter(Boolean),
      ...String(config.ALERT_EMAIL_TO || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    ]
  );

  return [...values];
}

async function list(filters = {}) {
  const values = [ACTIVE_STATUSES];
  const where = [];

  if (filters.status && filters.status !== "ALL") {
    const requestedStatus = String(filters.status).toUpperCase();
    if (requestedStatus === "ACTIVE" || requestedStatus === "OPEN") {
      where.push(`a.status = ANY($1::text[])`);
    } else {
      values.push(normalizeStatus(filters.status));
      where.push(`a.status = $${values.length}::text`);
    }
  }

  if (filters.severity && filters.severity !== "ALL") {
    values.push(String(filters.severity).toLowerCase());
    where.push(`LOWER(a.severity) = $${values.length}::text`);
  }

  const result = await query(`
    SELECT
      a.alert_id,
      a.rule_key,
      a.source_type,
      a.source_ref_id,
      a.dedupe_key,
      a.tenant_id,
      a.severity,
      a.status,
      a.title,
      a.message,
      a.summary_json,
      a.context_json,
      a.first_seen_at,
      a.last_seen_at,
      a.occurrences,
      a.sla_due_at,
      (a.sla_due_at IS NOT NULL AND a.sla_due_at < NOW() AND a.status = ANY($1::text[])) AS is_overdue,
      a.acknowledged_at,
      a.mitigated_at,
      a.resolved_at,
      a.closed_at,
      a.created_at,
      a.updated_at,
      pa.email AS assigned_email,
      COALESCE(notes.note_count, 0)::int AS note_count,
      COALESCE(events.event_count, 0)::int AS event_count
    FROM alerts a
    LEFT JOIN platform_accounts pa ON pa.platform_account_id = a.assigned_platform_account_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS note_count
      FROM incident_notes n
      WHERE n.alert_id = a.alert_id
    ) notes ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS event_count
      FROM alert_events e
      WHERE e.alert_id = a.alert_id
    ) events ON TRUE
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY
      CASE a.status
        WHEN 'PENDIENTE' THEN 1
        WHEN 'EN_INVESTIGACION' THEN 2
        WHEN 'MITIGADO' THEN 3
        WHEN 'RESUELTO' THEN 4
        WHEN 'CERRADO' THEN 5
        ELSE 9
      END,
      a.last_seen_at DESC
    LIMIT 200
  `, values);

  return result.rows;
}

async function getDetail(alertId) {
  const alertResult = await query(`
    SELECT a.*, pa.email AS assigned_email
    FROM alerts a
    LEFT JOIN platform_accounts pa ON pa.platform_account_id = a.assigned_platform_account_id
    WHERE a.alert_id = $1
    LIMIT 1
  `, [alertId]);

  const alert = alertResult.rows[0] || null;
  if (!alert) return null;

  const [events, notes, deliveries] = await Promise.all([
    query(`
      SELECT
        ae.alert_event_id,
        ae.event_type,
        ae.from_status,
        ae.to_status,
        ae.note_text,
        ae.payload_json,
        ae.created_at,
        pa.email AS actor_email
      FROM alert_events ae
      LEFT JOIN platform_accounts pa ON pa.platform_account_id = ae.actor_platform_account_id
      WHERE ae.alert_id = $1
      ORDER BY ae.created_at DESC
    `, [alertId]),
    query(`
      SELECT
        n.incident_note_id,
        n.note_type,
        n.body,
        n.is_internal,
        n.created_at,
        pa.email AS author_email
      FROM incident_notes n
      LEFT JOIN platform_accounts pa ON pa.platform_account_id = n.author_platform_account_id
      WHERE n.alert_id = $1
      ORDER BY n.created_at DESC
    `, [alertId]),
    query(`
      SELECT
        delivery_id AS alert_delivery_id,
        channel_type,
        target_value,
        delivery_status,
        provider_message_id,
        error_message,
        sent_at,
        created_at
      FROM platform_alert_deliveries
      WHERE alert_id = $1
      ORDER BY created_at DESC
    `, [alertId])
  ]);

  return {
    ...alert,
    events: events.rows,
    notes: notes.rows,
    deliveries: deliveries.rows
  };
}

async function recordAlertEvent(client, payload) {
  await client.query(`
    INSERT INTO alert_events (
      alert_id,
      event_type,
      from_status,
      to_status,
      actor_platform_account_id,
      note_text,
      payload_json,
      created_at
    ) VALUES ($1::bigint, $2::text, $3::text, $4::text, $5::uuid, $6::text, $7::jsonb, NOW())
  `, [
    payload.alertId,
    payload.eventType,
    payload.fromStatus || null,
    payload.toStatus || null,
    payload.actorPlatformAccountId || null,
    payload.noteText || null,
    JSON.stringify(payload.payload || {})
  ]);
}

async function deliver(alert, channels = []) {
  const deliveries = [];
  const recipients = await rootRecipients();

  for (const channel of channels) {
    let result = { delivered: false, reason: "SKIPPED" };
    const target = channel === "EMAIL" ? recipients.join(", ") : channel;

    try {
      if (channel === "EMAIL") {
        result = recipients.length
          ? await sendEmail(
            target,
            `[${String(alert.severity).toUpperCase()}] ${alert.title}`,
            alertTemplate(alert.title, alert.message)
          )
          : { delivered: false, reason: "NO_ROOT_RECIPIENTS" };
      }

      if (channel === "TELEGRAM") {
        result = await sendTelegram(`${String(alert.severity).toUpperCase()}\n${alert.title}\n${alert.message}`);
      }

      if (channel === "WHATSAPP") {
        result = await sendWhatsApp(`${alert.title}: ${alert.message}`);
      }
    } catch (error) {
      result = {
        delivered: false,
        reason: error.code || error.message || "DELIVERY_FAILED"
      };
    }

    deliveries.push({ channel, ...result });

    await query(`
      INSERT INTO platform_alert_deliveries (
        alert_id, channel_type, target_value, delivery_status, provider_message_id, error_message, sent_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7 = 'sent' THEN NOW() ELSE NULL END, NOW())
      `, [
      alert.alert_id,
      channel,
      target,
      result.delivered ? "sent" : "failed",
      result.providerMessageId || null,
      result.reason || null,
      result.delivered ? "sent" : "failed"
    ]);
  }

  return deliveries;
}

async function create(data, meta = {}) {
  const status = normalizeStatus(data.status || "PENDIENTE");

  const alert = await transaction(async (client) => {
    const insert = await client.query(`
      INSERT INTO alerts (
        rule_key,
        source_type,
        source_ref_id,
        dedupe_key,
        tenant_id,
        severity,
        status,
        title,
        message,
        summary_json,
        context_json,
        assigned_platform_account_id,
        first_seen_at,
        last_seen_at,
        sla_due_at,
        occurrences,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, NOW(), NOW(), $13, 1, NOW(), NOW()
      )
      RETURNING *
    `, [
      data.eventKey,
      data.sourceType || "manual",
      data.sourceRefId || null,
      data.dedupeKey || null,
      data.tenantId || null,
      data.severity,
      status,
      data.title,
      data.message,
      JSON.stringify(data.summary || {}),
      JSON.stringify(data.context || {}),
      data.assignedPlatformAccountId || null,
      data.slaDueAt || defaultSlaDueAt(data.severity)
    ]);

    const row = insert.rows[0];
    await recordAlertEvent(client, {
      alertId: row.alert_id,
      eventType: "ALERT_CREATED",
      toStatus: row.status,
      actorPlatformAccountId: meta.actor?.sub || null,
      noteText: data.message,
      payload: {
        requestId: meta.context?.requestId || null,
        correlationId: meta.context?.correlationId || null
      }
    });

    return row;
  });

  const deliveries = await deliver(alert, data.channels || []);
  realtime.publishRootEvent("alert_created", { ...alert, deliveries });
  return { ...alert, deliveries };
}

async function raiseOperationalAlert(payload) {
  const dedupeKey = payload.dedupeKey || `${payload.ruleKey}:${payload.sourceRefId || payload.title}`;
  let shouldNotifyEscalation = false;

  const alert = await transaction(async (client) => {
    const existing = await client.query(`
      SELECT *
      FROM alerts
      WHERE dedupe_key = $1
        AND status = ANY($2::text[])
      ORDER BY last_seen_at DESC
      LIMIT 1
    `, [dedupeKey, ACTIVE_STATUSES]);

    const current = existing.rows[0];
    if (current) {
      const nextSeverity =
        severityRank(payload.severity) >= severityRank(current.severity)
          ? payload.severity
          : current.severity;
      shouldNotifyEscalation =
        shouldAutoEmail(nextSeverity)
        && severityRank(nextSeverity) > severityRank(current.severity);

      const updated = await client.query(`
        UPDATE alerts
        SET
          severity = $2,
          message = $3,
          summary_json = $4::jsonb,
          context_json = $5::jsonb,
          last_seen_at = NOW(),
          occurrences = occurrences + 1,
          sla_due_at = CASE
            WHEN sla_due_at IS NULL THEN $6::timestamptz
            ELSE sla_due_at
          END,
          updated_at = NOW()
        WHERE alert_id = $1
        RETURNING *
      `, [
        current.alert_id,
        nextSeverity,
        payload.message,
        JSON.stringify(payload.summary || {}),
        JSON.stringify(payload.context || {}),
        defaultSlaDueAt(nextSeverity)
      ]);

      await recordAlertEvent(client, {
        alertId: current.alert_id,
        eventType: "ALERT_OCCURRENCE_RECORDED",
        fromStatus: current.status,
        toStatus: current.status,
        noteText: payload.message,
        payload: {
          summary: payload.summary || {},
          context: payload.context || {}
        }
      });

      return updated.rows[0];
    }

    const inserted = await client.query(`
      INSERT INTO alerts (
        rule_key,
        source_type,
        source_ref_id,
        dedupe_key,
        tenant_id,
        severity,
        status,
        title,
        message,
        summary_json,
        context_json,
        assigned_platform_account_id,
        first_seen_at,
        last_seen_at,
        sla_due_at,
        occurrences,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, 'PENDIENTE', $7, $8, $9::jsonb, $10::jsonb, $11, NOW(), NOW(), $12, 1, NOW(), NOW()
      )
      RETURNING *
    `, [
      payload.ruleKey,
      payload.sourceType || "system",
      payload.sourceRefId || null,
      dedupeKey,
      payload.tenantId || null,
      payload.severity,
      payload.title,
      payload.message,
      JSON.stringify(payload.summary || {}),
      JSON.stringify(payload.context || {}),
      payload.assignedPlatformAccountId || null,
      payload.slaDueAt || defaultSlaDueAt(payload.severity)
    ]);

    await recordAlertEvent(client, {
      alertId: inserted.rows[0].alert_id,
      eventType: "ALERT_CREATED",
      toStatus: "PENDIENTE",
      noteText: payload.message,
      payload: {
        summary: payload.summary || {},
        context: payload.context || {}
      }
    });

    return inserted.rows[0];
  });

  realtime.publishRootEvent("alert", alert);
  if (
    (shouldAutoEmail(alert.severity) && Number(alert.occurrences || 1) === 1)
    || shouldNotifyEscalation
  ) {
    await deliver(alert, ["EMAIL"]);
  }
  return alert;
}

async function changeStatus(alertId, nextStatus, meta = {}) {
  const normalized = normalizeStatus(nextStatus);

  const result = await transaction(async (client) => {
    const existing = await client.query(`SELECT * FROM alerts WHERE alert_id = $1 LIMIT 1`, [alertId]);
    const current = existing.rows[0];
    if (!current) return null;

    const updated = await client.query(`
      UPDATE alerts
      SET
        status = $2::text,
        updated_at = NOW(),
        acknowledged_at = CASE WHEN $2::text = 'EN_INVESTIGACION' THEN NOW() ELSE acknowledged_at END,
        mitigated_at = CASE WHEN $2::text = 'MITIGADO' THEN NOW() ELSE mitigated_at END,
        resolved_at = CASE WHEN $2::text = 'RESUELTO' THEN NOW() ELSE resolved_at END,
        closed_at = CASE WHEN $2::text = 'CERRADO' THEN NOW() ELSE closed_at END
      WHERE alert_id = $1
      RETURNING *
    `, [alertId, normalized]);

    if (meta.note) {
      await client.query(`
        INSERT INTO incident_notes (
          incident_note_id,
          alert_id,
          author_platform_account_id,
          note_type,
          body,
          is_internal,
          created_at
        ) VALUES (gen_random_uuid(), $1::bigint, $2::uuid, $3::text, $4::text, true, NOW())
      `, [
        alertId,
        meta.actor?.sub || null,
        normalized === "RESUELTO" ? "resolution" : normalized === "MITIGADO" ? "mitigation" : "status_change",
        meta.note
      ]);
    }

    await recordAlertEvent(client, {
      alertId,
      eventType: "STATUS_CHANGED",
      fromStatus: current.status,
      toStatus: normalized,
      actorPlatformAccountId: meta.actor?.sub || null,
      noteText: meta.note || null,
      payload: {
        requestId: meta.context?.requestId || null,
        correlationId: meta.context?.correlationId || null
      }
    });

    return updated.rows[0];
  });

  if (result) {
    realtime.publishRootEvent("alert_status_changed", { alertId, status: result.status });
  }

  return result;
}

async function resolve(alertId, resolutionNote = "", meta = {}) {
  return changeStatus(alertId, "RESUELTO", { ...meta, note: resolutionNote });
}

async function reopen(alertId, meta = {}) {
  return changeStatus(alertId, "PENDIENTE", { ...meta, note: meta.note || "Alerta reabierta" });
}

async function addNote(alertId, body, meta = {}) {
  const result = await transaction(async (client) => {
    const existing = await client.query(`SELECT alert_id FROM alerts WHERE alert_id = $1 LIMIT 1`, [alertId]);
    if (!existing.rows[0]) return null;

    const insert = await client.query(`
      INSERT INTO incident_notes (
        incident_note_id,
        alert_id,
        author_platform_account_id,
        note_type,
        body,
        is_internal,
        created_at
      ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
      RETURNING *
    `, [
      alertId,
      meta.actor?.sub || null,
      meta.noteType || "investigation",
      body,
      meta.isInternal !== false
    ]);

    await recordAlertEvent(client, {
      alertId,
      eventType: "NOTE_ADDED",
      actorPlatformAccountId: meta.actor?.sub || null,
      noteText: body,
      payload: {
        noteType: meta.noteType || "investigation",
        isInternal: meta.isInternal !== false
      }
    });

    return insert.rows[0];
  });

  if (result) realtime.publishRootEvent("alert_note_added", { alertId });
  return result;
}

async function assign(alertId, data, meta = {}) {
  const result = await transaction(async (client) => {
    const existing = await client.query(`SELECT * FROM alerts WHERE alert_id = $1 LIMIT 1`, [alertId]);
    const current = existing.rows[0];
    if (!current) return null;

    const updated = await client.query(`
      UPDATE alerts
      SET
        assigned_platform_account_id = $2,
        sla_due_at = $3::timestamptz,
        updated_at = NOW()
      WHERE alert_id = $1
      RETURNING *
    `, [
      alertId,
      data.assignedPlatformAccountId || null,
      data.slaDueAt || current.sla_due_at || defaultSlaDueAt(current.severity)
    ]);

    await recordAlertEvent(client, {
      alertId,
      eventType: "ALERT_ASSIGNED",
      actorPlatformAccountId: meta.actor?.sub || null,
      noteText: data.note || null,
      payload: {
        assignedPlatformAccountId: data.assignedPlatformAccountId || null,
        slaDueAt: data.slaDueAt || current.sla_due_at || defaultSlaDueAt(current.severity)
      }
    });

    return updated.rows[0];
  });

  if (result) realtime.publishRootEvent("alert_assigned", { alertId, assignedPlatformAccountId: result.assigned_platform_account_id });
  return result;
}

async function report() {
  const [summary, topRules, assignmentLoad, slowResolutions, dailyTrend] = await Promise.all([
    query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDIENTE')::int AS pending,
        COUNT(*) FILTER (WHERE status = 'EN_INVESTIGACION')::int AS investigating,
        COUNT(*) FILTER (WHERE status = 'MITIGADO')::int AS mitigated,
        COUNT(*) FILTER (WHERE status IN ('RESUELTO', 'CERRADO'))::int AS closed,
        COUNT(*) FILTER (WHERE assigned_platform_account_id IS NULL AND status = ANY($1::text[]))::int AS unassigned_active,
        COUNT(*) FILTER (WHERE sla_due_at IS NOT NULL AND sla_due_at < NOW() AND status = ANY($1::text[]))::int AS overdue_active,
        ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0) FILTER (WHERE resolved_at IS NOT NULL), 2) AS avg_resolution_hours
      FROM alerts
    `, [ACTIVE_STATUSES]),
    query(`
      SELECT rule_key, COUNT(*)::int AS total
      FROM alerts
      WHERE created_at > NOW() - interval '30 days'
      GROUP BY rule_key
      ORDER BY total DESC, rule_key ASC
      LIMIT 5
    `),
    query(`
      SELECT
        COALESCE(pa.email, 'Sin asignar') AS owner,
        COUNT(*)::int AS active_alerts
      FROM alerts a
      LEFT JOIN platform_accounts pa ON pa.platform_account_id = a.assigned_platform_account_id
      WHERE a.status = ANY($1::text[])
      GROUP BY COALESCE(pa.email, 'Sin asignar')
      ORDER BY active_alerts DESC, owner ASC
    `, [ACTIVE_STATUSES]),
    query(`
      SELECT title, severity, created_at, resolved_at,
        ROUND(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0, 2) AS hours
      FROM alerts
      WHERE resolved_at IS NOT NULL
      ORDER BY hours DESC
      LIMIT 5
    `),
    query(`
      SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS total
      FROM alerts
      WHERE created_at > NOW() - interval '14 days'
      GROUP BY created_at::date
      ORDER BY day ASC
    `)
  ]);

  return {
    summary: summary.rows[0] || {},
    topRules: topRules.rows,
    assignmentLoad: assignmentLoad.rows,
    slowResolutions: slowResolutions.rows,
    dailyTrend: dailyTrend.rows
  };
}

module.exports = {
  ACTIVE_STATUSES,
  list,
  getDetail,
  create,
  raiseOperationalAlert,
  changeStatus,
  resolve,
  reopen,
  addNote,
  assign,
  report
};
