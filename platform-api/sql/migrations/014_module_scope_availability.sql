CREATE TABLE IF NOT EXISTS module_scope_availability (
  module_key varchar(60) NOT NULL REFERENCES modules(module_key) ON DELETE CASCADE,
  scope varchar(20) NOT NULL REFERENCES module_scopes(scope_code) ON DELETE CASCADE,
  global_enabled boolean NOT NULL DEFAULT TRUE,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (module_key, scope)
);

DROP TRIGGER IF EXISTS trg_enforce_tenant_module_scope ON tenant_modules;
DROP FUNCTION IF EXISTS enforce_tenant_module_scope();

INSERT INTO module_scope_availability (module_key, scope, global_enabled, display_order, created_at, updated_at)
SELECT module_key, scope, global_enabled, display_order, created_at, updated_at
FROM modules
ON CONFLICT (module_key, scope) DO UPDATE SET
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO modules (module_key, parent_module_key, scope, name, description, global_enabled, display_order, updated_at)
VALUES
  ('PROFILE', NULL, 'PUBLIC', 'Perfil', 'Perfil reutilizable para usuario publico y tenant.', TRUE, 5, NOW()),
  ('ACTIVITIES', NULL, 'PUBLIC', 'Actividades', 'Actividades reutilizables para publico, alumnos y tenants.', TRUE, 25, NOW())
ON CONFLICT (module_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO module_scope_availability (module_key, scope, global_enabled, display_order, updated_at)
VALUES
  ('PROFILE', 'PUBLIC', TRUE, 5, NOW()),
  ('PROFILE', 'TENANT', TRUE, 5, NOW()),
  ('ACTIVITIES', 'PUBLIC', TRUE, 25, NOW()),
  ('ACTIVITIES', 'TENANT', TRUE, 25, NOW()),
  ('AI_TUTOR', 'PUBLIC', TRUE, 70, NOW())
ON CONFLICT (module_key, scope) DO UPDATE SET
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

ALTER TABLE permissions
  DROP CONSTRAINT IF EXISTS permissions_module_key_scope_fkey;

ALTER TABLE permissions
  ADD CONSTRAINT permissions_module_scope_availability_fkey
  FOREIGN KEY (module_key, scope)
  REFERENCES module_scope_availability(module_key, scope)
  ON UPDATE CASCADE
  ON DELETE RESTRICT;

INSERT INTO permissions (permission_code, module_key, scope, action, description, created_at)
VALUES
  ('profile.read', 'PROFILE', 'TENANT', 'read', 'Ver perfil propio dentro de un tenant.', NOW()),
  ('profile.update', 'PROFILE', 'TENANT', 'update', 'Actualizar perfil propio dentro de un tenant.', NOW()),
  ('activities.read', 'ACTIVITIES', 'TENANT', 'read', 'Ver actividades del contexto tenant.', NOW()),
  ('activities.submit', 'ACTIVITIES', 'TENANT', 'submit', 'Entregar o completar actividades del contexto tenant.', NOW()),
  ('public_profile.read', 'PROFILE', 'PUBLIC', 'read', 'Ver perfil publico propio.', NOW()),
  ('public_profile.update', 'PROFILE', 'PUBLIC', 'update', 'Actualizar perfil publico propio.', NOW()),
  ('public_activities.read', 'ACTIVITIES', 'PUBLIC', 'read', 'Ver actividades publicas disponibles.', NOW()),
  ('public_activities.participate', 'ACTIVITIES', 'PUBLIC', 'participate', 'Participar en actividades publicas.', NOW()),
  ('public_ai_tutor.read', 'AI_TUTOR', 'PUBLIC', 'read', 'Usar tutor IA en contexto publico.', NOW())
ON CONFLICT (permission_code) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  scope = EXCLUDED.scope,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO tenant_modules (tenant_id, module_key, is_enabled, updated_at)
SELECT t.tenant_id, defaults.module_key, TRUE, NOW()
FROM tenants t
CROSS JOIN (
  VALUES
    ('PROFILE'),
    ('ACTIVITIES')
) AS defaults(module_key)
ON CONFLICT (tenant_id, module_key) DO NOTHING;

INSERT INTO tenant_role_modules (tenant_id, role_code, module_key, is_visible)
SELECT t.tenant_id, defaults.role_code, defaults.module_key, TRUE
FROM tenants t
CROSS JOIN (
  VALUES
    ('TENANT_ADMIN', 'PROFILE'),
    ('TENANT_ADMIN', 'ACTIVITIES'),
    ('TEACHER', 'PROFILE'),
    ('TEACHER', 'ACTIVITIES'),
    ('STUDENT', 'PROFILE'),
    ('STUDENT', 'ACTIVITIES'),
    ('GUARDIAN', 'PROFILE'),
    ('GUARDIAN', 'ACTIVITIES')
) AS defaults(role_code, module_key)
JOIN tenant_roles tr ON tr.tenant_id = t.tenant_id AND tr.code = defaults.role_code
ON CONFLICT (tenant_id, role_code, module_key) DO UPDATE SET
  is_visible = EXCLUDED.is_visible;

INSERT INTO tenant_role_permissions (tenant_id, role_code, permission_code)
SELECT t.tenant_id, defaults.role_code, defaults.permission_code
FROM tenants t
CROSS JOIN (
  VALUES
    ('TENANT_ADMIN', 'profile.read'),
    ('TENANT_ADMIN', 'profile.update'),
    ('TENANT_ADMIN', 'activities.read'),
    ('TENANT_ADMIN', 'activities.submit'),
    ('TEACHER', 'profile.read'),
    ('TEACHER', 'profile.update'),
    ('TEACHER', 'activities.read'),
    ('TEACHER', 'activities.submit'),
    ('STUDENT', 'profile.read'),
    ('STUDENT', 'profile.update'),
    ('STUDENT', 'activities.read'),
    ('STUDENT', 'activities.submit'),
    ('GUARDIAN', 'profile.read'),
    ('GUARDIAN', 'profile.update'),
    ('GUARDIAN', 'activities.read')
) AS defaults(role_code, permission_code)
JOIN tenant_roles tr ON tr.tenant_id = t.tenant_id AND tr.code = defaults.role_code
JOIN permissions p ON p.permission_code = defaults.permission_code AND p.scope = 'TENANT'
ON CONFLICT (tenant_id, role_code, permission_code) DO NOTHING;
