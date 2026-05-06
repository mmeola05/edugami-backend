-- Tenant Academic v2 foundations.
-- Non destructive: keeps periods/enrollments, adds active-period rules and automatic history.

WITH ranked_active AS (
  SELECT
    period_id,
    tenant_id,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id
      ORDER BY is_default DESC, starts_at DESC NULLS LAST, created_at DESC
    ) AS rn
  FROM tenant_academic_periods
  WHERE status = 'active'
)
UPDATE tenant_academic_periods p
SET status = 'planned',
    is_default = FALSE,
    updated_at = NOW()
FROM ranked_active r
WHERE p.tenant_id = r.tenant_id
  AND p.period_id = r.period_id
  AND r.rn > 1;

UPDATE tenant_academic_periods
SET is_default = FALSE,
    updated_at = NOW()
WHERE is_default = TRUE
  AND status <> 'active';

UPDATE tenant_academic_periods
SET is_default = TRUE,
    updated_at = NOW()
WHERE status = 'active'
  AND is_default = FALSE;

UPDATE tenant_academic_periods p
SET status = 'active',
    is_default = TRUE,
    updated_at = NOW()
WHERE p.period_id = (
  SELECT p2.period_id
  FROM tenant_academic_periods p2
  WHERE p2.tenant_id = p.tenant_id
  ORDER BY p2.is_default DESC, p2.starts_at DESC NULLS LAST, p2.created_at DESC
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1
  FROM tenant_academic_periods active
  WHERE active.tenant_id = p.tenant_id
    AND active.status = 'active'
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_academic_period_one_active
  ON tenant_academic_periods (tenant_id)
  WHERE status = 'active';

ALTER TABLE tenant_classes
  ADD COLUMN IF NOT EXISTS period_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_classes_period_fkey'
  ) THEN
    ALTER TABLE tenant_classes
      ADD CONSTRAINT tenant_classes_period_fkey
      FOREIGN KEY (tenant_id, period_id)
      REFERENCES tenant_academic_periods(tenant_id, period_id)
      ON DELETE SET NULL;
  END IF;
END $$;

UPDATE tenant_classes c
SET period_id = p.period_id,
    updated_at = NOW()
FROM tenant_academic_periods p
WHERE p.tenant_id = c.tenant_id
  AND p.status = 'active'
  AND c.period_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_classes_period_status
  ON tenant_classes (tenant_id, period_id, status, name);

CREATE TABLE IF NOT EXISTS tenant_academic_history_events (
  history_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  period_id uuid NULL,
  event_type varchar(80) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id uuid NOT NULL,
  student_id uuid NULL,
  class_id uuid NULL,
  subject_id uuid NULL,
  teacher_user_id uuid NULL,
  previous_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid NULL,
  occurred_at timestamptz NOT NULL DEFAULT NOW(),
  FOREIGN KEY (tenant_id, period_id) REFERENCES tenant_academic_periods(tenant_id, period_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, student_id) REFERENCES tenant_students(tenant_id, student_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, class_id) REFERENCES tenant_classes(tenant_id, class_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, subject_id) REFERENCES tenant_subjects(tenant_id, subject_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, teacher_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, actor_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_academic_history_student
  ON tenant_academic_history_events (tenant_id, student_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_academic_history_entity
  ON tenant_academic_history_events (tenant_id, entity_type, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_academic_history_period
  ON tenant_academic_history_events (tenant_id, period_id, occurred_at DESC);

INSERT INTO modules (module_key, parent_module_key, scope, name, description, global_enabled, display_order, updated_at)
VALUES
  ('ACADEMIC', NULL, 'TENANT', 'Academico', 'Gestion academica del centro.', TRUE, 10, NOW()),
  ('STUDENTS', 'ACADEMIC', 'TENANT', 'Alumnos', 'Alumnos, perfiles academicos y relaciones internas.', TRUE, 14, NOW())
ON CONFLICT (module_key) DO UPDATE SET
  parent_module_key = EXCLUDED.parent_module_key,
  scope = EXCLUDED.scope,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO module_scope_availability (module_key, scope, global_enabled, display_order, updated_at)
VALUES
  ('ACADEMIC', 'TENANT', TRUE, 10, NOW()),
  ('STUDENTS', 'TENANT', TRUE, 14, NOW()),
  ('TEACHER_ASSIGNMENTS', 'TENANT', TRUE, 17, NOW())
ON CONFLICT (module_key, scope) DO UPDATE SET
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO permissions (permission_code, module_key, scope, action, description, created_at)
VALUES
  ('academic_history.read', 'ACADEMIC', 'TENANT', 'read_history', 'Ver historico academico generado automaticamente.', NOW()),
  ('students.move', 'STUDENTS', 'TENANT', 'move', 'Mover alumnos entre clases usando el periodo activo.', NOW()),
  ('students.assign_subjects', 'STUDENTS', 'TENANT', 'assign_subjects', 'Asignar asignaturas a alumnos usando el periodo activo.', NOW()),
  ('teacher_assignments.assign', 'TEACHER_ASSIGNMENTS', 'TENANT', 'assign', 'Asignar profesores a clase/asignatura usando el periodo activo.', NOW())
ON CONFLICT (permission_code) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  scope = EXCLUDED.scope,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO tenant_role_permissions (tenant_id, role_code, permission_code)
SELECT t.tenant_id, 'TENANT_ADMIN', p.permission_code
FROM tenants t
JOIN tenant_roles tr ON tr.tenant_id = t.tenant_id AND tr.code = 'TENANT_ADMIN'
JOIN permissions p ON p.permission_code IN (
  'academic_history.read',
  'students.move',
  'students.assign_subjects',
  'teacher_assignments.assign'
)
ON CONFLICT (tenant_id, role_code, permission_code) DO NOTHING;
