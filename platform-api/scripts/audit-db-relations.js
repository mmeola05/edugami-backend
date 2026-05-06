require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function count(sql) {
  const result = await pool.query(sql);
  return result.rows[0]?.count || 0;
}

async function main() {
  const [tables, constraints, indexes] = await Promise.all([
    pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `),
    pool.query(`
      SELECT
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position
    `),
    pool.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `)
  ]);

  const checks = {
    duplicatePlatformModulesTable: await count("SELECT CASE WHEN to_regclass('public.platform_modules') IS NULL THEN 0 ELSE 1 END::int AS count"),
    duplicatePlatformPermissionsTable: await count("SELECT CASE WHEN to_regclass('public.platform_permissions') IS NULL THEN 0 ELSE 1 END::int AS count"),
    invalidTenantModuleScopes: await count(`
      SELECT COUNT(*)::int AS count
      FROM tenant_modules tm
      JOIN modules m ON m.module_key = tm.module_key
      WHERE m.scope <> 'TENANT'
    `),
    tenantRoleModulesWithoutRole: await count(`
      SELECT COUNT(*)::int AS count
      FROM tenant_role_modules trm
      LEFT JOIN tenant_roles tr ON tr.tenant_id = trm.tenant_id AND tr.code = trm.role_code
      WHERE tr.role_id IS NULL
    `),
    tenantRolePermissionsWithoutRole: await count(`
      SELECT COUNT(*)::int AS count
      FROM tenant_role_permissions trp
      LEFT JOIN tenant_roles tr ON tr.tenant_id = trp.tenant_id AND tr.code = trp.role_code
      WHERE tr.role_id IS NULL
    `),
    userTenantRolesWithoutUser: await count(`
      SELECT COUNT(*)::int AS count
      FROM user_tenant_roles utr
      LEFT JOIN tenant_users u ON u.tenant_id = utr.tenant_id AND u.user_id = utr.user_id
      WHERE u.user_id IS NULL
    `),
    permissionScopeMismatch: await count(`
      SELECT COUNT(*)::int AS count
      FROM permissions p
      JOIN modules m ON m.module_key = p.module_key
      WHERE p.scope <> m.scope
    `)
  };

  console.log(JSON.stringify({
    tables: tables.rows.map((row) => row.table_name),
    constraints: constraints.rows,
    indexes: indexes.rows,
    checks
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
