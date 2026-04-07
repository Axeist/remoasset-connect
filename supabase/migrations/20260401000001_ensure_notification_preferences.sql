-- Ensure notification_preferences column exists on profiles (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT NULL;
