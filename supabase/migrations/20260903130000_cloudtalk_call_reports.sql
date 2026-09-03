-- Call reports: Connect lead owner on each call + US/SG/UK company DIDs

ALTER TABLE public.cloudtalk_calls
  ADD COLUMN IF NOT EXISTS connect_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS cloudtalk_calls_connect_user_id_idx
  ON public.cloudtalk_calls (connect_user_id);

CREATE INDEX IF NOT EXISTS cloudtalk_calls_started_at_idx
  ON public.cloudtalk_calls (started_at DESC);

UPDATE public.cloudtalk_calls c
SET connect_user_id = l.owner_id
FROM public.leads l
WHERE c.lead_id = l.id
  AND c.connect_user_id IS NULL
  AND l.owner_id IS NOT NULL;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS cloudtalk_did_us_e164 TEXT,
  ADD COLUMN IF NOT EXISTS cloudtalk_did_sg_e164 TEXT,
  ADD COLUMN IF NOT EXISTS cloudtalk_did_uk_e164 TEXT;
