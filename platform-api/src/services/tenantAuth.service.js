const { query } = require("../config/db");
const { sign } = require("../utils/jwt");
const { comparePassword, randomToken } = require("../utils/password");
const tenantUsers = require("./tenantUsers.service");

async function getUsersByEmail(email) {
  const result = await query(`
    SELECT
      t.tenant_id,
      t.slug,
      t.name AS tenant_name,
      t.status AS tenant_status,
      u.user_id,
      u.email,
      u.password_hash,
      u.display_name,
      u.status AS user_status
    FROM tenants t
    JOIN tenant_users u ON u.tenant_id = t.tenant_id
    WHERE LOWER(u.email) = LOWER($1)
    ORDER BY t.name ASC, t.slug ASC
  `, [email]);
  return result.rows;
}

function tokenPayload(row) {
  return {
    sub: row.user_id,
    tenantId: row.tenant_id,
    tenantSlug: row.slug,
    role: "TENANT_USER",
    scope: "tenant"
  };
}

function contextFromAccess(access, row) {
  return {
    tenantId: row.tenant_id,
    tenantSlug: row.slug,
    tenantName: row.tenant_name,
    userId: row.user_id,
    displayName: row.display_name,
    roles: access.roles,
    permissions: access.permissions,
    modules: access.modules
  };
}

async function resolveAuthorizedContexts(email, password) {
  const rows = await getUsersByEmail(email);
  if (rows.length === 0) throw new Error("INVALID_CREDENTIALS");

  const validRows = [];
  for (const row of rows) {
    if (await comparePassword(password, row.password_hash)) {
      validRows.push(row);
    }
  }
  if (validRows.length === 0) throw new Error("INVALID_CREDENTIALS");

  const contexts = [];
  let sawSuspendedTenant = false;
  let sawSuspendedUser = false;

  for (const row of validRows) {
    if (row.tenant_status !== "active") {
      sawSuspendedTenant = true;
      continue;
    }
    if (row.user_status !== "active") {
      sawSuspendedUser = true;
      continue;
    }

    const access = await tenantUsers.getEffectiveAccess(row.tenant_id, row.user_id);
    if (access) contexts.push({ row, access, context: contextFromAccess(access, row) });
  }

  if (contexts.length === 0) {
    if (sawSuspendedTenant) throw new Error("TENANT_SUSPENDED");
    if (sawSuspendedUser) throw new Error("ACCOUNT_SUSPENDED");
    throw new Error("ACCOUNT_SUSPENDED");
  }

  return contexts;
}

async function findValidTenantContexts(email, password) {
  try {
    const contexts = await resolveAuthorizedContexts(email, password);
    return contexts.map((item) => item.context);
  } catch {
    return [];
  }
}

function selectLoginContext(contexts, { tenantId, tenantSlug } = {}) {
  if (tenantId || tenantSlug) {
    const selected = contexts.find(({ row }) =>
      (tenantId && String(row.tenant_id) === String(tenantId)) ||
      (tenantSlug && String(row.slug).toLowerCase() === String(tenantSlug).toLowerCase())
    );
    if (!selected) throw new Error("TENANT_CONTEXT_NOT_ALLOWED");
    return selected;
  }

  return contexts[0];
}

async function login(email, password, options = {}) {
  const contexts = await resolveAuthorizedContexts(email, password);
  const selected = selectLoginContext(contexts, options);
  const row = selected.row;

  const accessToken = sign(tokenPayload(row));
  const refreshToken = randomToken();

  await query(`
    INSERT INTO tenant_refresh_tokens (refresh_token_id, tenant_id, user_id, token_hash, expires_at, created_at)
    VALUES (gen_random_uuid(), $1, $2, digest($3, 'sha256'), NOW() + interval '30 days', NOW())
  `, [row.tenant_id, row.user_id, refreshToken]);

  return {
    user: {
      userId: row.user_id,
      tenantId: row.tenant_id,
      tenantSlug: row.slug,
      tenantName: row.tenant_name,
      email: row.email,
      displayName: row.display_name
    },
    activeContext: selected.context,
    contexts: contexts.map((item) => item.context),
    accessToken,
    refreshToken
  };
}

async function contextsForUser(email) {
  const rows = await getUsersByEmail(email);
  const contexts = [];

  for (const row of rows) {
    if (row.tenant_status !== "active" || row.user_status !== "active") continue;
    const access = await tenantUsers.getEffectiveAccess(row.tenant_id, row.user_id);
    if (access) contexts.push(contextFromAccess(access, row));
  }

  return contexts;
}

