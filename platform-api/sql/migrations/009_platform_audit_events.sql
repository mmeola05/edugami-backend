CREATE TABLE IF NOT EXISTS platform_audit_events (
  audit_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_platform_account_id uuid NULL REFERENCES platform_accounts(platform_account_id) ON DELETE SET NULL,
  actor_scope varchar(40) NOT NULL DEFAULT 'platform',
  event_type varchar(100) NOT NULL,
  entity_type varchar(80) NOT NULL,
  entity_id varchar(160) NULL,
  action varchar(80) NOT NULL,
  before_json jsonb NULL,
  after_json jsonb NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_audit_events_type_created
  ON platform_audit_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_audit_events_actor_created
  ON platform_audit_events(actor_platform_account_id, created_at DESC);
