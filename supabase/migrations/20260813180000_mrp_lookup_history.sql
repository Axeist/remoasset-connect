-- Persist public price lookup searches per user
CREATE TABLE IF NOT EXISTS public.mrp_lookup_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query        JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary      JSONB NOT NULL DEFAULT '{}'::jsonb,
  results      JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_usage  JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mrp_lookup_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own price lookup history" ON public.mrp_lookup_history;
CREATE POLICY "Users can manage own price lookup history"
  ON public.mrp_lookup_history
  FOR ALL
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_mrp_lookup_history_user
  ON public.mrp_lookup_history (user_id, created_at DESC);
