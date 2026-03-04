-- Create app_settings table for global integration settings (Slack, etc.)

CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_enabled BOOLEAN DEFAULT false,
  slack_webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app settings"
  ON public.app_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed a single row (upsert-safe)
INSERT INTO public.app_settings (slack_enabled, slack_webhook_url)
VALUES (true, 'https://hooks.slack.com/services/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')
ON CONFLICT DO NOTHING;
