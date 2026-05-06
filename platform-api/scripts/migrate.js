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

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name varchar(255) PRIMARY KEY,
      executed_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
}

async function appliedMigrations(client) {
  const result = await client.query(`SELECT migration_name FROM schema_migrations ORDER BY migration_name`);
  return new Set(result.rows.map((row) => row.migration_name));
}

async function main() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);
    const applied = await appliedMigrations(client);
    const dir = path.join(__dirname, "..", "sql", "migrations");
    const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (migration_name, executed_at) VALUES ($1, NOW()) ON CONFLICT (migration_name) DO NOTHING`,
          [file]
        );
        await client.query("COMMIT");
        console.log(`Applied ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
