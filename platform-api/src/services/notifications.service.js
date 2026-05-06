const { query } = require("../config/db");
const { randomToken } = require("../utils/password");

async function saveToken(platformAccountId, token, platform = 'mobile') {
  const tokenId = await randomToken();
  const result = await query(`
    INSERT INTO platform_push_tokens (token_id, platform_account_id, token, platform, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (token) DO UPDATE SET updated_at = NOW()
    RETURNING token_id, platform, created_at
  `, [tokenId, platformAccountId, token, platform]);
  
  return result.rows[0];
}

async function listTokens(platformAccountId) {
  const result = await query(`
    SELECT token_id, platform, created_at, updated_at
    FROM platform_push_tokens
    WHERE platform_account_id = $1
    ORDER BY created_at DESC
  `, [platformAccountId]);
  
  return result.rows;
}

async function removeToken(platformAccountId, tokenId) {
  const result = await query(`
    DELETE FROM platform_push_tokens
    WHERE token_id = $1 AND platform_account_id = $2
    RETURNING token_id
  `, [tokenId, platformAccountId]);
  
  return result.rows[0];
}

async function getTokensByAccount(platformAccountId) {
  const result = await query(`
    SELECT token FROM platform_push_tokens
    WHERE platform_account_id = $1
  `, [platformAccountId]);
  
  return result.rows.map(r => r.token);
}

module.exports = { saveToken, listTokens, removeToken, getTokensByAccount };
