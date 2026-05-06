CREATE TABLE IF NOT EXISTS audit_logs (
  occurred_at timestamptz NOT NULL DEFAULT NOW(),
  audit_log_id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_key varchar(120) NOT NULL,
  category varchar(40) NOT NULL DEFAULT 'business',
  severity varchar(20) NOT NULL DEFAULT 'info',
  module_key varchar(80) NULL,
  actor_type varchar(40) NOT NULL DEFAULT 'system',
  actor_platform_account_id uuid NULL REFERENCES platform_accounts(platform_account_id) ON DELETE SET NULL,
  actor_scope varchar(40) NOT NULL DEFAULT 'platform',
  actor_role varchar(40) NULL,
  actor_email varchar(255) NULL,
  actor_tenant_id uuid NULL REFERENCES tenants(tenant_id) ON DELETE SET NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar(160) NULL,
  action varchar(80) NOT NULL,
  outcome_status varchar(20) NOT NULL DEFAULT 'success',
  http_method varchar(12) NULL,
  route_path varchar(255) NULL,
  ip_address inet NULL,
  user_agent text NULL,
  request_id uuid NULL,
  correlation_id uuid NULL,
  session_id varchar(160) NULL,
  source_service varchar(60) NOT NULL DEFAULT 'platform-api',
  source_channel varchar(60) NOT NULL DEFAULT 'api',
  before_json jsonb NULL,
  after_json jsonb NULL,
  diff_json jsonb NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_json jsonb NULL,
  archived_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (occurred_at, audit_log_id)
) PARTITION BY RANGE (occurred_at);

CREATE OR REPLACE FUNCTION ensure_audit_logs_partition(target_date date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  partition_start date := date_trunc('month', target_date)::date;
  partition_end date := (date_trunc('month', target_date) + interval '1 month')::date;
  partition_name text := 'audit_logs_' || to_char(partition_start, 'YYYYMM');
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    partition_start,
    partition_end
  );
END;
$$;

SELECT ensure_audit_logs_partition(CURRENT_DATE);
SELECT ensure_audit_logs_partition((CURRENT_DATE + interval '1 month')::date);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_occurred
  ON audit_logs (event_key, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_occurred
  ON audit_logs (actor_platform_account_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_occurred
  ON audit_logs (entity_type, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation
  ON audit_logs (correlation_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome_occurred
  ON audit_logs (outcome_status, occurred_at DESC);

CREATE TABLE IF NOT EXISTS audit_log_outbox (
  outbox_id bigserial PRIMARY KEY,
  topic varchar(80) NOT NULL,
  aggregate_type varchar(80) NOT NULL,
  aggregate_id varchar(160) NULL,
  event_key varchar(120) NOT NULL,
  payload_json jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending',
  available_at timestamptz NOT NULL DEFAULT NOW(),
  processed_at timestamptz NULL,
  attempts int NOT NULL DEFAULT 0,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_outbox_status_available
  ON audit_log_outbox (status, available_at, created_at);

INSERT INTO modules (module_key, scope, name, description, global_enabled, display_order, updated_at)
VALUES ('AUDIT', 'ROOT', 'Audited', 'Auditoria operacional y trazabilidad forense de plataforma.', TRUE, 95, NOW())
ON CONFLICT (module_key)
DO UPDATE SET
  scope = EXCLUDED.scope,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  global_enabled = EXCLUDED.global_enabled,
  display_order = EXCLUDED.display_order,
  updated_at = NOW();

INSERT INTO permissions (permission_code, module_key, scope, action, description, created_at)
VALUES
  ('audit.read', 'AUDIT', 'ROOT', 'read', 'Consultar trazabilidad y actividad auditada de plataforma.', NOW()),
  ('audit.manage', 'AUDIT', 'ROOT', 'manage', 'Gestionar configuracion operativa de auditoria.', NOW())
ON CONFLICT (permission_code) DO NOTHING;

INSERT INTO platform_role_permissions (role_id, permission_code, created_at)
SELECT r.role_id, p.permission_code, NOW()
FROM platform_roles r
JOIN permissions p ON p.permission_code IN ('audit.read', 'audit.manage')
WHERE r.code = 'root-super-admin'
ON CONFLICT DO NOTHING;

INSERT INTO platform_role_permissions (role_id, permission_code, created_at)
SELECT r.role_id, 'audit.read', NOW()
FROM platform_roles r
WHERE r.code = 'support-ops'
ON CONFLICT DO NOTHING;

INSERT INTO audit_logs (
  occurred_at,
  event_key,
  category,
  severity,
  module_key,
  actor_type,
  actor_platform_account_id,
  actor_scope,
  actor_email,
  entity_type,
  entity_id,
  action,
  outcome_status,
  source_service,
  source_channel,
  before_json,
  after_json,
  diff_json,
  metadata_json,
  created_at
)
SELECT
  COALESCE(e.created_at::timestamptz, NOW()),
  e.event_type,
  'business',
  CASE
    WHEN e.event_type LIKE '%deleted%' OR e.event_type LIKE '%revoked%' THEN 'warning'
    ELSE 'info'
  END,
  CASE
    WHEN e.event_type LIKE '%module%' THEN 'GLOBAL_MODULES'
    WHEN e.event_type LIKE '%role%' OR e.event_type LIKE '%permissions%' THEN 'RBAC'
    ELSE NULL
  END,
  CASE WHEN e.actor_platform_account_id IS NULL THEN 'system' ELSE 'platform_account' END,
  e.actor_platform_account_id,
  e.actor_scope,
  pa.email,
  e.entity_type,
  e.entity_id,
  e.action,
  'success',
  'platform-api',
  'legacy_migration',
  e.before_json,
  e.after_json,
  NULL,
  e.metadata_json,
  COALESCE(e.created_at::timestamptz, NOW())
FROM platform_audit_events e
LEFT JOIN platform_accounts pa ON pa.platform_account_id = e.actor_platform_account_id
WHERE NOT EXISTS (
  SELECT 1
  FROM audit_logs a
  WHERE a.event_key = e.event_type
    AND a.entity_type = e.entity_type
    AND COALESCE(a.entity_id, '') = COALESCE(e.entity_id, '')
    AND a.action = e.action
    AND a.occurred_at = e.created_at::timestamptz
);
