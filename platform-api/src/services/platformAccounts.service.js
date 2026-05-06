const { query } = require("../config/db");
const { hashPassword } = require("../utils/password");

async function list() {
  const result = await query(`
    SELECT platform_account_id, email, role, status, created_at, updated_at
    FROM platform_accounts
    ORDER BY created_at DESC
  `);
  return result.rows;
}

async function detail(accountId) {
  const result = await query(`
    SELECT platform_account_id, email, role, status, created_at, updated_at
    FROM platform_accounts
    WHERE platform_account_id = $1
    LIMIT 1
  `, [accountId]);
  return result.rows[0] || null;
}

async function create(data) {
  const passwordHash = await hashPassword(data.password);
  const result = await query(`
    INSERT INTO platform_accounts (
      platform_account_id, email, password_hash, role, status, created_at, updated_at
    ) VALUES (gen_random_uuid(), LOWER($1), $2, $3, $4, NOW(), NOW())
    RETURNING platform_account_id, email, role, status, created_at, updated_at
  `, [data.email, passwordHash, data.role, data.status]);
  return result.rows[0];
}

async function update(accountId, data) {
  const current = await detail(accountId);
  if (!current) return null;

  const result = await query(`
    UPDATE platform_accounts
    SET role = $2, status = $3, updated_at = NOW()
    WHERE platform_account_id = $1
    RETURNING platform_account_id, email, role, status, created_at, updated_at
  `, [accountId, data.role || current.role, data.status || current.status]);

  return result.rows[0];
}

module.exports = { list, detail, create, update };
