-- Cleanup tenant catalog entries generated ahead of the current product scope.
-- ROOT catalog/data is intentionally untouched.

-- Experimental tenant tables created by unreconciled migrations and not backed by
-- current services/routes/UI. They are empty in local inventory before cleanup.
DROP TABLE IF EXISTS tenant_password_reset_tokens CASCADE;
DROP TABLE IF EXISTS tenant_login_attempts CASCADE;
DROP TABLE IF EXISTS tenant_invitations CASCADE;
DROP TABLE IF EXISTS tenant_incidents CASCADE;
DROP TABLE IF EXISTS tenant_communications CASCADE;
DROP TABLE IF EXISTS tenant_audit_events CASCADE;
DROP TABLE IF EXISTS tenant_attendance CASCADE;

-- Modules not implemented in the current Tenant Admin sidebar/routes/backend.
-- Keep ENROLLMENTS as an internal technical module for existing endpoints, but
-- hide it from role navigation below.
WITH unsupported(module_key) AS (
  VALUES
    ('PROFILE'),
    ('ACADEMIC'),
    ('GUARDIANS'),
    ('INVITATIONS'),
    ('AUDIT_LOGS'),
    ('ACTIVITIES'),
    ('ATTENDANCE'),
    ('SETTINGS'),
    ('INCIDENTS'),
    ('COMMUNICATIONS'),
    ('IMPORT'),
    ('AI'),
    ('ANALYTICS'),
    ('DASHBOARDS'),
    ('EXPORTS'),
    ('ANALYTICS_STUDENT')
)
DELETE FROM tenant_role_permissions trp
USING permissions p, unsupported u
WHERE trp.permission_code = p.permission_code
  AND p.scope = 'TENANT'
  AND p.module_key = u.module_key;

WITH unsupported(module_key) AS (
  VALUES
    ('PROFILE'),
    ('ACADEMIC'),
    ('GUARDIANS'),
    ('INVITATIONS'),
    ('AUDIT_LOGS'),
    ('ACTIVITIES'),
    ('ATTENDANCE'),
    ('SETTINGS'),
    ('INCIDENTS'),
    ('COMMUNICATIONS'),
    ('IMPORT'),
    ('AI'),
    ('ANALYTICS'),
    ('DASHBOARDS'),
    ('EXPORTS'),
    ('ANALYTICS_STUDENT')
)
DELETE FROM tenant_role_modules trm
USING unsupported u
WHERE trm.module_key = u.module_key;

WITH unsupported(module_key) AS (
  VALUES
    ('PROFILE'),
    ('ACADEMIC'),
    ('GUARDIANS'),
    ('INVITATIONS'),
    ('AUDIT_LOGS'),
    ('ACTIVITIES'),
    ('ATTENDANCE'),
    ('SETTINGS'),
    ('INCIDENTS'),
    ('COMMUNICATIONS'),
    ('IMPORT'),
    ('AI'),
    ('ANALYTICS'),
    ('DASHBOARDS'),
    ('EXPORTS'),
    ('ANALYTICS_STUDENT')
)
DELETE FROM tenant_modules tm
USING unsupported u
WHERE tm.module_key = u.module_key;

UPDATE permissions
SET module_key = 'ENROLLMENTS',
    action = 'read_history',
    description = 'Ver historico academico generado automaticamente.'
WHERE permission_code = 'academic_history.read'
  AND scope = 'TENANT';

WITH unsupported(module_key) AS (
  VALUES
    ('PROFILE'),
    ('ACADEMIC'),
    ('GUARDIANS'),
    ('INVITATIONS'),
    ('AUDIT_LOGS'),
    ('ACTIVITIES'),
    ('ATTENDANCE'),
    ('SETTINGS'),
    ('INCIDENTS'),
    ('COMMUNICATIONS'),
    ('IMPORT'),
    ('AI'),
    ('ANALYTICS'),
    ('DASHBOARDS'),
    ('EXPORTS'),
    ('ANALYTICS_STUDENT')
)
DELETE FROM permissions p
USING unsupported u
WHERE p.scope = 'TENANT'
  AND p.module_key = u.module_key;

WITH unsupported(module_key) AS (
  VALUES
    ('PROFILE'),
    ('ACADEMIC'),
    ('GUARDIANS'),
    ('INVITATIONS'),
    ('AUDIT_LOGS'),
    ('ACTIVITIES'),
    ('ATTENDANCE'),
    ('SETTINGS'),
    ('INCIDENTS'),
    ('COMMUNICATIONS'),
    ('IMPORT'),
    ('AI'),
    ('ANALYTICS'),
    ('DASHBOARDS'),
    ('EXPORTS'),
    ('ANALYTICS_STUDENT')
)
DELETE FROM module_scope_availability msa
USING unsupported u
WHERE msa.scope = 'TENANT'
  AND msa.module_key = u.module_key;

WITH unsupported(module_key) AS (
  VALUES
    ('PROFILE'),
    ('ACADEMIC'),
    ('GUARDIANS'),
    ('INVITATIONS'),
    ('AUDIT_LOGS'),
    ('ACTIVITIES'),
    ('ATTENDANCE'),
    ('SETTINGS'),
    ('INCIDENTS'),
    ('COMMUNICATIONS'),
    ('IMPORT'),
    ('AI'),
    ('ANALYTICS'),
    ('DASHBOARDS'),
    ('EXPORTS'),
    ('ANALYTICS_STUDENT')
)
UPDATE modules m
SET parent_module_key = NULL,
    updated_at = NOW()
FROM unsupported u
WHERE m.parent_module_key = u.module_key;

WITH unsupported(module_key) AS (
  VALUES
    ('PROFILE'),
    ('ACADEMIC'),
    ('GUARDIANS'),
    ('INVITATIONS'),
    ('AUDIT_LOGS'),
    ('ACTIVITIES'),
    ('ATTENDANCE'),
    ('SETTINGS'),
    ('INCIDENTS'),
    ('COMMUNICATIONS'),
    ('IMPORT'),
    ('AI'),
    ('ANALYTICS'),
    ('DASHBOARDS'),
    ('EXPORTS'),
    ('ANALYTICS_STUDENT')
)
DELETE FROM modules m
USING unsupported u
WHERE m.scope = 'TENANT'
  AND m.module_key = u.module_key;

-- Enrollment stays as internal backend support, not a visible navigation concept.
UPDATE tenant_role_modules
SET is_visible = FALSE
WHERE module_key = 'ENROLLMENTS';
