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
  const [columns, constraints, triggers, indexes, tenantModules] = await Promise.all([
    pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tenant_modules'
      ORDER BY ordinal_position
    `),
    pool.query(`
      SELECT conname, contype
      FROM pg_constraint
      WHERE conrelid = 'tenant_modules'::regclass
      ORDER BY conname
    `),
    pool.query(`
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE event_object_table = 'tenant_modules'
      ORDER BY trigger_name
    `),
    pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'idx_modules_scope_parent_order',
          'idx_tenant_modules_tenant_enabled',
          'idx_platform_service_actions_service_created'
        )
      ORDER BY indexname
    `),
    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE m.scope <> 'TENANT')::int AS invalid_scope,
        COUNT(*) FILTER (WHERE m.parent_module_key IS NOT NULL)::int AS child_modules
      FROM tenant_modules tm
      JOIN modules m ON m.module_key = tm.module_key
    `)
  ]);

  console.log(JSON.stringify({
    tenantModulesColumns: columns.rows,
    constraints: constraints.rows,
    triggers: triggers.rows.map((row) => row.trigger_name),
    indexes: indexes.rows.map((row) => row.indexname),
    tenantModules: tenantModules.rows[0]
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
