-- Add developer_mode_enabled flag to app_settings

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS developer_mode_enabled BOOLEAN DEFAULT false;
