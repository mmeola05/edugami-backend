CREATE TABLE IF NOT EXISTS tenant_classes (
  class_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name varchar(140) NOT NULL,
  code varchar(60) NULL,
  level varchar(80) NULL,
  academic_year varchar(20) NOT NULL DEFAULT '2025-2026',
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, class_id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_subjects (
  subject_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  name varchar(140) NOT NULL,
  code varchar(60) NULL,
  stage varchar(80) NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, subject_id),
  UNIQUE (tenant_id, code),
  FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_students (
  student_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  full_name varchar(180) NOT NULL,
  preferred_name varchar(120) NULL,
  external_ref varchar(120) NULL,
  primary_class_id uuid NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, student_id),
  UNIQUE (tenant_id, external_ref),
  FOREIGN KEY (tenant_id, primary_class_id) REFERENCES tenant_classes(tenant_id, class_id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, created_by_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tenant_student_classes (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  academic_year varchar(20) NOT NULL DEFAULT '2025-2026',
  is_primary boolean NOT NULL DEFAULT FALSE,
  starts_at date NULL,
  ends_at date NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, student_id, class_id, academic_year),
  FOREIGN KEY (tenant_id, student_id) REFERENCES tenant_students(tenant_id, student_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, class_id) REFERENCES tenant_classes(tenant_id, class_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_student_subjects (
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, student_id, subject_id),
  FOREIGN KEY (tenant_id, student_id) REFERENCES tenant_students(tenant_id, student_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, subject_id) REFERENCES tenant_subjects(tenant_id, subject_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tenant_guardian_student_links (
  link_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  guardian_user_id uuid NOT NULL,
  student_id uuid NOT NULL,
  relationship_type varchar(40) NOT NULL DEFAULT 'guardian',
  can_view_reports boolean NOT NULL DEFAULT TRUE,
  can_receive_notifications boolean NOT NULL DEFAULT TRUE,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  authorized_by_user_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, guardian_user_id, student_id),
  FOREIGN KEY (tenant_id, guardian_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, student_id) REFERENCES tenant_students(tenant_id, student_id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, authorized_by_user_id) REFERENCES tenant_users(tenant_id, user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_classes_tenant_status
  ON tenant_classes (tenant_id, status, academic_year, name);

CREATE INDEX IF NOT EXISTS idx_tenant_subjects_tenant_status
  ON tenant_subjects (tenant_id, status, name);

CREATE INDEX IF NOT EXISTS idx_tenant_students_tenant_status
  ON tenant_students (tenant_id, status, full_name);

CREATE INDEX IF NOT EXISTS idx_tenant_students_primary_class
  ON tenant_students (tenant_id, primary_class_id);

CREATE INDEX IF NOT EXISTS idx_guardian_links_guardian
  ON tenant_guardian_student_links (tenant_id, guardian_user_id, status);

INSERT INTO tenant_roles (tenant_id, code, name, is_system, created_at, updated_at)
SELECT tenant_id, 'GUARDIAN', 'Padre / tutor', TRUE, NOW(), NOW()
FROM tenants
ON CONFLICT (tenant_id, code) DO UPDATE SET
  name = EXCLUDED.name,
  is_system = TRUE,
  updated_at = NOW();

INSERT INTO tenant_role_modules (tenant_id, role_code, module_key, is_visible)
SELECT t.tenant_id, defaults.role_code, defaults.module_key, TRUE
FROM tenants t
CROSS JOIN (
  VALUES
    ('GUARDIAN', 'STUDENTS'),
    ('GUARDIAN', 'COURSES'),
    ('GUARDIAN', 'REPORTS')
) AS defaults(role_code, module_key)
JOIN modules m ON m.module_key = defaults.module_key AND m.scope = 'TENANT'
ON CONFLICT (tenant_id, role_code, module_key) DO UPDATE SET
  is_visible = EXCLUDED.is_visible;

INSERT INTO tenant_role_permissions (tenant_id, role_code, permission_code)
SELECT t.tenant_id, defaults.role_code, defaults.permission_code
FROM tenants t
CROSS JOIN (
  VALUES
    ('GUARDIAN', 'students.read'),
    ('GUARDIAN', 'courses.read'),
    ('GUARDIAN', 'reports.read')
) AS defaults(role_code, permission_code)
JOIN permissions p ON p.permission_code = defaults.permission_code AND p.scope = 'TENANT'
ON CONFLICT (tenant_id, role_code, permission_code) DO NOTHING;
