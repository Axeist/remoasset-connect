-- API keys for external integrations (used by Edge Function 'api')
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_key_hash ON public.api_keys (key_hash);
CREATE INDEX idx_api_keys_created_by ON public.api_keys (created_by);

-- Only service role can read/write for validation; app uses Edge Function with admin JWT to create/list/revoke
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Admins can manage keys via Edge Functions (create-api-key, list/revoke via app calling with JWT)
-- No direct policy for auth.users; Edge Function uses service role for api_keys access.
CREATE POLICY "Service role full access to api_keys"
  ON public.api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
