-- Add country_ids array column to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS country_ids UUID[] NOT NULL DEFAULT '{}';

-- Migrate existing single country_id → country_ids array
UPDATE public.leads
SET country_ids = ARRAY[country_id]
WHERE country_id IS NOT NULL;

-- Drop the old FK column
ALTER TABLE public.leads
  DROP COLUMN IF EXISTS country_id;

-- Index for efficient array overlap queries
CREATE INDEX IF NOT EXISTS leads_country_ids_gin
  ON public.leads USING GIN (country_ids);
