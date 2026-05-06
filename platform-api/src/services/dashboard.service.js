const { query } = require("../config/db");

async function overview() {
  const [tenants, accounts, alerts, services] = await Promise.all([
    query(`SELECT COUNT(*)::int AS count FROM tenants WHERE status = 'active'`),
    query(`SELECT COUNT(*)::int AS count FROM platform_accounts WHERE status = 'active'`),
    query(`SELECT COUNT(*)::int AS count FROM alerts WHERE status IN ('PENDIENTE', 'EN_INVESTIGACION', 'MITIGADO') AND severity IN ('error', 'fatal')`),
    query(`SELECT service_key AS key, status FROM platform_services ORDER BY service_key`)
  ]);

  return {
    kpis: {
      tenantsActive: tenants.rows[0]?.count || 0,
      platformAccountsActive: accounts.rows[0]?.count || 0,
      openCriticalAlerts: alerts.rows[0]?.count || 0
    },
    services: services.rows
  };
}

module.exports = { overview };
