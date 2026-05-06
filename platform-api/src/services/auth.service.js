const { query, transaction } = require("../config/db");
const { sign } = require("../utils/jwt");
const { comparePassword, hashPassword, randomToken } = require("../utils/password");
const { config } = require("../config/config");
const alertRules = require("./alertRules.service");

async function getPermissions(accountId) {
  const result = await query(`
    SELECT DISTINCT p.permission_code
    FROM permissions p
    LEFT JOIN platform_role_permissions rp ON rp.permission_code = p.permission_code
    LEFT JOIN platform_role_assignments ra ON ra.role_id = rp.role_id
    LEFT JOIN platform_account_permissions ap ON ap.permission_code = p.permission_code
    WHERE ra.platform_account_id = $1 OR ap.platform_account_id = $1
    ORDER BY p.permission_code
  `, [accountId]);
  return result.rows.map(x => x.permission_code);
}

async function getEffectivePlatformModules(role, permissions = []) {
  const scope = role === 'SUPPORT' ? 'SUPPORT' : 'ROOT';
  const hasAllPermissions = permissions.includes('*');

  const result = await query(`
    SELECT DISTINCT
      m.module_key,
      m.parent_module_key,
      msa.scope,
      m.name,
      m.description,
      msa.display_order
    FROM modules m
    JOIN module_scope_availability msa ON msa.module_key = m.module_key AND msa.scope = $1
    LEFT JOIN permissions p ON p.module_key = m.module_key AND p.scope = msa.scope
    WHERE msa.global_enabled = TRUE
      AND (
        $2 = TRUE
        OR p.permission_code = ANY($3::varchar[])
      )
    ORDER BY msa.display_order, m.module_key
  `, [scope, hasAllPermissions, permissions]);

  return result.rows;
}

async function registerAttempt(platformAccountId, email, success, meta = {}) {
  await query(`
    INSERT INTO platform_login_attempts (attempt_id, platform_account_id, email, success, ip_address, user_agent, failure_reason, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
  `, [platformAccountId || null, email || null, success, meta.ipAddress || null, meta.userAgent || null, meta.failureReason || null]);

  if (!success) {
    await alertRules.handleLoginFailure({
      email,
      ipAddress: meta.ipAddress || null,
      userAgent: meta.userAgent || null,
      requestId: meta.context?.requestId || null,
      correlationId: meta.context?.correlationId || null,
      reason: meta.failureReason || null
    });
  }
}

async function isLocked(accountId) {
  const result = await query(`
    SELECT COUNT(*)::int AS count
    FROM platform_login_attempts
    WHERE platform_account_id = $1
      AND success = false
      AND created_at > NOW() - ($2 || ' minutes')::interval
  `, [accountId, String(config.LOGIN_LOCK_MINUTES)]);
  return (result.rows[0]?.count || 0) >= config.LOGIN_RATE_MAX_ATTEMPTS;
}

async function findValidPlatformAccount(email, password) {
  const result = await query(`
    SELECT platform_account_id, email, password_hash, role, status
    FROM platform_accounts
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
  `, [email]);

  const account = result.rows[0];
  if (!account || account.status !== "active") return null;
  if (await isLocked(account.platform_account_id)) return null;
  if (!(await comparePassword(password, account.password_hash))) return null;
  return account;
}

async function issuePlatformSession(account, meta = {}) {
  const accessToken = sign({ sub: account.platform_account_id, role: account.role, scope: 'platform' });
  const refreshToken = randomToken();

  await query(`
    INSERT INTO platform_refresh_tokens (refresh_token_id, platform_account_id, token_hash, expires_at, created_at)
    VALUES (gen_random_uuid(), $1, digest($2, 'sha256'), NOW() + interval '30 days', NOW())
  `, [account.platform_account_id, refreshToken]);

  await registerAttempt(account.platform_account_id, account.email, true, meta);

  return {
    scope: "platform",
    account: { platformAccountId: account.platform_account_id, email: account.email, role: account.role },
    accessToken,
    refreshToken
  };
}

