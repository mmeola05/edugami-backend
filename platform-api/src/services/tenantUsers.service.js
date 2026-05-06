const { query, transaction } = require("../config/db");
const { hashPassword } = require("../utils/password");
const realtime = require("../realtime");
const tenants = require("./tenants.service");

function normalizeRoleCodes(roleCodes = []) {
  return [...new Set(roleCodes.map((roleCode) => String(roleCode).trim()).filter(Boolean))];
}

async function assertRolesExist(client, tenantId, roleCodes) {
  if (roleCodes.length === 0) return;
  const result = await client.query(`
    SELECT code
    FROM tenant_roles
    WHERE tenant_id = $1 AND code = ANY($2::varchar[])
  `, [tenantId, roleCodes]);
  const found = new Set(result.rows.map((row) => row.code));
  const missing = roleCodes.filter((roleCode) => !found.has(roleCode));
  if (missing.length > 0) {
    const error = new Error("INVALID_TENANT_ROLE");
    error.invalidRoles = missing;
    throw error;
  }
}

async function list(tenantId) {
  const result = await query(`
    SELECT
      u.user_id,
      u.tenant_id,
      u.email,
      u.display_name,
      u.status,
      u.created_at,
      u.updated_at,
      COALESCE(
        json_agg(
          json_build_object('code', r.code, 'name', r.name)
          ORDER BY r.code
        ) FILTER (WHERE r.code IS NOT NULL),
        '[]'::json
      ) AS roles
    FROM tenant_users u
    LEFT JOIN user_tenant_roles utr
      ON utr.tenant_id = u.tenant_id AND utr.user_id = u.user_id
    LEFT JOIN tenant_roles r
      ON r.tenant_id = utr.tenant_id AND r.code = utr.role_code
    WHERE u.tenant_id = $1
    GROUP BY u.user_id
    ORDER BY u.created_at DESC
  `, [tenantId]);
  return result.rows;
}

async function detail(tenantId, userId) {
  const users = await query(`
    SELECT user_id, tenant_id, email, display_name, status, created_at, updated_at
    FROM tenant_users
    WHERE tenant_id = $1 AND user_id = $2
    LIMIT 1
  `, [tenantId, userId]);
  const user = users.rows[0];
  if (!user) return null;

  const roles = await query(`
    SELECT r.role_id, r.code, r.name, r.is_system
    FROM user_tenant_roles utr
    JOIN tenant_roles r ON r.tenant_id = utr.tenant_id AND r.code = utr.role_code
    WHERE utr.tenant_id = $1 AND utr.user_id = $2
    ORDER BY r.code
  `, [tenantId, userId]);

  return { ...user, roles: roles.rows };
}

