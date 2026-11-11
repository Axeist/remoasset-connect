-- Phase 1 hardening (safe, additive). Review before `supabase db push`.

-- 1. country_calling_codes had RLS disabled: anyone with the anon key could edit it.
ALTER TABLE public.country_calling_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read country calling codes" ON public.country_calling_codes;
CREATE POLICY "Anyone can read country calling codes"
  ON public.country_calling_codes FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policies: only the service role / migrations may change it.

-- 2. Enforce the sign-up email domain on the server. Previously this was checked
--    only in the browser, so anyone could register through the Auth API.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  email_domain text := lower(split_part(coalesce(NEW.email, ''), '@', 2));
  configured text;
BEGIN
  SELECT lower(allowed_email_domain) INTO configured
  FROM public.app_settings
  LIMIT 1;

  IF email_domain NOT IN ('remoasset.com', 'remoasset.in', coalesce(configured, 'remoasset.com')) THEN
    RAISE EXCEPTION 'Sign-ups are restricted to company email addresses'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'procurement_specialist');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Indexes on hot foreign-key / filter columns used by RLS checks and list pages.
CREATE INDEX IF NOT EXISTS leads_owner_id_idx           ON public.leads (owner_id);
CREATE INDEX IF NOT EXISTS leads_status_id_idx          ON public.leads (status_id);
CREATE INDEX IF NOT EXISTS leads_updated_at_idx         ON public.leads (updated_at DESC);
CREATE INDEX IF NOT EXISTS lead_activities_lead_id_idx  ON public.lead_activities (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_activities_user_id_idx  ON public.lead_activities (user_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_due_idx       ON public.tasks (assignee_id, due_date);
CREATE INDEX IF NOT EXISTS tasks_lead_id_idx            ON public.tasks (lead_id);
CREATE INDEX IF NOT EXISTS follow_ups_user_scheduled_idx ON public.follow_ups (user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS follow_ups_lead_id_idx       ON public.follow_ups (lead_id);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

-- 4. Notifications must be delivered through realtime for the bell to update live.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
