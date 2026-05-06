require("dotenv").config();

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

const expectedTables = {
  modules: { purpose: "Catalogo maestro de modulos ROOT/SUPPORT/TENANT.", empty: "error" },
  module_scopes: { purpose: "Catalogo normalizado de scopes de modulo.", empty: "error" },
  permissions: { purpose: "Catalogo unico de permisos con modulo/scope/action.", empty: "error" },
  tenants: { purpose: "Tenants/clientes.", empty: "warning" },
  tenant_modules: { purpose: "Activacion de modulos TENANT por tenant.", empty: "warning" },
  tenant_roles: { purpose: "Roles de tenant.", empty: "warning" },
  tenant_role_modules: { purpose: "Visibilidad de modulos por rol tenant.", empty: "warning" },
  tenant_role_permissions: { purpose: "Permisos por rol tenant.", empty: "warning" },
  tenant_users: { purpose: "Usuarios de tenant.", empty: "info" },
  tenant_refresh_tokens: { purpose: "Sesiones refresh token tenant.", empty: "ok" },
  user_tenant_roles: { purpose: "Asignacion usuarios tenant -> roles.", empty: "info" },
  platform_accounts: { purpose: "Cuentas ROOT/SUPPORT.", empty: "error" },
  platform_roles: { purpose: "Roles internos ROOT/SUPPORT.", empty: "error" },
  platform_role_permissions: { purpose: "Permisos por rol de plataforma.", empty: "error" },
  platform_role_assignments: { purpose: "Roles asignados a cuentas plataforma.", empty: "warning" },
  platform_account_permissions: { purpose: "Permisos directos por cuenta plataforma.", empty: "ok" },
  platform_refresh_tokens: { purpose: "Sesiones refresh token plataforma.", empty: "ok" },
  platform_password_reset_tokens: { purpose: "Tokens de recuperacion de password.", empty: "ok" },
  platform_login_attempts: { purpose: "Auditoria/rate-limit de login.", empty: "ok" },
  alerts: { purpose: "Alertas operativas y de seguridad con flujo de estados.", empty: "ok" },
  alert_events: { purpose: "Historial de transiciones y ocurrencias de alertas.", empty: "ok" },
  incident_notes: { purpose: "Notas operativas para investigacion, mitigacion y cierre.", empty: "ok" },
  platform_alert_events: { purpose: "Alertas de plataforma.", empty: "ok" },
  platform_alert_deliveries: { purpose: "Entregas email/telegram/whatsapp de alertas.", empty: "ok" },
  audit_logs: { purpose: "Auditoria forense unificada preparada para particionamiento.", empty: "ok" },
  audit_log_outbox: { purpose: "Outbox simple para desacoplar eventos auditados.", empty: "ok" },
  platform_audit_events: { purpose: "Auditoria de cambios criticos de plataforma.", empty: "ok" },
  platform_services: { purpose: "Catalogo de servicios controlados/observados.", empty: "warning" },
  platform_service_actions: { purpose: "Historico de acciones de servicios.", empty: "ok" }
};

const legacyTables = [
  "platform_modules",
  "platform_permissions"
];

function isManagedExtraTable(table) {
  return table === "schema_migrations" || /^audit_logs_\d{6}$/.test(table);
}

