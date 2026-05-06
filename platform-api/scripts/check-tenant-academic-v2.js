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
  const migration = await pool.query(`
    SELECT migration_name
    FROM schema_migrations
    WHERE migration_name = '027_tenant_academic_active_period_actions.sql'
  `);

  const activePeriods = await pool.query(`
    SELECT tenant_id, COUNT(*)::int AS active_count
    FROM tenant_academic_periods
    WHERE status = 'active'
    GROUP BY tenant_id
    ORDER BY tenant_id
  `);

  const historyTable = await pool.query(`
    SELECT to_regclass('public.tenant_academic_history_events') AS table_name
  `);

  const permissions = await pool.query(`
    SELECT permission_code
    FROM permissions
    WHERE permission_code IN (
      'academic_history.read',
      'students.move',
      'students.assign_subjects',
      'teacher_assignments.assign'
    )
    ORDER BY permission_code
  `);

  const result = {
    migrationApplied: migration.rowCount === 1,
    activePeriods: activePeriods.rows,
    historyTable: historyTable.rows[0]?.table_name || null,
    permissions: permissions.rows.map((row) => row.permission_code)
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
