CREATE TABLE IF NOT EXISTS tenant_academic_periods (
  period_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name varchar(140) NOT NULL,
  code varchar(60) NOT NULL,
  period_type varchar(30) NOT NULL DEFAULT 'school_year' CHECK (period_type IN ('school_year', 'term', 'evaluation', 'custom')),
  starts_at date NULL,
  ends_at date NULL,
  status varchar(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'closed', 'archived')),
  is_default boolean NOT NULL DEFAULT FALSE,
  created_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, period_id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_tenant_academic_period_default
  ON tenant_academic_periods (tenant_id)
  WHERE is_default = TRUE;

CREATE TABLE IF NOT EXISTS tenant_class_enrollments (
  enrollment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  period_id uuid NULL,
  starts_at date NULL,
  ends_at date NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'suspended', 'cancelled')),
  is_primary boolean NOT NULL DEFAULT FALSE,
  created_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, enrollment_id),
  UNIQUE (tenant_id, student_id, class_id, period_id),
  FOREIGN KEY (tenant_id, student_id) REFERENCES tenant_students(tenant_id, student_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, class_id) REFERENCES tenant_classes(tenant_id, class_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, period_id) REFERENCES tenant_academic_periods(tenant_id, period_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_subject_enrollments (
  enrollment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  class_id uuid NULL,
  period_id uuid NULL,
  starts_at date NULL,
  ends_at date NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'completed', 'dropped', 'suspended', 'cancelled')),
  created_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, enrollment_id),
  UNIQUE (tenant_id, student_id, subject_id, class_id, period_id),
  FOREIGN KEY (tenant_id, student_id) REFERENCES tenant_students(tenant_id, student_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, subject_id) REFERENCES tenant_subjects(tenant_id, subject_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, class_id) REFERENCES tenant_classes(tenant_id, class_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, period_id) REFERENCES tenant_academic_periods(tenant_id, period_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_teacher_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  teacher_user_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  period_id uuid NULL,
  assignment_role varchar(40) NOT NULL DEFAULT 'lead',
  starts_at date NULL,
  ends_at date NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('planned', 'active', 'completed', 'suspended', 'cancelled')),
  created_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, assignment_id),
  UNIQUE (tenant_id, teacher_user_id, class_id, subject_id, period_id, assignment_role),
  FOREIGN KEY (tenant_id, teacher_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, class_id) REFERENCES tenant_classes(tenant_id, class_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, subject_id) REFERENCES tenant_subjects(tenant_id, subject_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, period_id) REFERENCES tenant_academic_periods(tenant_id, period_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_academic_periods_status
  ON tenant_academic_periods (tenant_id, status, starts_at);

CREATE INDEX IF NOT EXISTS idx_tenant_class_enrollments_student
  ON tenant_class_enrollments (tenant_id, student_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_class_enrollments_class
  ON tenant_class_enrollments (tenant_id, class_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_subject_enrollments_student
  ON tenant_subject_enrollments (tenant_id, student_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_subject_enrollments_subject
  ON tenant_subject_enrollments (tenant_id, subject_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_teacher_assignments_teacher
  ON tenant_teacher_assignments (tenant_id, teacher_user_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_teacher_assignments_class_subject
  ON tenant_teacher_assignments (tenant_id, class_id, subject_id, status);

INSERT INTO tenant_academic_periods (tenant_id, name, code, period_type, status, is_default, created_at, updated_at)
SELECT tenant_id, 'Curso 2025-2026', '2025-2026', 'school_year', 'active', TRUE, NOW(), NOW()
FROM tenants
ON CONFLICT (tenant_id, code) DO UPDATE SET
  status = EXCLUDED.status,
  is_default = TRUE,
  updated_at = NOW();

INSERT INTO modules (module_key, parent_module_key, scope, name, description, global_enabled, display_order, updated_at)
VALUES
  ('PERIODS', 'ACADEMIC', 'TENANT', 'Periodos academicos', 'Cursos, trimestres, evaluaciones y calendario academico.', TRUE, 2, NOW()),
  ('ENROLLMENTS', 'ACADEMIC', 'TENANT', 'Matriculas', 'Matriculas de alumnos en clases y asignaturas con historico.', TRUE, 6, NOW()),
  ('TEACHER_ASSIGNMENTS', 'ACADEMIC', 'TENANT', 'Asignaciones docentes', 'Relacion profesor, clase, asignatura y periodo academico.', TRUE, 7, NOW())
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
  ('PERIODS', 'TENANT', TRUE, 2, NOW()),
  ('ENROLLMENTS', 'TENANT', TRUE, 6, NOW()),
  ('TEACHER_ASSIGNMENTS', 'TENANT', TRUE, 7, NOW())
ON CONFLICT (module_key, scope) DO UPDATE SET
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO permissions (permission_code, module_key, scope, action, description, created_at)
VALUES
  ('periods.read', 'PERIODS', 'TENANT', 'read', 'Ver periodos academicos del tenant activo.', NOW()),
  ('periods.create', 'PERIODS', 'TENANT', 'create', 'Crear periodos academicos.', NOW()),
  ('periods.update', 'PERIODS', 'TENANT', 'update', 'Actualizar periodos academicos.', NOW()),
  ('enrollments.read', 'ENROLLMENTS', 'TENANT', 'read', 'Ver matriculas academicas.', NOW()),
  ('enrollments.manage', 'ENROLLMENTS', 'TENANT', 'manage', 'Gestionar matriculas academicas.', NOW()),
  ('teacher_assignments.read', 'TEACHER_ASSIGNMENTS', 'TENANT', 'read', 'Ver asignaciones docentes.', NOW()),
  ('teacher_assignments.manage', 'TEACHER_ASSIGNMENTS', 'TENANT', 'manage', 'Gestionar asignaciones docentes.', NOW())
ON CONFLICT (permission_code) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  scope = EXCLUDED.scope,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO tenant_modules (tenant_id, module_key, is_enabled, updated_at)
SELECT t.tenant_id, m.module_key, TRUE, NOW()
FROM tenants t
CROSS JOIN (VALUES ('PERIODS'), ('ENROLLMENTS'), ('TEACHER_ASSIGNMENTS')) AS m(module_key)
ON CONFLICT (tenant_id, module_key) DO NOTHING;

INSERT INTO tenant_role_modules (tenant_id, role_code, module_key, is_visible)
SELECT t.tenant_id, 'TENANT_ADMIN', m.module_key, TRUE
FROM tenants t
JOIN tenant_roles tr ON tr.tenant_id = t.tenant_id AND tr.code = 'TENANT_ADMIN'
CROSS JOIN (VALUES ('PERIODS'), ('ENROLLMENTS'), ('TEACHER_ASSIGNMENTS')) AS m(module_key)
ON CONFLICT (tenant_id, role_code, module_key) DO UPDATE SET
  is_visible = EXCLUDED.is_visible;

INSERT INTO tenant_role_permissions (tenant_id, role_code, permission_code)
SELECT t.tenant_id, 'TENANT_ADMIN', p.permission_code
FROM tenants t
JOIN tenant_roles tr ON tr.tenant_id = t.tenant_id AND tr.code = 'TENANT_ADMIN'
JOIN permissions p ON p.permission_code IN (
  'periods.read',
  'periods.create',
  'periods.update',
  'enrollments.read',
  'enrollments.manage',
  'teacher_assignments.read',
  'teacher_assignments.manage'
)
ON CONFLICT (tenant_id, role_code, permission_code) DO NOTHING;
