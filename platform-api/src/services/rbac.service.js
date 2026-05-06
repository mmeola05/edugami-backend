const { query, transaction } = require("../config/db");
const realtime = require("../realtime");
const audit = require("./audit.service");

const PROTECTED_ROLES = ["root-super-admin", "support-ops"];
const CRITICAL_ROOT_PERMISSIONS = [
  "dashboard.read",
  "rbac.read",
  "rbac.manage",
  "platform_modules.read",
  "platform_modules.manage"
];

async function overview() {
  const [roles, permissions, rolePermissions] = await Promise.all([
    query(`SELECT role_id, code, name, status, is_protected, created_at FROM platform_roles ORDER BY code`),
    query(`
      SELECT
        p.permission_code AS permission_id,
        p.permission_code AS code,
        p.description,
        TRUE AS is_core,
        p.created_at,
        p.module_key,
        p.scope,
        p.action,
        m.name AS module_name
      FROM permissions p
      JOIN modules m ON m.module_key = p.module_key
      WHERE p.scope IN ('ROOT', 'SUPPORT')
      ORDER BY p.scope, m.display_order, p.permission_code
    `),
    query(`
      SELECT r.role_id, r.code AS role_code, p.permission_code AS permission_id, p.permission_code
      FROM platform_role_permissions rp
      JOIN platform_roles r ON r.role_id = rp.role_id
      JOIN permissions p ON p.permission_code = rp.permission_code
      ORDER BY r.code, p.permission_code
    `)
  ]);
  return { roles: roles.rows, permissions: permissions.rows, rolePermissions: rolePermissions.rows, protectedRoleCodes: PROTECTED_ROLES };
}

async function listRoles() {
  const result = await query(`SELECT role_id, code, name, status, is_protected, created_at FROM platform_roles ORDER BY code`);
  return result.rows;
}

async function getRole(roleId, client = { query }) {
  const roleResult = await client.query(`SELECT role_id, code, name, status, is_protected, created_at FROM platform_roles WHERE role_id=$1 LIMIT 1`, [roleId]);
  const role = roleResult.rows[0];
  if (!role) return null;

  const permissions = await client.query(`
    SELECT
      p.permission_code AS permission_id,
      p.permission_code AS code,
      p.description,
      TRUE AS is_core,
      p.module_key,
      p.scope,
      p.action,
      m.name AS module_name
    FROM permissions p
    JOIN platform_role_permissions rp ON rp.permission_code = p.permission_code
    JOIN modules m ON m.module_key = p.module_key
    WHERE rp.role_id = $1
    ORDER BY p.scope, m.display_order, p.permission_code
  `, [roleId]);

  return { ...role, permissions: permissions.rows };
}

async function activeRootAccountsWithCriticalAccess(client = { query }) {
  const result = await client.query(`
    SELECT pa.platform_account_id, array_agg(DISTINCT p.permission_code) FILTER (WHERE p.permission_code IS NOT NULL) AS permissions
    FROM platform_accounts pa
    LEFT JOIN platform_role_assignments ra ON ra.platform_account_id = pa.platform_account_id
    LEFT JOIN platform_roles r ON r.role_id = ra.role_id AND r.status = 'active'
    LEFT JOIN platform_role_permissions rp ON rp.role_id = r.role_id
    LEFT JOIN platform_account_permissions ap ON ap.platform_account_id = pa.platform_account_id
    LEFT JOIN permissions p ON p.permission_code = rp.permission_code OR p.permission_code = ap.permission_code
    WHERE pa.role = 'ROOT' AND pa.status = 'active'
    GROUP BY pa.platform_account_id
  `);

  return result.rows.filter((row) => {
    const permissions = row.permissions || [];
    return permissions.includes("*") || CRITICAL_ROOT_PERMISSIONS.every((code) => permissions.includes(code));
  });
}

async function assertRootAdministrationRemains(client = { query }) {
  const roots = await activeRootAccountsWithCriticalAccess(client);
  if (roots.length === 0) throw new Error("LAST_ROOT_ACCESS_BLOCKED");
}

