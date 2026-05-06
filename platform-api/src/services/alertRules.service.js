const { query } = require("../config/db");
const alerts = require("./alerts.service");
const { logger } = require("../observability/logger");

async function safeRaise(factory) {
  try {
    await factory();
  } catch (error) {
    logger.warn({ err: error }, "Alert rule evaluation failed");
  }
}

async function handleLoginFailure({ email, ipAddress, userAgent, requestId, correlationId, reason }) {
  await safeRaise(async () => {
    const result = await query(`
      SELECT COUNT(*)::int AS count
      FROM platform_login_attempts
      WHERE success = false
        AND (
          LOWER(COALESCE(email, '')) = LOWER($1)
          OR COALESCE(ip_address::text, '') = COALESCE($2, '')
        )
        AND created_at > NOW() - interval '15 minutes'
    `, [email || "", ipAddress || null]);

    const failures = result.rows[0]?.count || 0;
    if (failures < 5) return;

    await alerts.raiseOperationalAlert({
      ruleKey: "login_failed_repeated",
      dedupeKey: `login_failed:${String(email || "unknown").toLowerCase()}:${ipAddress || "unknown"}`,
      severity: failures >= 10 ? "error" : "warning",
      title: "Intentos de login fallidos repetidos",
      message: `Se detectaron ${failures} intentos fallidos recientes para ${email || "cuenta desconocida"}.`,
      summary: { email, ipAddress, failures, reason },
      context: { userAgent, requestId, correlationId },
      sourceType: "auth"
    });
  });
}

async function handleRuntimeError({ error, req }) {
  await safeRaise(async () => {
    await alerts.raiseOperationalAlert({
      ruleKey: "http_500_error",
      dedupeKey: `http_500:${req?.method || "UNKNOWN"}:${req?.originalUrl || "unknown"}`,
      severity: "error",
      title: "Error 500 en plataforma",
      message: `Se produjo un error no controlado en ${req?.method || "UNKNOWN"} ${req?.originalUrl || ""}`.trim(),
      summary: {
        code: error.code || "INTERNAL_SERVER_ERROR",
        message: error.message || "Unhandled request error"
      },
      context: {
        requestId: req?.context?.requestId || null,
        correlationId: req?.context?.correlationId || null,
        routePath: req?.originalUrl || null,
        method: req?.method || null
      },
      sourceType: "backend_error"
    });
  });
}

async function handleAuditEvent(event, input = {}) {
  await safeRaise(async () => {
    const eventKey = input.eventType || event.event_key;
    const action = input.action || event.action;

    if (String(eventKey || "").startsWith("platform_role_") || String(eventKey || "").startsWith("platform_account_")) {
      await alerts.raiseOperationalAlert({
        ruleKey: "rbac_change",
        dedupeKey: `rbac:${eventKey}:${event.entity_id || "unknown"}`,
        severity: "warning",
        title: "Cambio sensible en RBAC",
        message: `Se registró un cambio de permisos o roles en plataforma (${eventKey}).`,
        summary: {
          entityType: event.entity_type,
          entityId: event.entity_id,
          eventKey,
          moduleKey: event.module_key
        },
        context: {
          requestId: input.context?.requestId || null,
          correlationId: input.context?.correlationId || null
        },
        sourceType: "audit"
      });
      return;
    }

    if (action === "delete") {
      const countResult = await query(`
        SELECT COUNT(*)::int AS count
        FROM audit_logs
        WHERE action = 'delete'
          AND actor_platform_account_id IS NOT DISTINCT FROM $1::uuid
          AND occurred_at > NOW() - interval '10 minutes'
      `, [input.actor?.sub || null]);

      const deletes = countResult.rows[0]?.count || 0;
      if (deletes >= 3) {
        await alerts.raiseOperationalAlert({
          ruleKey: "mass_delete",
          dedupeKey: `mass_delete:${input.actor?.sub || "system"}`,
          severity: deletes >= 10 ? "error" : "warning",
          title: "Posible borrado masivo detectado",
          message: `Se registraron ${deletes} operaciones de borrado recientes por el mismo actor.`,
          summary: {
            deletes,
            actorId: input.actor?.sub || null,
            entityType: event.entity_type
          },
          context: {
            requestId: input.context?.requestId || null,
            correlationId: input.context?.correlationId || null
          },
          sourceType: "audit"
        });
      }
    }
  });
}

module.exports = {
  handleLoginFailure,
  handleRuntimeError,
  handleAuditEvent
};
