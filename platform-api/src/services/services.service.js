const { query } = require("../config/db");
const { config } = require("../config/config");
const audit = require("./audit.service");

async function fetchAgent(path, options = {}) {
  const response = await fetch(`${config.OPS_AGENT_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-ops-shared-token": config.OPS_AGENT_SHARED_TOKEN,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(payload || "OPS_AGENT_REQUEST_FAILED");
  }

  return response.json();
}

async function syncServiceStatus(runtimeServices = []) {
  if (!runtimeServices.length) return;
  await Promise.all(runtimeServices.map((item) =>
    query(`
      UPDATE platform_services
      SET status = $2, updated_at = NOW()
      WHERE service_key = $1
    `, [item.key, item.status])
  ));
}

async function list() {
  const dbResult = await query(`
    SELECT
      s.service_key,
      s.service_name,
      s.service_type,
      s.control_mode,
      s.is_restartable,
      s.status,
      s.updated_at,
      last_action.action_type AS last_action_type,
      last_action.action_status AS last_action_status,
      last_action.created_at AS last_action_at,
      COALESCE(action_stats.actions_24h, 0)::int AS actions_24h,
      COALESCE(action_stats.restarts_24h, 0)::int AS restarts_24h
    FROM platform_services s
    LEFT JOIN LATERAL (
      SELECT action_type, action_status, created_at
      FROM platform_service_actions a
      WHERE a.service_key = s.service_key
      ORDER BY a.created_at DESC
      LIMIT 1
    ) last_action ON TRUE
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - interval '24 hours') AS actions_24h,
        COUNT(*) FILTER (WHERE action_type = 'restart' AND created_at > NOW() - interval '24 hours') AS restarts_24h
      FROM platform_service_actions a
      WHERE a.service_key = s.service_key
    ) action_stats ON TRUE
    ORDER BY s.service_key
  `);

  let runtimeByKey = new Map();
  try {
    const runtime = await fetchAgent("/services");
    const rows = runtime?.data || [];
    runtimeByKey = new Map(rows.map((item) => [item.key, item]));
    await syncServiceStatus(rows);
  } catch {}

  return dbResult.rows.map((service) => {
    const runtime = runtimeByKey.get(service.service_key);
    return {
      ...service,
      status: runtime?.status || service.status,
      is_restartable: typeof runtime?.restartable === "boolean" ? runtime.restartable : service.is_restartable,
      health_status: runtime?.healthStatus || null,
      pid: runtime?.pid || null,
      uptime_sec: runtime?.uptimeSec || null,
      cpu_percent: runtime?.cpuPercent || null,
      memory_mb: runtime?.memoryMb || null,
      last_check_at: runtime?.lastCheckAt || null,
      runtime_message: runtime?.message || null
    };
  });
}

async function restart(serviceKey, meta = {}) {
  const serviceRes = await query(`
    SELECT service_key, control_mode, is_restartable
    FROM platform_services
    WHERE service_key = $1
    LIMIT 1
  `, [serviceKey]);

  const service = serviceRes.rows[0];
  if (!service) throw new Error("SERVICE_NOT_FOUND");

  let external = { accepted: false };

  if (service.control_mode === "agent") {
    const payload = await fetchAgent(`/services/${serviceKey}/restart`, {
      method: "POST",
      body: JSON.stringify({
        requestId: meta.context?.requestId || null,
        correlationId: meta.context?.correlationId || null,
        reason: meta.reason || null,
        actor: {
          sub: meta.actor?.sub || null,
          role: meta.actor?.role || null,
          scope: meta.actor?.scope || null
        }
      })
    }).catch((error) => {
      if (String(error.message || "").includes("SERVICE_NOT_RESTARTABLE")) {
        throw new Error("SERVICE_NOT_RESTARTABLE");
      }
      throw new Error("OPS_AGENT_RESTART_FAILED");
    });
    external = payload?.data || payload;
  } else if (!service.is_restartable) {
    throw new Error("SERVICE_NOT_RESTARTABLE");
  }

  const status = external.accepted ? "accepted" : "failed";
  const action = await query(`
    INSERT INTO platform_service_actions (
      service_key, action_type, source_channel, action_status, details_json, created_at, completed_at
    ) VALUES ($1, 'restart', 'ROOT_UI', $2, $3::jsonb, NOW(), $4)
    RETURNING action_id, service_key, action_type, action_status, created_at, completed_at
  `, [
    serviceKey,
    status,
    JSON.stringify({
      ...external,
      reason: meta.reason || null,
      requestId: meta.context?.requestId || null,
      correlationId: meta.context?.correlationId || null
    }),
    status === "accepted" ? null : new Date().toISOString()
  ]);

  await audit.record({
    actor: meta.actor,
    eventType: "platform_service_restart_requested",
    entityType: "platform_service",
    entityId: serviceKey,
    action: "restart",
    after: {
      serviceKey,
      accepted: external.accepted,
      commandId: external.commandId || null,
      status: external.status || status
    },
    metadata: {
      reason: meta.reason || null,
      controlMode: service.control_mode,
      commandId: external.commandId || null,
      restartable: external.restartable
    },
    context: meta.context || {},
    moduleKey: "SERVICES"
  });

  return { ...action.rows[0], external };
}

module.exports = { list, restart };