async function login(email, password, meta = {}) {
  const result = await query(`
    SELECT platform_account_id, email, password_hash, role, status
    FROM platform_accounts
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
  `, [email]);

  const account = result.rows[0];
  if (!account) {
    await registerAttempt(null, email, false, { ...meta, failureReason: 'account_not_found' });
    throw new Error('INVALID_CREDENTIALS');
  }
  if (account.status !== 'active') {
    await registerAttempt(account.platform_account_id, email, false, { ...meta, failureReason: 'account_suspended' });
    throw new Error('ACCOUNT_SUSPENDED');
  }
  if (await isLocked(account.platform_account_id)) {
    await registerAttempt(account.platform_account_id, email, false, { ...meta, failureReason: 'locked_by_failed_attempts' });
    throw new Error('ACCOUNT_LOCKED');
  }

  const valid = await comparePassword(password, account.password_hash);
  if (!valid) {
    await registerAttempt(account.platform_account_id, email, false, { ...meta, failureReason: 'invalid_password' });
    throw new Error('INVALID_CREDENTIALS');
  }

  const session = await issuePlatformSession(account, meta);
  return {
    account: session.account,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken
  };
}

async function refresh(refreshToken) {
  const result = await query(`
    SELECT rt.platform_account_id, pa.email, pa.role, pa.status
    FROM platform_refresh_tokens rt
    JOIN platform_accounts pa ON pa.platform_account_id = rt.platform_account_id
    WHERE rt.token_hash = digest($1, 'sha256')
      AND rt.revoked_at IS NULL
      AND rt.expires_at > NOW()
    LIMIT 1
  `, [refreshToken]);

  const row = result.rows[0];
  if (!row || row.status !== 'active') throw new Error('INVALID_REFRESH_TOKEN');

  const accessToken = sign({ sub: row.platform_account_id, role: row.role, scope: 'platform' });
  return {
    account: { platformAccountId: row.platform_account_id, email: row.email, role: row.role },
    accessToken
  };
}

async function logout(refreshToken) {
  await query(`UPDATE platform_refresh_tokens SET revoked_at = NOW() WHERE token_hash = digest($1, 'sha256') AND revoked_at IS NULL`, [refreshToken]);
  return { revoked: true };
}

async function requestRecovery(email) {
  const result = await query(`SELECT platform_account_id, email, status FROM platform_accounts WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
  const account = result.rows[0];
  if (!account || account.status !== 'active') return { accepted: true };
  const token = randomToken();
  await query(`INSERT INTO platform_password_reset_tokens (reset_token_id, platform_account_id, token_hash, expires_at, created_at) VALUES (gen_random_uuid(), $1, digest($2, 'sha256'), NOW() + interval '2 hours', NOW())`, [account.platform_account_id, token]);
  return { accepted: true, email: account.email, recoveryUrl: `${config.FRONTEND_URL}/auth/reset-password?token=${token}` };
}

async function resetPassword(token, newPassword) {
  const tokenResult = await query(`SELECT reset_token_id, platform_account_id FROM platform_password_reset_tokens WHERE token_hash = digest($1, 'sha256') AND used_at IS NULL AND expires_at > NOW() LIMIT 1`, [token]);
  const row = tokenResult.rows[0];
  if (!row) throw new Error('INVALID_TOKEN');
  const passwordHash = await hashPassword(newPassword);
  await transaction(async (client) => {
    await client.query(`UPDATE platform_accounts SET password_hash = $2, updated_at = NOW() WHERE platform_account_id = $1`, [row.platform_account_id, passwordHash]);
    await client.query(`UPDATE platform_password_reset_tokens SET used_at = NOW() WHERE reset_token_id = $1`, [row.reset_token_id]);
    await client.query(`UPDATE platform_refresh_tokens SET revoked_at = NOW() WHERE platform_account_id = $1 AND revoked_at IS NULL`, [row.platform_account_id]);
  });
  return { changed: true };
}

module.exports = {
  login,
  refresh,
  logout,
  requestRecovery,
  resetPassword,
  getPermissions,
  getEffectivePlatformModules,
  findValidPlatformAccount,
  issuePlatformSession,
  registerAttempt
};
