-- Enable pg_cron extension (requires superuser; run once per project)
-- If already enabled, this is a no-op.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ─── slack-reminders: every 15 minutes ───────────────────────────────────────
-- Calls the slack-reminders edge function to send upcoming task/follow-up alerts.
SELECT cron.schedule(
  'slack-reminders-15min',
  '*/15 * * * *',
  $$
  SELECT
    net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/slack-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);

-- ─── slack-digest: every hour (function self-gates by hour) ──────────────────
-- The slack-digest function checks if the current UTC hour matches the
-- configured digest hour (app_settings.slack_digest_hour) before sending.
SELECT cron.schedule(
  'slack-digest-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url     := current_setting('app.supabase_url') || '/functions/v1/slack-digest',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body    := '{}'::jsonb
    );
  $$
);
