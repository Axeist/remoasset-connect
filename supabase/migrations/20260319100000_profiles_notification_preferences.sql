-- Add notification_preferences JSONB column to profiles
-- Stores per-user in-app notification opt-in/out settings
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT NULL;
