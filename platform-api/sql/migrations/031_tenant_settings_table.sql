CREATE TABLE IF NOT EXISTS tenant_settings (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  academic_policies jsonb NOT NULL DEFAULT '{
    "guardians_can_see_notes": true,
    "guardians_can_see_attendance": true,
    "guardians_can_see_history": true,
    "auto_enroll_subjects_on_class_change": false
  }'::jsonb,
  branding jsonb NOT NULL DEFAULT '{
    "primary_color": "#2415f2",
    "logo_url": null
  }'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Seed existing tenants
INSERT INTO tenant_settings (tenant_id)
SELECT tenant_id FROM tenants
ON CONFLICT DO NOTHING;
