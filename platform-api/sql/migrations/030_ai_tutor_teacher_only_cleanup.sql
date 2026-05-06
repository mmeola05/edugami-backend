DELETE FROM tenant_role_modules
WHERE module_key = 'AI_TUTOR'
  AND role_code <> 'TEACHER';

DELETE FROM tenant_role_permissions trp
USING permissions p
WHERE trp.permission_code = p.permission_code
  AND p.module_key = 'AI_TUTOR'
  AND p.scope = 'TENANT'
  AND trp.role_code <> 'TEACHER';

INSERT INTO tenant_role_modules (tenant_id, role_code, module_key, is_visible)
SELECT t.tenant_id, 'TEACHER', 'AI_TUTOR', TRUE
FROM tenants t
ON CONFLICT (tenant_id, role_code, module_key) DO UPDATE SET is_visible = TRUE;

INSERT INTO tenant_role_permissions (tenant_id, role_code, permission_code)
SELECT t.tenant_id, 'TEACHER', p.permission_code
FROM tenants t
JOIN permissions p ON p.permission_code IN ('ai_tutor.read', 'ai_tutor.use')
WHERE p.scope = 'TENANT'
ON CONFLICT (tenant_id, role_code, permission_code) DO NOTHING;
