const { Pool } = require("pg");
const { config } = require("./config");

const pool = new Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD
});

async function initDb() {
  await pool.query("SELECT 1");
}

async function query(text, params = []) {
  return pool.query(text, params);
}

async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { initDb, query, transaction };
