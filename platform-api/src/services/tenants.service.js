const { query, transaction } = require("../config/db");
const realtime = require("../realtime");

const DEFAULT_MODULES = [
  "ACADEMIC",
  "PERIODS",
  "CLASSES",
  "STUDENTS",
  "TEACHERS",
  "COURSES",
  "ENROLLMENTS",
  "TEACHER_ASSIGNMENTS",
  "TENANT_ADMIN",
  "PROFILE",
  "ACTIVITIES",
  "AI",
  "AI_TUTOR",
  "ANALYTICS",
  "REPORTS"
];

async function list(filters = {}) {
  let sql = `
    SELECT tenant_id, name, slug, tenant_type, timezone, status, created_at, updated_at
    FROM tenants
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    params.push(filters.status);
    sql += ` AND status = $${params.length}`;
  }

  if (filters.type) {
    params.push(filters.type);
    sql += ` AND tenant_type = $${params.length}`;
  }

  if (filters.search) {
    params.push(`%${filters.search}%`);
    sql += ` AND (name ILIKE $${params.length} OR slug ILIKE $${params.length})`;
  }

  sql += ` ORDER BY created_at DESC`;

  const result = await query(sql, params);
  return result.rows;
}

async function detail(tenantId) {
  const result = await query(`
    SELECT tenant_id, name, slug, tenant_type, timezone, status, created_at, updated_at
    FROM tenants
    WHERE tenant_id = $1
    LIMIT 1
  `, [tenantId]);
  return result.rows[0] || null;
}

async function create(data) {
  const result = await transaction(async (client) => {
    const insert = await client.query(`
      INSERT INTO tenants (tenant_id, name, slug, tenant_type, timezone, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING tenant_id, name, slug, tenant_type, timezone, status, created_at, updated_at
    `, [data.name, data.slug, data.tenantType || 'SCHOOL', data.timezone || 'Europe/Madrid', data.status || 'active']);

    // Seed modules
    for (const moduleKey of DEFAULT_MODULES) {
      await client.query(`
        INSERT INTO tenant_modules (tenant_id, module_key, is_enabled, updated_at)
        VALUES ($1, $2, true, NOW())
        ON CONFLICT (tenant_id, module_key) DO NOTHING
      `, [insert.rows[0].tenant_id, moduleKey]);
    }

    return insert.rows[0];
  });

  realtime.publishRootEvent("tenant_created", result);
  return result;
}

async function update(tenantId, data) {
  const current = await detail(tenantId);
  if (!current) return null;

  const result = await query(`
    UPDATE tenants
    SET name = $2, slug = $3, tenant_type = $4, timezone = $5, status = $6, updated_at = NOW()
    WHERE tenant_id = $1
    RETURNING tenant_id, name, slug, tenant_type, timezone, status, created_at, updated_at
  `, [
    tenantId,
    data.name || current.name,
    data.slug || current.slug,
    data.tenantType || current.tenant_type,
    data.timezone || current.timezone || 'Europe/Madrid',
    data.status || current.status
  ]);

  realtime.publishRootEvent("tenant_updated", result.rows[0]);
  return result.rows[0];
}

async function suspend(tenantId) {
  const result = await transaction(async (client) => {
    const update = await client.query(`
      UPDATE tenants
      SET status = 'suspended', updated_at = NOW()
      WHERE tenant_id = $1
      RETURNING tenant_id, name, slug, tenant_type, timezone, status, created_at, updated_at
    `, [tenantId]);

    if (!update.rows[0]) return null;

    await client.query(`
      UPDATE tenant_modules
      SET is_enabled = false, updated_at = NOW()
      WHERE tenant_id = $1
    `, [tenantId]);

    return update.rows[0];
  });

  if (result) realtime.publishRootEvent("tenant_suspended", result);
  return result;
}

async function listModules(tenantId) {
  const result = await query(`
    SELECT
      tm.tenant_id,
      tm.module_key,
      m.parent_module_key,
      m.name,
      m.description,
      msa.global_enabled,
      tm.is_enabled,
      (tm.is_enabled AND msa.global_enabled AND COALESCE(parent_msa.global_enabled, TRUE) AND COALESCE(parent_tm.is_enabled, TRUE)) AS effective_enabled,
      CASE
        WHEN msa.global_enabled = FALSE THEN 'GLOBAL_DISABLED'
        WHEN parent_msa.global_enabled = FALSE THEN 'PARENT_GLOBAL_DISABLED'
        WHEN parent_tm.is_enabled = FALSE THEN 'PARENT_TENANT_DISABLED'
        WHEN tm.is_enabled = FALSE THEN 'TENANT_DISABLED'
        ELSE NULL
      END AS disabled_reason,
      tm.updated_at
    FROM tenant_modules tm
    JOIN modules m ON m.module_key = tm.module_key
    JOIN module_scope_availability msa ON msa.module_key = m.module_key AND msa.scope = 'TENANT'
    LEFT JOIN modules parent ON parent.module_key = m.parent_module_key
    LEFT JOIN module_scope_availability parent_msa ON parent_msa.module_key = parent.module_key AND parent_msa.scope = 'TENANT'
    LEFT JOIN tenant_modules parent_tm ON parent_tm.tenant_id = tm.tenant_id AND parent_tm.module_key = m.parent_module_key
    WHERE tm.tenant_id = $1
    ORDER BY msa.display_order, tm.module_key
  `, [tenantId]);
  return result.rows;
}

async function listEffectiveModules(tenantId) {
  const rows = await listModules(tenantId);
  const byKey = new Map(rows.map((item) => [item.module_key, { ...item, children: [] }]));
  const roots = [];

  for (const item of byKey.values()) {
    if (item.parent_module_key && byKey.has(item.parent_module_key)) {
      byKey.get(item.parent_module_key).children.push(item);
    } else {
      roots.push(item);
    }
  }

  roots.sort((a, b) => String(a.module_key).localeCompare(String(b.module_key)));
  for (const item of byKey.values()) {
    item.children.sort((a, b) => String(a.module_key).localeCompare(String(b.module_key)));
  }

  return {
    tenantId,
    modules: roots
  };
}

async function setModules(tenantId, modules) {
  const moduleKeys = [...new Set(modules.map((item) => item.moduleKey))];
  const catalog = await query(`
    SELECT module_key
    FROM module_scope_availability
    WHERE scope = 'TENANT' AND module_key = ANY($1::varchar[])
  `, [moduleKeys]);
  const validKeys = new Set(catalog.rows.map((row) => row.module_key));
  const invalidKeys = moduleKeys.filter((moduleKey) => !validKeys.has(moduleKey));

  if (invalidKeys.length > 0) {
    const error = new Error('INVALID_TENANT_MODULE');
    error.invalidKeys = invalidKeys;
    throw error;
  }

  for (const item of modules) {
    await query(`
      INSERT INTO tenant_modules (tenant_id, module_key, is_enabled, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (tenant_id, module_key)
      DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW()
    `, [tenantId, item.moduleKey, item.isEnabled]);
  }

  const data = await listModules(tenantId);
  realtime.publishRootEvent("tenant_modules_updated", { tenantId, modules: data });
  realtime.publishRootEvent("tenant_access_policy_changed", { tenantId, reason: "tenant_modules_updated" });
  return data;
}

async function listTenantRoles(tenantId) {
  const roles = await query(`
    SELECT role_id, tenant_id, code, name, is_system, created_at, updated_at
    FROM tenant_roles
    WHERE tenant_id = $1
    ORDER BY
      CASE code
        WHEN 'TENANT_ADMIN' THEN 1
        WHEN 'TEACHER' THEN 2
        WHEN 'STUDENT' THEN 3
        ELSE 99
      END,
      code
  `, [tenantId]);

  const modules = await query(`
    SELECT trm.role_code, trm.module_key, trm.is_visible, m.parent_module_key, m.name, msa.display_order
    FROM tenant_role_modules trm
    JOIN modules m ON m.module_key = trm.module_key
    JOIN module_scope_availability msa ON msa.module_key = m.module_key AND msa.scope = 'TENANT'
    WHERE trm.tenant_id = $1
    ORDER BY trm.role_code, msa.display_order, trm.module_key
  `, [tenantId]);

  const permissions = await query(`
    SELECT trp.role_code, trp.permission_code, p.module_key, p.action, p.description, m.name AS module_name, msa.display_order
    FROM tenant_role_permissions trp
    JOIN permissions p ON p.permission_code = trp.permission_code
    JOIN modules m ON m.module_key = p.module_key
    JOIN module_scope_availability msa ON msa.module_key = p.module_key AND msa.scope = p.scope
    WHERE trp.tenant_id = $1
    ORDER BY trp.role_code, msa.display_order, trp.permission_code
  `, [tenantId]);

  return roles.rows.map((role) => ({
    ...role,
    modules: modules.rows.filter((item) => item.role_code === role.code),
    permissions: permissions.rows.filter((item) => item.role_code === role.code)
  }));
}

async function getTenantRole(tenantId, roleCode) {
  const roles = await listTenantRoles(tenantId);
  return roles.find((role) => role.code === roleCode) || null;
}

async function setTenantRoleAccess(tenantId, roleCode, data) {
  const moduleKeys = [...new Set(data.moduleKeys.map((item) => String(item).trim()).filter(Boolean))];
  const permissionCodes = [...new Set(data.permissionCodes.map((item) => String(item).trim()).filter(Boolean))];
  const role = await getTenantRole(tenantId, roleCode);
  if (!role) return null;

  const moduleResult = await query(`
    SELECT module_key
    FROM module_scope_availability
    WHERE scope = 'TENANT' AND module_key = ANY($1::varchar[])
  `, [moduleKeys]);
  const validModules = new Set(moduleResult.rows.map((row) => row.module_key));
  const invalidModules = moduleKeys.filter((moduleKey) => !validModules.has(moduleKey));
  if (invalidModules.length > 0) {
    const error = new Error("INVALID_TENANT_MODULE");
    error.invalidKeys = invalidModules;
    throw error;
  }

  const permissionResult = await query(`
    SELECT permission_code
    FROM permissions
    WHERE scope = 'TENANT' AND permission_code = ANY($1::varchar[])
  `, [permissionCodes]);
  const validPermissions = new Set(permissionResult.rows.map((row) => row.permission_code));
  const invalidPermissions = permissionCodes.filter((permissionCode) => !validPermissions.has(permissionCode));
  if (invalidPermissions.length > 0) {
    const error = new Error("INVALID_TENANT_PERMISSION");
    error.invalidPermissions = invalidPermissions;
    throw error;
  }

  await transaction(async (client) => {
    await client.query(`DELETE FROM tenant_role_modules WHERE tenant_id = $1 AND role_code = $2`, [tenantId, roleCode]);
    for (const moduleKey of moduleKeys) {
      await client.query(`
        INSERT INTO tenant_role_modules (tenant_id, role_code, module_key, is_visible)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (tenant_id, role_code, module_key)
        DO UPDATE SET is_visible = TRUE
      `, [tenantId, roleCode, moduleKey]);
    }

    await client.query(`DELETE FROM tenant_role_permissions WHERE tenant_id = $1 AND role_code = $2`, [tenantId, roleCode]);
    for (const permissionCode of permissionCodes) {
      await client.query(`
        INSERT INTO tenant_role_permissions (tenant_id, role_code, permission_code)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [tenantId, roleCode, permissionCode]);
    }
  });

  const updated = await getTenantRole(tenantId, roleCode);
  realtime.publishRootEvent("tenant_role_access_updated", { tenantId, roleCode, role: updated });
  realtime.publishRootEvent("tenant_access_policy_changed", { tenantId, roleCode, reason: "tenant_role_access_updated" });
  return updated;
}

