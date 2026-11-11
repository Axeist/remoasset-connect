-- Invite-only access.
-- Only emails that an admin has invited (or created) may get an account. This is enforced in the
-- database, so it holds for every sign-up path: the Auth API, Google OAuth and the public anon key.

CREATE TABLE IF NOT EXISTS public.invited_emails (
  email       text PRIMARY KEY CHECK (email = lower(email)),
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invited_emails ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (edge functions) and SECURITY DEFINER code can read or write.
REVOKE ALL ON public.invited_emails FROM anon, authenticated;

-- Everyone who already has an account stays valid (and can be re-invited later).
INSERT INTO public.invited_emails (email)
SELECT lower(email) FROM auth.users WHERE email IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.invited_emails WHERE email = lower(coalesce(NEW.email, ''))) THEN
    RAISE EXCEPTION 'This workspace is invite-only. Ask an administrator to invite you.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'procurement_specialist');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
