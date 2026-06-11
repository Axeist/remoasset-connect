-- Track last morning lead report send (IST date) to avoid duplicate cron posts.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS slack_digest_last_sent_ist DATE;

COMMENT ON COLUMN public.app_settings.slack_digest_last_sent_ist IS
  'IST calendar date when slack-digest last posted the morning lead report (cron idempotency).';
