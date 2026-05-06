require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

function quoteIdent(identifier) {
  return `"${String(identifier).replace(/"/g, '""')}"`;
}

async function main() {
  const tablesResult = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  const backup = {
    createdAt: new Date().toISOString(),
    database: process.env.DB_NAME,
    tables: {}
  };

  for (const { table_name: tableName } of tablesResult.rows) {
    const rows = await pool.query(`SELECT * FROM ${quoteIdent(tableName)}`);
    backup.tables[tableName] = rows.rows;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.join(__dirname, "..", "tmp");
  const outFile = path.join(outDir, `db-backup-${stamp}.json`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(backup, null, 2));
  console.log(outFile);
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
