ALTER TABLE modules
  DROP CONSTRAINT IF EXISTS modules_scope_check;

ALTER TABLE permissions
  DROP CONSTRAINT IF EXISTS permissions_scope_check;

INSERT INTO module_scopes (scope_code, name, description)
VALUES
  ('PUBLIC', 'Public', 'Usuarios sin tenant para perfil y actividad publica')
ON CONFLICT (scope_code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO modules (module_key, parent_module_key, scope, name, description, global_enabled, display_order, updated_at)
VALUES
  ('PUBLIC_PROFILE', NULL, 'PUBLIC', 'Perfil publico', 'Gestion del perfil personal fuera de tenants.', TRUE, 10, NOW()),
  ('PUBLIC_ACTIVITIES', NULL, 'PUBLIC', 'Actividades publicas', 'Participacion en actividades abiertas de EduGami.', TRUE, 20, NOW())
ON CONFLICT (module_key) DO UPDATE SET
  parent_module_key = EXCLUDED.parent_module_key,
  scope = EXCLUDED.scope,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO permissions (permission_code, module_key, scope, action, description, created_at)
VALUES
  ('public_profile.read', 'PUBLIC_PROFILE', 'PUBLIC', 'read', 'Ver el perfil publico propio.', NOW()),
  ('public_profile.update', 'PUBLIC_PROFILE', 'PUBLIC', 'update', 'Actualizar el perfil publico propio.', NOW()),
  ('public_activities.read', 'PUBLIC_ACTIVITIES', 'PUBLIC', 'read', 'Ver actividades publicas disponibles.', NOW()),
  ('public_activities.participate', 'PUBLIC_ACTIVITIES', 'PUBLIC', 'participate', 'Participar en actividades publicas.', NOW())
ON CONFLICT (permission_code) DO UPDATE SET
  module_key = EXCLUDED.module_key,
  scope = EXCLUDED.scope,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS public_accounts (
  public_account_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(254) NOT NULL UNIQUE,
  password_hash varchar(255) NOT NULL,
  display_name varchar(160) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  locale varchar(12) NOT NULL DEFAULT 'es-ES',
  timezone varchar(80) NOT NULL DEFAULT 'Europe/Madrid',
  avatar_url text NULL,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_refresh_tokens (
  refresh_token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_account_id uuid NOT NULL REFERENCES public_accounts(public_account_id) ON DELETE CASCADE,
  token_hash bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  revoked_at timestamptz NULL
);

CREATE TABLE IF NOT EXISTS public_password_reset_tokens (
  reset_token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_account_id uuid NOT NULL REFERENCES public_accounts(public_account_id) ON DELETE CASCADE,
  token_hash bytea NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public_account_permissions (
  account_permission_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_account_id uuid NOT NULL REFERENCES public_accounts(public_account_id) ON DELETE CASCADE,
  permission_code varchar(120) NOT NULL REFERENCES permissions(permission_code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (public_account_id, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_public_accounts_status_created
  ON public_accounts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_refresh_tokens_account
  ON public_refresh_tokens (public_account_id, expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_public_password_reset_tokens_account
  ON public_password_reset_tokens (public_account_id, expires_at DESC)
  WHERE used_at IS NULL;
