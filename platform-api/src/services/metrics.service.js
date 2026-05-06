const os = require("os");
const { query } = require("../config/db");
const { config } = require("../config/config");

async function fetchAgentSummary() {
  try {
    const response = await fetch(`${config.OPS_AGENT_URL}/summary`, {
      headers: {
        "x-ops-shared-token": config.OPS_AGENT_SHARED_TOKEN
      }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.data || null;
  } catch {
    return null;
  }
}

function fallbackServerMetrics() {
  const total = os.totalmem();
  const free = os.freemem();
  return {
    hostname: os.hostname(),
    uptimeSec: os.uptime(),
    cpuLoad1m: os.loadavg()[0],
    cpuLoad5m: os.loadavg()[1],
    cpuLoad15m: os.loadavg()[2],
    cpuCount: os.cpus().length,
    memoryUsedMb: Math.round((total - free) / 1024 / 1024),
    memoryTotalMb: Math.round(total / 1024 / 1024)
  };
}

async function overview() {
  const start = Date.now();
  await query("SELECT 1");
  const dbPingMs = Date.now() - start;

  const [agentSummary, tenants, alerts, services, serviceStatus, actions24h] = await Promise.all([
    fetchAgentSummary(),
    query(`SELECT COUNT(*)::int AS count FROM tenants`),
    query(`SELECT COUNT(*)::int AS count FROM alerts WHERE status IN ('PENDIENTE', 'EN_INVESTIGACION', 'MITIGADO')`),
    query(`
      SELECT service_key AS key, status
      FROM platform_services
      ORDER BY service_key
    `),
    query(`
      SELECT status, COUNT(*)::int AS count
      FROM platform_services
      GROUP BY status
      ORDER BY status
    `),
    query(`
      SELECT COUNT(*)::int AS count
      FROM platform_service_actions
      WHERE created_at > NOW() - interval '24 hours'
    `)
  ]);

  const operational = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('PENDIENTE', 'EN_INVESTIGACION', 'MITIGADO') AND assigned_platform_account_id IS NULL)::int AS unassignedAlerts,
      COUNT(*) FILTER (WHERE status IN ('PENDIENTE', 'EN_INVESTIGACION', 'MITIGADO') AND sla_due_at IS NOT NULL AND sla_due_at < NOW())::int AS overdueAlerts,
      ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600.0) FILTER (WHERE resolved_at IS NOT NULL), 2) AS avgResolutionHours
    FROM alerts
  `);

  return {
    server: agentSummary?.host || fallbackServerMetrics(),
    db: {
      pingMs: dbPingMs,
      status: "up"
    },
    counts: {
      tenants: tenants.rows[0]?.count || 0,
      openAlerts: alerts.rows[0]?.count || 0,
      serviceActions24h: actions24h.rows[0]?.count || 0
    },
    operational: operational.rows[0] || {},
    services: services.rows,
    serviceStatus: serviceStatus.rows,
    agent: agentSummary
  };
}

async function charts() {
  const alerts = await query(`SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS total FROM alerts WHERE created_at > NOW() - interval '14 days' GROUP BY created_at::date ORDER BY day ASC`);
  const logins = await query(`SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS total FROM platform_login_attempts WHERE created_at > NOW() - interval '14 days' GROUP BY created_at::date ORDER BY day ASC`);
  const actions = await query(`SELECT TO_CHAR(created_at::date, 'YYYY-MM-DD') AS day, COUNT(*)::int AS total FROM platform_service_actions WHERE created_at > NOW() - interval '14 days' GROUP BY created_at::date ORDER BY day ASC`);
  return {
    alertsPerDay: alerts.rows,
    loginsPerDay: logins.rows,
    serviceActionsPerDay: actions.rows
  };
}

module.exports = { overview, charts };
