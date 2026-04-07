-- Ensure designation and phone columns exist on profiles (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS designation TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;