async function createRole(data, meta = {}) {
  const result = await query(`
    INSERT INTO platform_roles (role_id, code, name, status, is_protected, created_at)
    VALUES (gen_random_uuid(), $1, $2, $3, false, NOW())
    RETURNING role_id, code, name, status, is_protected, created_at
  `, [data.code, data.name, data.status]);
  const role = result.rows[0];
  await audit.record({
    actor: meta.actor,
    eventType: "platform_role_created",
    entityType: "platform_role",
    entityId: role.role_id,
    action: "create",
    after: role,
    context: meta.context || {},
    moduleKey: "RBAC"
  });
  return role;
}

async function updateRole(roleId, data, meta = {}) {
  const before = await getRole(roleId);
  if (!before) return null;
  if (before.is_protected && data.code && data.code !== before.code) throw new Error("PROTECTED_ROLE_CODE");

  const after = await transaction(async (client) => {
    const result = await client.query(`
      UPDATE platform_roles
      SET code = $2, name = $3, status = $4
      WHERE role_id = $1
      RETURNING role_id, code, name, status, is_protected, created_at
    `, [roleId, data.code || before.code, data.name || before.name, data.status || before.status]);
    await assertRootAdministrationRemains(client);
    return result.rows[0];
  });

  await audit.record({
    actor: meta.actor,
    eventType: "platform_role_updated",
    entityType: "platform_role",
    entityId: roleId,
    action: "update",
    before,
    after,
    context: meta.context || {},
    moduleKey: "RBAC"
  });
  return after;
}

async function deleteRole(roleId, meta = {}) {
  const before = await getRole(roleId);
  if (!before) return { deleted: false };
  if (before.is_protected) throw new Error("PROTECTED_ROLE");

  const result = await transaction(async (client) => {
    await client.query(`DELETE FROM platform_role_permissions WHERE role_id=$1`, [roleId]);
    await client.query(`DELETE FROM platform_role_assignments WHERE role_id=$1`, [roleId]);
    const deleted = await client.query(`DELETE FROM platform_roles WHERE role_id=$1 RETURNING role_id`, [roleId]);
    await assertRootAdministrationRemains(client);
    return { deleted: deleted.rowCount > 0 };
  });

  await audit.record({
    actor: meta.actor,
    eventType: "platform_role_deleted",
    entityType: "platform_role",
    entityId: roleId,
    action: "delete",
    before,
    context: meta.context || {},
    moduleKey: "RBAC"
  });
  return result;
}

async function setRolePermissions(roleId, codes, meta = {}) {
  const before = await getRole(roleId);
  if (!before) return null;

  const role = await transaction(async (client) => {
    await client.query(`DELETE FROM platform_role_permissions WHERE role_id=$1`, [roleId]);
    const perms = await client.query(`SELECT permission_code FROM permissions WHERE scope IN ('ROOT', 'SUPPORT') AND permission_code = ANY($1::text[])`, [codes]);
    for (const row of perms.rows) {
      await client.query(`INSERT INTO platform_role_permissions (role_id, permission_code, created_at) VALUES ($1, $2, NOW())`, [roleId, row.permission_code]);
    }
    await assertRootAdministrationRemains(client);
    return getRole(roleId, client);
  });

  await audit.record({
    actor: meta.actor,
    eventType: "platform_role_permissions_updated",
    entityType: "platform_role",
    entityId: roleId,
    action: "set_permissions",
    before,
    after: role,
    metadata: {
      requestedPermissionCodes: codes,
      criticalRootPermissions: CRITICAL_ROOT_PERMISSIONS
    },
    context: meta.context || {},
    moduleKey: "RBAC"
  });

  realtime.publishRootEvent("platform_role_permissions_updated", { roleId, roleCode: role.code });
  realtime.publishRootEvent("access_policy_changed", { scope: "platform", roleId, reason: "platform_role_permissions_updated" });
  return role;
}

