require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function main() {
  const [modules, scopes, permissions, badTenantModules, duplicatePlatformModules, duplicatePlatformPermissions, tenants, tables, tenantUsers, tenantRefreshTokens, userTenantRoles] = await Promise.all([
    pool.query("SELECT scope, COUNT(*)::int AS count FROM modules GROUP BY scope ORDER BY scope"),
    pool.query("SELECT COUNT(*)::int AS count FROM module_scopes"),
    pool.query("SELECT COUNT(*)::int AS count FROM permissions"),
    pool.query(`
      SELECT COUNT(*)::int AS count
      FROM tenant_modules tm
      JOIN modules m ON m.module_key = tm.module_key
      WHERE m.scope != 'TENANT'
    `),
    pool.query("SELECT CASE WHEN to_regclass('public.platform_modules') IS NULL THEN 0 ELSE 1 END::int AS count"),
    pool.query("SELECT CASE WHEN to_regclass('public.platform_permissions') IS NULL THEN 0 ELSE 1 END::int AS count"),
    pool.query("SELECT COUNT(*)::int AS count FROM tenants"),
    pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'modules',
          'module_scopes',
          'permissions',
          'tenant_roles',
          'tenant_role_modules',
          'tenant_role_permissions',
          'tenant_users',
          'tenant_refresh_tokens',
          'user_tenant_roles'
        )
      ORDER BY table_name
    `),
    pool.query("SELECT COUNT(*)::int AS count FROM tenant_users"),
    pool.query("SELECT COUNT(*)::int AS count FROM tenant_refresh_tokens"),
    pool.query("SELECT COUNT(*)::int AS count FROM user_tenant_roles")
  ]);

  console.log(JSON.stringify({
    tables: tables.rows.map((row) => row.table_name),
    moduleScopes: scopes.rows[0].count,
    modules: modules.rows,
    permissions: permissions.rows[0].count,
    tenants: tenants.rows[0].count,
    tenantUsers: tenantUsers.rows[0].count,
    tenantRefreshTokens: tenantRefreshTokens.rows[0].count,
    userTenantRoles: userTenantRoles.rows[0].count,
    duplicatePlatformModulesTable: duplicatePlatformModules.rows[0].count,
    duplicatePlatformPermissionsTable: duplicatePlatformPermissions.rows[0].count,
    tenantModulesWithNonTenantScope: badTenantModules.rows[0].count
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
