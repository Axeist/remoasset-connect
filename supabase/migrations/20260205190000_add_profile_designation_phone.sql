-- Add designation and phone to profiles for Settings page
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;
