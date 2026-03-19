-- Add optional expiry date to API keys
ALTER TABLE public.api_keys
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient expiry lookups (e.g. filtering expired keys)
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON public.api_keys (expires_at)
  WHERE expires_at IS NOT NULL;
