INSERT INTO permissions (permission_code, module_key, scope, action, description, created_at)
VALUES
  ('ai_tutor.use', 'AI_TUTOR', 'TENANT', 'use', 'Usar el tutor IA como profesor dentro del tenant activo.', NOW())
ON CONFLICT (permission_code) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  scope = EXCLUDED.scope,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

DELETE FROM tenant_role_modules
WHERE role_code = 'TENANT_ADMIN'
  AND module_key = 'AI_TUTOR';

DELETE FROM tenant_role_permissions
WHERE role_code = 'TENANT_ADMIN'
  AND permission_code IN ('ai_tutor.use', 'public_ai_tutor.read');

INSERT INTO tenant_role_modules (tenant_id, role_code, module_key, is_visible)
SELECT t.tenant_id, 'TEACHER', 'AI_TUTOR', TRUE
FROM tenants t
JOIN tenant_roles tr ON tr.tenant_id = t.tenant_id AND tr.code = 'TEACHER'
ON CONFLICT (tenant_id, role_code, module_key) DO UPDATE SET
  is_visible = TRUE;

INSERT INTO tenant_role_permissions (tenant_id, role_code, permission_code)
SELECT t.tenant_id, 'TEACHER', 'ai_tutor.use'
FROM tenants t
JOIN tenant_roles tr ON tr.tenant_id = t.tenant_id AND tr.code = 'TEACHER'
ON CONFLICT (tenant_id, role_code, permission_code) DO NOTHING;