async function create(tenantId, data) {
  const roleCodes = normalizeRoleCodes(data.roleCodes);
  const result = await transaction(async (client) => {
    await assertRolesExist(client, tenantId, roleCodes);
    const passwordHash = await hashPassword(data.password);

    const insert = await client.query(`
      INSERT INTO tenant_users (user_id, tenant_id, email, password_hash, display_name, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, LOWER($2), $3, $4, $5, NOW(), NOW())
      RETURNING user_id, tenant_id, email, display_name, status, created_at, updated_at
    `, [tenantId, data.email, passwordHash, data.displayName, data.status || "active"]);

    for (const roleCode of roleCodes) {
      await client.query(`
        INSERT INTO user_tenant_roles (tenant_id, user_id, role_code)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [tenantId, insert.rows[0].user_id, roleCode]);
    }

    return insert.rows[0];
  });

  realtime.publishRootEvent("tenant_user_created", { tenantId, user: result });
  realtime.publishRootEvent("tenant_access_policy_changed", { tenantId, userId: result.user_id, reason: "tenant_user_created" });
  return detail(tenantId, result.user_id);
}

async function update(tenantId, userId, data) {
  const current = await detail(tenantId, userId);
  if (!current) return null;

  const result = await transaction(async (client) => {
    const update = await client.query(`
      UPDATE tenant_users
      SET display_name = $3, status = $4, updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2
      RETURNING user_id, tenant_id, email, display_name, status, created_at, updated_at
    `, [
      tenantId,
      userId,
      data.displayName || current.display_name,
      data.status || current.status
    ]);

    if (Array.isArray(data.roleCodes)) {
      const roleCodes = normalizeRoleCodes(data.roleCodes);
      await assertRolesExist(client, tenantId, roleCodes);
      await client.query(`DELETE FROM user_tenant_roles WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
      for (const roleCode of roleCodes) {
        await client.query(`
          INSERT INTO user_tenant_roles (tenant_id, user_id, role_code)
          VALUES ($1, $2, $3)
          ON CONFLICT DO NOTHING
        `, [tenantId, userId, roleCode]);
      }
    }

    if (data.status === "suspended") {
      await client.query(`
        UPDATE tenant_refresh_tokens
        SET revoked_at = NOW()
        WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL
      `, [tenantId, userId]);
    }

    return update.rows[0];
  });

  realtime.publishRootEvent("tenant_user_updated", { tenantId, user: result });
  realtime.publishRootEvent("tenant_access_policy_changed", { tenantId, userId, reason: "tenant_user_updated" });
  return detail(tenantId, userId);
}

async function setRoles(tenantId, userId, roleCodesInput) {
  const roleCodes = normalizeRoleCodes(roleCodesInput);
  const user = await detail(tenantId, userId);
  if (!user) return null;

  await transaction(async (client) => {
    await assertRolesExist(client, tenantId, roleCodes);
    await client.query(`DELETE FROM user_tenant_roles WHERE tenant_id = $1 AND user_id = $2`, [tenantId, userId]);
    for (const roleCode of roleCodes) {
      await client.query(`
        INSERT INTO user_tenant_roles (tenant_id, user_id, role_code)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [tenantId, userId, roleCode]);
    }
    await client.query(`
      UPDATE tenant_refresh_tokens
      SET revoked_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2 AND revoked_at IS NULL
    `, [tenantId, userId]);
  });

  realtime.publishRootEvent("tenant_user_roles_updated", { tenantId, userId, roleCodes });
  realtime.publishRootEvent("tenant_access_policy_changed", { tenantId, userId, reason: "tenant_user_roles_updated" });
  return detail(tenantId, userId);
}

async function getEffectiveAccess(tenantId, userId) {
  const user = await detail(tenantId, userId);
  if (!user || user.status !== "active") return null;

  const roleCodes = user.roles.map((role) => role.code);
  if (roleCodes.length === 0) {
    return { user, roles: [], permissions: [], modules: [] };
  }

  const allModules = await tenants.listModules(tenantId);
  const effectiveKeys = new Set(allModules.filter((item) => item.effective_enabled).map((item) => item.module_key));

  const visibleModules = await query(`
    SELECT DISTINCT trm.module_key
    FROM tenant_role_modules trm
    WHERE trm.tenant_id = $1
      AND trm.role_code = ANY($2::varchar[])
      AND trm.is_visible = TRUE
  `, [tenantId, roleCodes]);
  const byModuleKey = new Map(allModules.map((item) => [item.module_key, item]));
  const visibleKeys = new Set();
  for (const row of visibleModules.rows) {
    let moduleKey = row.module_key;
    while (moduleKey && byModuleKey.has(moduleKey)) {
      visibleKeys.add(moduleKey);
      moduleKey = byModuleKey.get(moduleKey).parent_module_key;
    }
  }

  const modules = allModules.filter((item) => effectiveKeys.has(item.module_key) && visibleKeys.has(item.module_key));
  const permissionResult = await query(`
    SELECT DISTINCT p.permission_code, p.module_key, p.scope, p.action, p.description
    FROM tenant_role_permissions trp
    JOIN permissions p ON p.permission_code = trp.permission_code
    WHERE trp.tenant_id = $1
      AND trp.role_code = ANY($2::varchar[])
    ORDER BY p.permission_code
  `, [tenantId, roleCodes]);
  const permissions = permissionResult.rows.filter((item) => effectiveKeys.has(item.module_key));

  return {
    user,
    roles: user.roles,
    permissions: permissions.map((item) => item.permission_code),
    permissionDetails: permissions,
    modules
  };
}

module.exports = { list, detail, create, update, setRoles, getEffectiveAccess };
