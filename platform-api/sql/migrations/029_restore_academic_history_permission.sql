INSERT INTO permissions (permission_code, module_key, scope, action, description, created_at)
VALUES (
  'academic_history.read',
  'ENROLLMENTS',
  'TENANT',
  'read_history',
  'Ver historico academico generado automaticamente.',
  NOW()
)
ON CONFLICT (permission_code) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  scope = EXCLUDED.scope,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO tenant_role_permissions (tenant_id, role_code, permission_code)
SELECT t.tenant_id, 'TENANT_ADMIN', 'academic_history.read'
FROM tenants t
ON CONFLICT (tenant_id, role_code, permission_code) DO NOTHING;