async function getSettings(tenantId) {
  const [tenant, settings] = await Promise.all([
    detail(tenantId),
    query(`SELECT academic_policies, branding FROM tenant_settings WHERE tenant_id = $1`, [tenantId])
  ]);
  
  const settingsRow = settings.rows[0] || { academic_policies: {}, branding: {} };
  return {
    ...tenant,
    academicPolicies: settingsRow.academic_policies,
    branding: settingsRow.branding
  };
}

async function updateSettings(tenantId, data) {
  return await transaction(async (client) => {
    const current = await detail(tenantId);
    
    // Update main tenant info
    await client.query(`
      UPDATE tenants 
      SET name = $2, slug = $3, timezone = $4, updated_at = NOW()
      WHERE tenant_id = $1
    `, [tenantId, data.name || current.name, data.slug || current.slug, data.timezone || current.timezone]);

    // Update extended settings
    if (data.academicPolicies || data.branding) {
      const existing = await client.query(`SELECT 1 FROM tenant_settings WHERE tenant_id = $1`, [tenantId]);
      if (existing.rows.length) {
        await client.query(`
          UPDATE tenant_settings 
          SET academic_policies = COALESCE($2, academic_policies), 
              branding = COALESCE($3, branding), 
              updated_at = NOW()
          WHERE tenant_id = $1
        `, [tenantId, data.academicPolicies, data.branding]);
      } else {
        await client.query(`
          INSERT INTO tenant_settings (tenant_id, academic_policies, branding)
          VALUES ($1, $2, $3)
        `, [tenantId, data.academicPolicies || {}, data.branding || {}]);
      }
    }

    return getSettings(tenantId);
  });
}

module.exports = { 
  list, detail, create, update, suspend, 
  listModules, listEffectiveModules, setModules, 
  listTenantRoles, getTenantRole, setTenantRoleAccess,
  getSettings, updateSettings
};
