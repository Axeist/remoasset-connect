-- Add allowed_email_domain to app_settings so admins can configure it from the UI
-- instead of requiring a code deploy
ALTER TABLE public.app_settings
ADD COLUMN IF NOT EXISTS allowed_email_domain TEXT DEFAULT 'remoasset.com';
