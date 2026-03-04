-- Add per-event notification toggles to app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS slack_notify_lead_created     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_stage_changed    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_activity_logged  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_task_created     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_task_completed   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_followup_created BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_lead_assigned    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_document_sent    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_daily_digest     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_digest_hour            INTEGER  NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS slack_reminder_minutes_before INTEGER  NOT NULL DEFAULT 30;

-- Update the single existing row so all toggles are in a known state
UPDATE public.app_settings SET
  slack_notify_lead_created     = true,
  slack_notify_stage_changed    = true,
  slack_notify_activity_logged  = true,
  slack_notify_task_created     = true,
  slack_notify_task_completed   = true,
  slack_notify_followup_created = true,
  slack_notify_lead_assigned    = true,
  slack_notify_document_sent    = true,
  slack_notify_daily_digest     = false,
  slack_digest_hour             = 11,
  slack_reminder_minutes_before = 30;