function qIdent(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function one(sql, params) {
  const result = await pool.query(sql, params);
  return result.rows[0] || {};
}

async function rows(sql, params) {
  const result = await pool.query(sql, params);
  return result.rows;
}

function addFinding(findings, severity, code, message, details = {}) {
  findings.push({ severity, code, message, details });
}

async function tableExists(table) {
  const result = await one("SELECT to_regclass($1) IS NOT NULL AS exists", [`public.${table}`]);
  return Boolean(result.exists);
}

async function tableCount(table) {
  const result = await one(`SELECT COUNT(*)::int AS count FROM ${qIdent(table)}`);
  return Number(result.count || 0);
}

async function collectTables(findings) {
  const actual = await rows(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const actualSet = new Set(actual.map((row) => row.table_name));
  const tables = [];

  for (const [table, meta] of Object.entries(expectedTables)) {
    if (!actualSet.has(table)) {
      addFinding(findings, "error", "missing_table", `Falta la tabla esperada ${table}.`, { table, purpose: meta.purpose });
      tables.push({ table, exists: false, rows: null, emptyPolicy: meta.empty, purpose: meta.purpose });
      continue;
    }

    const count = await tableCount(table);
    tables.push({ table, exists: true, rows: count, emptyPolicy: meta.empty, purpose: meta.purpose });

    if (count === 0 && meta.empty === "error") {
      addFinding(findings, "error", "empty_required_table", `La tabla ${table} esta vacia y deberia tener datos base.`, { table });
    } else if (count === 0 && meta.empty === "warning") {
      addFinding(findings, "warning", "empty_expected_later", `La tabla ${table} esta vacia; puede ser normal en desarrollo, pero hay que revisarlo antes de produccion.`, { table });
    }
  }

  for (const table of legacyTables) {
    if (actualSet.has(table)) {
      addFinding(findings, "error", "legacy_table_present", `La tabla legacy ${table} sigue existiendo y no deberia.`, { table });
    }
  }

  const undocumented = actual
    .map((row) => row.table_name)
    .filter((table) => !expectedTables[table] && !legacyTables.includes(table) && !isManagedExtraTable(table));
  for (const table of undocumented) {
    addFinding(findings, "info", "undocumented_table", `La tabla ${table} no esta documentada en el mapa de auditoria.`, { table });
  }

  return { tables, undocumented };
}

async function collectConstraints(findings) {
  const constraints = await rows(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      tc.constraint_type,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints tc
    LEFT JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    LEFT JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
     AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema = 'public'
    ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name, kcu.ordinal_position
  `);

  const requiredFkChecks = [
    { table: "modules", column: "scope", foreignTable: "module_scopes" },
    { table: "permissions", column: "module_key", foreignTable: "modules" },
    { table: "tenant_modules", column: "tenant_id", foreignTable: "tenants" },
    { table: "tenant_modules", column: "module_key", foreignTable: "modules" },
    { table: "tenant_role_modules", column: "module_key", foreignTable: "modules" },
    { table: "tenant_role_permissions", column: "permission_code", foreignTable: "permissions" },
    { table: "user_tenant_roles", column: "user_id", foreignTable: "tenant_users" },
    { table: "platform_role_permissions", column: "permission_code", foreignTable: "permissions" },
    { table: "platform_account_permissions", column: "permission_code", foreignTable: "permissions" }
  ];

  for (const check of requiredFkChecks) {
    const exists = constraints.some((constraint) =>
      constraint.constraint_type === "FOREIGN KEY" &&
      constraint.table_name === check.table &&
      constraint.column_name === check.column &&
      constraint.foreign_table_name === check.foreignTable
    );
    if (!exists) {
      addFinding(findings, "warning", "missing_expected_fk", `No se encontro FK esperada: ${check.table}.${check.column} -> ${check.foreignTable}.`, check);
    }
  }

  return constraints;
}

async function collectIndexes(findings) {
  const indexes = await rows(`
    SELECT tablename, indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `);
  const indexNames = new Set(indexes.map((row) => row.indexname));
  const expectedIndexes = [
    "idx_modules_scope_parent_order",
    "idx_tenant_modules_tenant_enabled",
    "idx_platform_service_actions_service_created",
    "idx_audit_logs_event_occurred",
    "idx_audit_logs_actor_occurred",
    "idx_platform_audit_events_type_created",
    "idx_platform_audit_events_actor_created"
  ];

  for (const index of expectedIndexes) {
    if (!indexNames.has(index)) {
      addFinding(findings, "warning", "missing_expected_index", `No se encontro indice esperado ${index}.`, { index });
    }
  }

  return indexes;
}

async function collectIntegrity(findings) {
  const checks = {};
  const countChecks = {
    duplicatePlatformModulesTable: "SELECT CASE WHEN to_regclass('public.platform_modules') IS NULL THEN 0 ELSE 1 END::int AS count",
    duplicatePlatformPermissionsTable: "SELECT CASE WHEN to_regclass('public.platform_permissions') IS NULL THEN 0 ELSE 1 END::int AS count",
    invalidTenantModuleScopes: `
      SELECT COUNT(*)::int AS count
      FROM tenant_modules tm
      JOIN modules m ON m.module_key = tm.module_key
      WHERE m.scope <> 'TENANT'
    `,
    permissionScopeMismatch: `
      SELECT COUNT(*)::int AS count
      FROM permissions p
      JOIN modules m ON m.module_key = p.module_key
      WHERE p.scope <> m.scope
    `,
    permissionsWithoutModule: `
      SELECT COUNT(*)::int AS count
      FROM permissions p
      LEFT JOIN modules m ON m.module_key = p.module_key
      WHERE m.module_key IS NULL
    `,
    modulesWithMissingParent: `
      SELECT COUNT(*)::int AS count
      FROM modules child
      LEFT JOIN modules parent ON parent.module_key = child.parent_module_key
      WHERE child.parent_module_key IS NOT NULL AND parent.module_key IS NULL
    `,
    tenantRoleModulesWithoutRole: `
      SELECT COUNT(*)::int AS count
      FROM tenant_role_modules trm
      LEFT JOIN tenant_roles tr ON tr.tenant_id = trm.tenant_id AND tr.code = trm.role_code
      WHERE tr.role_id IS NULL
    `,
    tenantRolePermissionsWithoutRole: `
      SELECT COUNT(*)::int AS count
      FROM tenant_role_permissions trp
      LEFT JOIN tenant_roles tr ON tr.tenant_id = trp.tenant_id AND tr.code = trp.role_code
      WHERE tr.role_id IS NULL
    `,
    userTenantRolesWithoutUser: `
      SELECT COUNT(*)::int AS count
      FROM user_tenant_roles utr
      LEFT JOIN tenant_users u ON u.tenant_id = utr.tenant_id AND u.user_id = utr.user_id
      WHERE u.user_id IS NULL
    `,
    platformRolePermissionsWithoutRole: `
      SELECT COUNT(*)::int AS count
      FROM platform_role_permissions prp
      LEFT JOIN platform_roles pr ON pr.role_id = prp.role_id
      WHERE pr.role_id IS NULL
    `,
    platformRolePermissionsWithoutPermission: `
      SELECT COUNT(*)::int AS count
      FROM platform_role_permissions prp
      LEFT JOIN permissions p ON p.permission_code = prp.permission_code
      WHERE p.permission_code IS NULL
    `,
    platformAssignmentsWithoutAccount: `
      SELECT COUNT(*)::int AS count
      FROM platform_role_assignments pra
      LEFT JOIN platform_accounts pa ON pa.platform_account_id = pra.platform_account_id
      WHERE pa.platform_account_id IS NULL
    `,
    platformAssignmentsWithoutRole: `
      SELECT COUNT(*)::int AS count
      FROM platform_role_assignments pra
      LEFT JOIN platform_roles pr ON pr.role_id = pra.role_id
      WHERE pr.role_id IS NULL
    `,
    alertDeliveriesWithoutAlert: `
      SELECT COUNT(*)::int AS count
      FROM platform_alert_deliveries d
      LEFT JOIN alerts a ON a.alert_id = d.alert_id
      WHERE a.alert_id IS NULL
    `,
    serviceActionsWithoutService: `
      SELECT COUNT(*)::int AS count
      FROM platform_service_actions a
      LEFT JOIN platform_services s ON s.service_key = a.service_key
      WHERE s.service_key IS NULL
    `
  };

  for (const [key, sql] of Object.entries(countChecks)) {
    const result = await one(sql);
    checks[key] = Number(result.count || 0);
    if (checks[key] > 0) {
      addFinding(findings, key.includes("duplicate") ? "error" : "warning", key, `Check ${key} devolvio ${checks[key]}.`, { count: checks[key] });
    }
  }

  const duplicateChecks = {
    duplicateModuleKeys: "SELECT module_key, COUNT(*)::int AS count FROM modules GROUP BY module_key HAVING COUNT(*) > 1",
    duplicatePermissionCodes: "SELECT permission_code, COUNT(*)::int AS count FROM permissions GROUP BY permission_code HAVING COUNT(*) > 1",
    duplicateTenantRoles: "SELECT tenant_id, code, COUNT(*)::int AS count FROM tenant_roles GROUP BY tenant_id, code HAVING COUNT(*) > 1",
    duplicatePlatformRoleCodes: "SELECT code, COUNT(*)::int AS count FROM platform_roles GROUP BY code HAVING COUNT(*) > 1",
    duplicatePlatformAccountsEmails: "SELECT lower(email) AS email, COUNT(*)::int AS count FROM platform_accounts GROUP BY lower(email) HAVING COUNT(*) > 1"
  };

  const duplicates = {};
  for (const [key, sql] of Object.entries(duplicateChecks)) {
    duplicates[key] = await rows(sql);
    if (duplicates[key].length > 0) {
      addFinding(findings, "error", key, `Hay duplicados en ${key}.`, { rows: duplicates[key] });
    }
  }

  return { checks, duplicates };
}

async function collectBreakdowns() {
  const safe = async (sql) => rows(sql).catch(() => []);
  return {
    modulesByScope: await safe("SELECT scope, COUNT(*)::int AS count FROM modules GROUP BY scope ORDER BY scope"),
    permissionsByScope: await safe("SELECT scope, COUNT(*)::int AS count FROM permissions GROUP BY scope ORDER BY scope"),
    tenantModulesByScope: await safe(`
      SELECT m.scope, COUNT(*)::int AS count
      FROM tenant_modules tm
      JOIN modules m ON m.module_key = tm.module_key
      GROUP BY m.scope
      ORDER BY m.scope
    `),
    tenantRolesByCode: await safe("SELECT code, COUNT(*)::int AS count FROM tenant_roles GROUP BY code ORDER BY code"),
    platformRoles: await safe("SELECT code, status, is_protected FROM platform_roles ORDER BY code"),
    serviceStatus: await safe("SELECT status, COUNT(*)::int AS count FROM platform_services GROUP BY status ORDER BY status"),
    alertStatus: await safe("SELECT status, COUNT(*)::int AS count FROM alerts GROUP BY status ORDER BY status")
  };
}

async function main() {
  const startedAt = new Date();
  const findings = [];
  await pool.query("SELECT 1");

  const [tables, constraints, indexes, integrity, breakdowns, triggers] = await Promise.all([
    collectTables(findings),
    collectConstraints(findings),
    collectIndexes(findings),
    collectIntegrity(findings),
    collectBreakdowns(),
    rows(`
      SELECT event_object_table AS table_name, trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `)
  ]);

  const summary = {
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    checkedAt: startedAt.toISOString(),
    tables: tables.tables.length,
    findings: {
      error: findings.filter((item) => item.severity === "error").length,
      warning: findings.filter((item) => item.severity === "warning").length,
      info: findings.filter((item) => item.severity === "info").length
    },
    status: findings.some((item) => item.severity === "error")
      ? "FAIL"
      : findings.some((item) => item.severity === "warning")
        ? "WARN"
        : "OK"
  };

  const report = {
    summary,
    findings,
    tables: tables.tables,
    undocumentedTables: tables.undocumented,
    breakdowns,
    integrity,
    triggers,
    constraints,
    indexes
  };

  console.log(JSON.stringify(report, null, 2));

  if (summary.findings.error > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
