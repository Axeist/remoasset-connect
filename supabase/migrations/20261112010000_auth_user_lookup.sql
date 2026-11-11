-- Fast lookup of an auth user by email for the invite function (replaces downloading up to 1000 users).
CREATE OR REPLACE FUNCTION public.auth_user_lookup(_email text)
RETURNS TABLE (id uuid, last_sign_in_at timestamptz, email_confirmed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.id, u.last_sign_in_at, u.email_confirmed_at
  FROM auth.users u
  WHERE lower(u.email) = lower(_email)
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.auth_user_lookup(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_lookup(text) TO service_role;
