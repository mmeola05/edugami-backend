require("dotenv").config();

const { ensureSchema } = require("../src/services/audit.service");
const { query } = require("../src/config/db");

async function main() {
  await ensureSchema();
  const result = await query("SELECT to_regclass('public.platform_audit_events')::text AS table_name");
  console.log(JSON.stringify({ ok: true, table: result.rows[0].table_name }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
