const { query } = require("../config/db");
const realtime = require("../realtime");
const audit = require("./audit.service");

const CRITICAL_ROOT_MODULES = new Set([
  "ROOT_DASHBOARD",
  "RBAC",
  "GLOBAL_MODULES"
]);

async function list() {
  const result = await query(`
    SELECT
      module_key,
      parent_module_key,
      scope,
      name,
      description,
      global_enabled AS is_enabled,
      display_order,
      updated_at,
      COALESCE(scopes.available_scopes, '[]'::json) AS available_scopes
    FROM modules
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'scope', msa.scope,
          'isEnabled', msa.global_enabled,
          'displayOrder', msa.display_order
        )
        ORDER BY msa.scope
      ) AS available_scopes
      FROM module_scope_availability msa
      WHERE msa.module_key = modules.module_key
    ) scopes ON TRUE
    ORDER BY scope, display_order, module_key
  `);
  return result.rows;
}

async function getModule(moduleKey) {
  const result = await query(`
    SELECT
      module_key,
      parent_module_key,
      scope,
      name,
      description,
      global_enabled AS is_enabled,
      display_order,
      updated_at
    FROM modules
    WHERE module_key = $1
    LIMIT 1
  `, [moduleKey]);
  return result.rows[0] || null;
}

function assertCriticalModuleCanChange(module, isEnabled) {
  if (isEnabled) return;
  if (module?.scope === "ROOT" && CRITICAL_ROOT_MODULES.has(module.module_key)) {
    throw new Error("CRITICAL_MODULE_DISABLE_BLOCKED");
  }
}

async function update(moduleKey, isEnabled, meta = {}) {
  const before = await getModule(moduleKey);
  assertCriticalModuleCanChange(before || { module_key: moduleKey, scope: "ROOT" }, isEnabled);

  const result = await query(`
    WITH upsert_module AS (
      INSERT INTO modules (module_key, scope, name, global_enabled, updated_at)
      VALUES ($1, 'ROOT', $1, $2, NOW())
      ON CONFLICT (module_key)
      DO UPDATE SET global_enabled = EXCLUDED.global_enabled, updated_at = NOW()
      RETURNING module_key, parent_module_key, scope, name, description, global_enabled, display_order, updated_at
    ),
    upsert_scope AS (
      INSERT INTO module_scope_availability (module_key, scope, global_enabled, display_order, updated_at)
      SELECT module_key, scope, $2, display_order, NOW()
      FROM upsert_module
      ON CONFLICT (module_key, scope)
      DO UPDATE SET global_enabled = EXCLUDED.global_enabled, updated_at = NOW()
      RETURNING module_key, scope, global_enabled
    )
    SELECT
      m.module_key,
      m.parent_module_key,
      s.scope,
      m.name,
      m.description,
      s.global_enabled AS is_enabled,
      m.display_order,
      m.updated_at
    FROM upsert_module m
    JOIN upsert_scope s ON s.module_key = m.module_key
  `, [moduleKey, isEnabled]);

  const data = result.rows[0];

  await audit.record({
    actor: meta.actor,
    eventType: "platform_module_updated",
    entityType: "module",
    entityId: data.module_key,
    action: isEnabled ? "enable" : "disable",
    before,
    after: data,
    metadata: {
      critical: data.scope === "ROOT" && CRITICAL_ROOT_MODULES.has(data.module_key),
      reason: meta.reason || null
    },
    context: meta.context || {},
    moduleKey: "GLOBAL_MODULES"
  });

  realtime.publishRootEvent("platform_module_updated", data);
  realtime.publishRootEvent("access_policy_changed", { scope: data.scope, moduleKey: data.module_key, isEnabled: data.is_enabled });
  return data;
}

module.exports = { list, update, CRITICAL_ROOT_MODULES };