async function refresh(refreshToken) {
  const result = await query(`
    SELECT
      rt.tenant_id,
      rt.user_id,
      t.slug,
      t.name AS tenant_name,
      t.status AS tenant_status,
      u.email,
      u.display_name,
      u.status AS user_status
    FROM tenant_refresh_tokens rt
    JOIN tenants t ON t.tenant_id = rt.tenant_id
    JOIN tenant_users u ON u.tenant_id = rt.tenant_id AND u.user_id = rt.user_id
    WHERE rt.token_hash = digest($1, 'sha256')
      AND rt.revoked_at IS NULL
      AND rt.expires_at > NOW()
    LIMIT 1
  `, [refreshToken]);

  const row = result.rows[0];
  if (!row || row.tenant_status !== "active" || row.user_status !== "active") {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const access = await tenantUsers.getEffectiveAccess(row.tenant_id, row.user_id);
  if (!access) throw new Error("INVALID_REFRESH_TOKEN");

  return {
    user: {
      userId: row.user_id,
      tenantId: row.tenant_id,
      tenantSlug: row.slug,
      tenantName: row.tenant_name,
      email: row.email,
      displayName: row.display_name
    },
    activeContext: contextFromAccess(access, row),
    contexts: await contextsForUser(row.email),
    accessToken: sign(tokenPayload(row))
  };
}

async function switchContext(user, { tenantId, tenantSlug } = {}) {
  if (user.scope !== "tenant" || !user.tenantId || !user.sub) {
    throw new Error("INVALID_TENANT_TOKEN");
  }
  if (!tenantId && !tenantSlug) throw new Error("TENANT_CONTEXT_REQUIRED");

  const current = await query(`
    SELECT email
    FROM tenant_users
    WHERE tenant_id = $1 AND user_id = $2 AND status = 'active'
    LIMIT 1
  `, [user.tenantId, user.sub]);
  const email = current.rows[0]?.email;
  if (!email) throw new Error("INVALID_TENANT_TOKEN");

  const result = await query(`
    SELECT
      t.tenant_id,
      t.slug,
      t.name AS tenant_name,
      t.status AS tenant_status,
      u.user_id,
      u.email,
      u.display_name,
      u.status AS user_status
    FROM tenants t
    JOIN tenant_users u ON u.tenant_id = t.tenant_id
    WHERE LOWER(u.email) = LOWER($1)
      AND (
        ($2::uuid IS NOT NULL AND t.tenant_id = $2::uuid)
        OR ($3::text IS NOT NULL AND LOWER(t.slug) = LOWER($3::text))
      )
    LIMIT 1
  `, [email, tenantId || null, tenantSlug || null]);

  const row = result.rows[0];
  if (!row) throw new Error("TENANT_CONTEXT_NOT_ALLOWED");
  if (row.tenant_status !== "active") throw new Error("TENANT_SUSPENDED");
  if (row.user_status !== "active") throw new Error("ACCOUNT_SUSPENDED");

  const access = await tenantUsers.getEffectiveAccess(row.tenant_id, row.user_id);
  if (!access) throw new Error("TENANT_CONTEXT_NOT_ALLOWED");

  const refreshToken = randomToken();
  await query(`
    INSERT INTO tenant_refresh_tokens (refresh_token_id, tenant_id, user_id, token_hash, expires_at, created_at)
    VALUES (gen_random_uuid(), $1, $2, digest($3, 'sha256'), NOW() + interval '30 days', NOW())
  `, [row.tenant_id, row.user_id, refreshToken]);

  return {
    user: {
      userId: row.user_id,
      tenantId: row.tenant_id,
      tenantSlug: row.slug,
      tenantName: row.tenant_name,
      email: row.email,
      displayName: row.display_name
    },
    activeContext: contextFromAccess(access, row),
    contexts: await contextsForUser(row.email),
    accessToken: sign(tokenPayload(row)),
    refreshToken
  };
}

async function logout(refreshToken) {
  await query(`
    UPDATE tenant_refresh_tokens
    SET revoked_at = NOW()
    WHERE token_hash = digest($1, 'sha256') AND revoked_at IS NULL
  `, [refreshToken]);
  return { revoked: true };
}

async function me(user) {
  if (user.scope !== "tenant" || !user.tenantId || !user.sub) {
    throw new Error("INVALID_TENANT_TOKEN");
  }
  const access = await tenantUsers.getEffectiveAccess(user.tenantId, user.sub);
  if (!access) throw new Error("INVALID_TENANT_TOKEN");
  return {
    user: {
      userId: access.user.user_id,
      tenantId: access.user.tenant_id,
      email: access.user.email,
      displayName: access.user.display_name,
      status: access.user.status
    },
    activeContext: {
      tenantId: access.user.tenant_id,
      userId: access.user.user_id,
      email: access.user.email,
      displayName: access.user.display_name,
      roles: access.roles,
      permissions: access.permissions,
      modules: access.modules
    },
    contexts: await contextsForUser(access.user.email)
  };
}

async function access(user) {
  if (user.scope !== "tenant" || !user.tenantId || !user.sub) {
    throw new Error("INVALID_TENANT_TOKEN");
  }
  const current = await tenantUsers.getEffectiveAccess(user.tenantId, user.sub);
  if (!current) throw new Error("INVALID_TENANT_TOKEN");
  return {
    roles: current.roles,
    permissions: current.permissions,
    modules: current.modules,
    contexts: await contextsForUser(current.user.email)
  };
}

module.exports = { login, refresh, logout, switchContext, me, access, findValidTenantContexts };
