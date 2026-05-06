INSERT INTO modules (module_key, parent_module_key, scope, name, description, global_enabled, display_order, updated_at)
VALUES
  ('TENANT_ADMIN', NULL, 'TENANT', 'Administracion tenant', 'Gestion operativa del propio centro.', TRUE, 15, NOW())
ON CONFLICT (module_key) DO UPDATE SET
  parent_module_key = EXCLUDED.parent_module_key,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO module_scope_availability (module_key, scope, global_enabled, display_order, updated_at)
VALUES ('TENANT_ADMIN', 'TENANT', TRUE, 15, NOW())
ON CONFLICT (module_key, scope) DO UPDATE SET
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO permissions (permission_code, module_key, scope, action, description, created_at)
VALUES
  ('tenant_users.read', 'TENANT_ADMIN', 'TENANT', 'read', 'Ver usuarios del tenant activo.', NOW()),
  ('tenant_users.manage', 'TENANT_ADMIN', 'TENANT', 'manage', 'Crear, actualizar y asignar roles a usuarios del tenant activo.', NOW()),
  ('tenant_settings.read', 'TENANT_ADMIN', 'TENANT', 'read_settings', 'Ver configuracion del tenant activo.', NOW()),
  ('tenant_settings.update', 'TENANT_ADMIN', 'TENANT', 'update_settings', 'Actualizar configuracion del tenant activo.', NOW())
ON CONFLICT (permission_code) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  scope = EXCLUDED.scope,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO tenant_modules (tenant_id, module_key, is_enabled, updated_at)
SELECT tenant_id, 'TENANT_ADMIN', TRUE, NOW()
FROM tenants
ON CONFLICT (tenant_id, module_key) DO NOTHING;

INSERT INTO tenant_role_modules (tenant_id, role_code, module_key, is_visible)
SELECT t.tenant_id, 'TENANT_ADMIN', 'TENANT_ADMIN', TRUE
FROM tenants t
JOIN tenant_roles tr ON tr.tenant_id = t.tenant_id AND tr.code = 'TENANT_ADMIN'
ON CONFLICT (tenant_id, role_code, module_key) DO UPDATE SET
  is_visible = EXCLUDED.is_visible;

INSERT INTO tenant_role_permissions (tenant_id, role_code, permission_code)
SELECT t.tenant_id, 'TENANT_ADMIN', p.permission_code
FROM tenants t
JOIN tenant_roles tr ON tr.tenant_id = t.tenant_id AND tr.code = 'TENANT_ADMIN'
JOIN permissions p ON p.permission_code IN (
  'tenant_users.read',
  'tenant_users.manage',
  'tenant_settings.read',
  'tenant_settings.update'
)
ON CONFLICT (tenant_id, role_code, permission_code) DO NOTHING;
