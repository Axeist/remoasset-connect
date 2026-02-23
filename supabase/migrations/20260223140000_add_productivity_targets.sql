-- Productivity targets table (admin-configurable)
CREATE TABLE IF NOT EXISTS public.productivity_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  target_count INTEGER NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (activity_type, period)
);

ALTER TABLE public.productivity_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view targets"
  ON public.productivity_targets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage targets"
  ON public.productivity_targets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Remove old per-channel targets (email, call, linkedin, whatsapp)
DELETE FROM public.productivity_targets
WHERE activity_type IN ('email', 'call', 'linkedin', 'whatsapp');

-- Insert holistic targets: outreach (email+call+linkedin+whatsapp combined)
-- Daily × 5 = weekly, daily × 22 = monthly
INSERT INTO public.productivity_targets (activity_type, period, target_count) VALUES
  ('outreach',     'daily',   83),
  ('outreach',     'weekly',  415),
  ('outreach',     'monthly', 1826),
  ('meeting',      'daily',   3),
  ('meeting',      'weekly',  15),
  ('meeting',      'monthly', 66),
  ('nda',          'daily',   1),
  ('nda',          'weekly',  5),
  ('nda',          'monthly', 22),
  ('deal_closed',  'daily',   1),
  ('deal_closed',  'weekly',  5),
  ('deal_closed',  'monthly', 22)
ON CONFLICT (activity_type, period) DO UPDATE SET target_count = EXCLUDED.target_count;
