require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

const knownPurpose = {
  modules: "Catalogo maestro de modulos ROOT/SUPPORT/TENANT. Se usa en catalogo y modulos efectivos.",
  module_scopes: "Catalogo normalizado de tipos/scope de modulo.",
  permissions: "Catalogo nuevo de permisos con modulo/scope/action. Se usa para agrupar RBAC y futuro middleware.",
  tenant_modules: "Activacion de modulos TENANT por tenant.",
  tenant_users: "Usuarios reales de tenant.",
  tenant_refresh_tokens: "Sesiones refresh token de usuarios tenant.",
  tenant_roles: "Roles tenant: TENANT_ADMIN/TEACHER/STUDENT.",
  tenant_role_modules: "Visibilidad de modulos por rol tenant.",
  tenant_role_permissions: "Permisos por rol tenant.",
  user_tenant_roles: "Asignacion de usuarios tenant a roles tenant.",
  platform_accounts: "Cuentas ROOT/SUPPORT.",
  platform_roles: "Roles internos de plataforma.",
  platform_role_permissions: "Permisos por rol interno.",
  platform_role_assignments: "Roles asignados a cuentas de plataforma.",
  platform_account_permissions: "Permisos directos de cuentas plataforma.",
  platform_refresh_tokens: "Sesiones refresh token.",
  platform_password_reset_tokens: "Reset de password.",
  platform_login_attempts: "Auditoria/rate-limit de login.",
  tenants: "Tenants/clientes.",
  platform_alert_events: "Alertas de plataforma.",
  platform_alert_deliveries: "Entregas email/telegram/whatsapp de alertas.",
  platform_services: "Catalogo de servicios controlados/observados.",
  platform_service_actions: "Historico de acciones de servicios."
};

async function tableCounts() {
  const tables = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const result = [];
  for (const row of tables.rows) {
    const count = await pool.query(`SELECT COUNT(*)::int AS count FROM ${row.table_name}`);
    result.push({
      table: row.table_name,
      rows: count.rows[0].count,
      purpose: knownPurpose[row.table_name] || "Sin documentar aun"
    });
  }
  return result;
}

async function moduleBreakdown() {
  const [modules, tenantModules, tenantRoles, tenantRoleModules, tenantRolePermissions] = await Promise.all([
    pool.query(`
      SELECT scope, COUNT(*)::int AS count
      FROM modules
      GROUP BY scope
      ORDER BY scope
    `),
    pool.query(`
      SELECT m.scope, COUNT(*)::int AS count
      FROM tenant_modules tm
      JOIN modules m ON m.module_key = tm.module_key
      GROUP BY m.scope
      ORDER BY m.scope
    `),
    pool.query("SELECT code, COUNT(*)::int AS count FROM tenant_roles GROUP BY code ORDER BY code"),
    pool.query("SELECT role_code, COUNT(*)::int AS count FROM tenant_role_modules GROUP BY role_code ORDER BY role_code"),
    pool.query("SELECT role_code, COUNT(*)::int AS count FROM tenant_role_permissions GROUP BY role_code ORDER BY role_code")
  ]);

  return {
    modulesByScope: modules.rows,
    tenantModulesByScope: tenantModules.rows,
    tenantRoles: tenantRoles.rows,
    tenantRoleModules: tenantRoleModules.rows,
    tenantRolePermissions: tenantRolePermissions.rows
  };
}

async function main() {
  console.log(JSON.stringify({
    moduleBreakdown: await moduleBreakdown(),
    tables: await tableCounts()
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
