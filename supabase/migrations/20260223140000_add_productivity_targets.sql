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

-- Insert sensible defaults
INSERT INTO public.productivity_targets (activity_type, period, target_count) VALUES
  ('email',        'daily',   60),
  ('email',        'weekly',  300),
  ('email',        'monthly', 1200),
  ('call',         'daily',   10),
  ('call',         'weekly',  50),
  ('call',         'monthly', 200),
  ('meeting',      'daily',   3),
  ('meeting',      'weekly',  15),
  ('meeting',      'monthly', 60),
  ('linkedin',     'daily',   5),
  ('linkedin',     'weekly',  25),
  ('linkedin',     'monthly', 100),
  ('whatsapp',     'daily',   8),
  ('whatsapp',     'weekly',  40),
  ('whatsapp',     'monthly', 160),
  ('nda',          'daily',   1),
  ('nda',          'weekly',  5),
  ('nda',          'monthly', 20),
  ('deal_closed',  'daily',   1),
  ('deal_closed',  'weekly',  3),
  ('deal_closed',  'monthly', 12)
ON CONFLICT (activity_type, period) DO NOTHING;
