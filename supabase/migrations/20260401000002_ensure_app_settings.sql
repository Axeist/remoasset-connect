-- Ensure all app_settings columns exist and seed the required singleton row

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS slack_notify_lead_created      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_stage_changed     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_activity_logged   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_task_created      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_task_completed    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_followup_created  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_lead_assigned     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_document_sent     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_daily_digest      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_digest_hour              INTEGER NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS slack_reminder_minutes_before  INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS developer_mode_enabled         BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_email_domain           TEXT DEFAULT 'remoasset.com';

-- Seed the singleton row if it doesn't exist yet
INSERT INTO public.app_settings (
  slack_enabled,
  slack_webhook_url,
  slack_notify_lead_created,
  slack_notify_stage_changed,
  slack_notify_activity_logged,
  slack_notify_task_created,
  slack_notify_task_completed,
  slack_notify_followup_created,
  slack_notify_lead_assigned,
  slack_notify_document_sent,
  slack_notify_daily_digest,
  slack_digest_hour,
  slack_reminder_minutes_before,
  developer_mode_enabled,
  allowed_email_domain
) VALUES (
  false, null,
  true, true, true, true, true, true, true, true,
  false, 11, 30,
  false,
  'remoasset.com'
)
ON CONFLICT DO NOTHING;

-- Read policy so non-admin users can read settings (needed for allowed_email_domain check on login)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_settings' AND policyname = 'Authenticated users can read app settings'
  ) THEN
    EXECUTE 'CREATE POLICY "Authenticated users can read app settings"
      ON public.app_settings FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;