async function getAccountRbac(accountId) {
  const roles = await query(`
    SELECT r.role_id, r.code, r.name
    FROM platform_roles r
    JOIN platform_role_assignments ra ON ra.role_id = r.role_id
    WHERE ra.platform_account_id = $1
    ORDER BY r.code
  `, [accountId]);
  const direct = await query(`
    SELECT p.permission_code AS permission_id, p.permission_code AS code, p.description, TRUE AS is_core
    FROM permissions p
    JOIN platform_account_permissions ap ON ap.permission_code = p.permission_code
    WHERE ap.platform_account_id = $1
    ORDER BY p.permission_code
  `, [accountId]);
  const effective = await query(`
    SELECT DISTINCT p.permission_code
    FROM permissions p
    LEFT JOIN platform_role_permissions rp ON rp.permission_code = p.permission_code
    LEFT JOIN platform_role_assignments ra ON ra.role_id = rp.role_id
    LEFT JOIN platform_account_permissions ap ON ap.permission_code = p.permission_code
    WHERE ra.platform_account_id = $1 OR ap.platform_account_id = $1
    ORDER BY p.permission_code
  `, [accountId]);
  return { roles: roles.rows, directPermissions: direct.rows, effectivePermissions: effective.rows.map((row) => row.permission_code) };
}

async function assignRole(accountId, roleId, meta = {}) {
  const before = await getAccountRbac(accountId);
  await query(`INSERT INTO platform_role_assignments (assignment_id, platform_account_id, role_id, created_at) VALUES (gen_random_uuid(), $1, $2, NOW()) ON CONFLICT (platform_account_id, role_id) DO NOTHING`, [accountId, roleId]);
  const data = await getAccountRbac(accountId);

  await audit.record({
    actor: meta.actor,
    eventType: "platform_account_role_assigned",
    entityType: "platform_account",
    entityId: accountId,
    action: "assign_role",
    before,
    after: data,
    metadata: { roleId },
    context: meta.context || {},
    moduleKey: "RBAC"
  });

  realtime.publishRootEvent("platform_account_rbac_updated", { accountId, reason: "role_assigned" });
  realtime.publishRootEvent("access_policy_changed", { scope: "platform", accountId, reason: "role_assigned" });
  return data;
}

async function revokeRole(accountId, roleId, meta = {}) {
  const role = await getRole(roleId);
  if (role?.is_protected) throw new Error("PROTECTED_ROLE");
  const before = await getAccountRbac(accountId);

  await transaction(async (client) => {
    await client.query(`DELETE FROM platform_role_assignments WHERE platform_account_id=$1 AND role_id=$2`, [accountId, roleId]);
    await assertRootAdministrationRemains(client);
  });
  const data = await getAccountRbac(accountId);

  await audit.record({
    actor: meta.actor,
    eventType: "platform_account_role_revoked",
    entityType: "platform_account",
    entityId: accountId,
    action: "revoke_role",
    before,
    after: data,
    metadata: { roleId },
    context: meta.context || {},
    moduleKey: "RBAC"
  });

  realtime.publishRootEvent("platform_account_rbac_updated", { accountId, reason: "role_revoked" });
  realtime.publishRootEvent("access_policy_changed", { scope: "platform", accountId, reason: "role_revoked" });
  return data;
}

async function setDirectPermissions(accountId, codes, meta = {}) {
  const before = await getAccountRbac(accountId);

  await transaction(async (client) => {
    await client.query(`DELETE FROM platform_account_permissions WHERE platform_account_id=$1`, [accountId]);
    const perms = await client.query(`SELECT permission_code FROM permissions WHERE scope IN ('ROOT', 'SUPPORT') AND permission_code = ANY($1::text[])`, [codes]);
    for (const row of perms.rows) {
      await client.query(`INSERT INTO platform_account_permissions (account_permission_id, platform_account_id, permission_code, created_at) VALUES (gen_random_uuid(), $1, $2, NOW())`, [accountId, row.permission_code]);
    }
    await assertRootAdministrationRemains(client);
  });
  const data = await getAccountRbac(accountId);

  await audit.record({
    actor: meta.actor,
    eventType: "platform_account_direct_permissions_updated",
    entityType: "platform_account",
    entityId: accountId,
    action: "set_direct_permissions",
    before,
    after: data,
    metadata: { requestedPermissionCodes: codes },
    context: meta.context || {},
    moduleKey: "RBAC"
  });

  realtime.publishRootEvent("platform_account_rbac_updated", { accountId, reason: "direct_permissions_updated" });
  realtime.publishRootEvent("access_policy_changed", { scope: "platform", accountId, reason: "direct_permissions_updated" });
  return data;
}

module.exports = {
  overview,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  setRolePermissions,
  getAccountRbac,
  assignRole,
  revokeRole,
  setDirectPermissions,
  CRITICAL_ROOT_PERMISSIONS
};
