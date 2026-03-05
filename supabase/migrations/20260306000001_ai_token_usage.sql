-- ============================================================
-- AI Vendor Agent — token usage tracking + CC email
-- ============================================================

-- ── 1. app_settings: CC email address ───────────────────────

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS vendor_email_cc   TEXT  DEFAULT 'ranjith@remoasset.com';

UPDATE public.app_settings
SET vendor_email_cc = 'ranjith@remoasset.com'
WHERE vendor_email_cc IS NULL;

-- ── 2. ai_token_usage — per-call token + cost tracking ───────

CREATE TABLE IF NOT EXISTS public.ai_token_usage (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which function logged this
  fn_name         TEXT          NOT NULL,  -- 'vendor-discovery' | 'vendor-outreach-email' | 'vendor-agent-chat'
  -- Claude model used
  model           TEXT          NOT NULL,
  -- Token counts from Anthropic response
  input_tokens    INTEGER       NOT NULL DEFAULT 0,
  output_tokens   INTEGER       NOT NULL DEFAULT 0,
  total_tokens    INTEGER       GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  -- Cost in USD (calculated at insert time based on model pricing)
  input_cost_usd  NUMERIC(10,6) NOT NULL DEFAULT 0,
  output_cost_usd NUMERIC(10,6) NOT NULL DEFAULT 0,
  total_cost_usd  NUMERIC(10,6) GENERATED ALWAYS AS (input_cost_usd + output_cost_usd) STORED,
  -- Context
  triggered_by    TEXT          NOT NULL DEFAULT 'cron',  -- 'cron' | 'chat' | 'manual'
  region          TEXT,
  vendor_type     TEXT,
  job_id          UUID          REFERENCES public.vendor_discovery_jobs(id) ON DELETE SET NULL,
  -- Metadata
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_token_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ai_token_usage"
  ON public.ai_token_usage
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created
  ON public.ai_token_usage (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_fn
  ON public.ai_token_usage (fn_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_model
  ON public.ai_token_usage (model, created_at DESC);

-- ── 3. Convenience view: daily aggregates ────────────────────

CREATE OR REPLACE VIEW public.ai_token_usage_daily AS
SELECT
  date_trunc('day', created_at)::date  AS day,
  fn_name,
  model,
  SUM(input_tokens)                    AS input_tokens,
  SUM(output_tokens)                   AS output_tokens,
  SUM(total_tokens)                    AS total_tokens,
  SUM(input_cost_usd)                  AS input_cost_usd,
  SUM(output_cost_usd)                 AS output_cost_usd,
  SUM(total_cost_usd)                  AS total_cost_usd,
  COUNT(*)                             AS api_calls
FROM public.ai_token_usage
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 3 DESC;

-- ── 4. Convenience view: monthly totals ─────────────────────

CREATE OR REPLACE VIEW public.ai_token_usage_monthly AS
SELECT
  date_trunc('month', created_at)::date AS month,
  SUM(input_tokens)                     AS input_tokens,
  SUM(output_tokens)                    AS output_tokens,
  SUM(total_tokens)                     AS total_tokens,
  SUM(total_cost_usd)                   AS total_cost_usd,
  COUNT(*)                              AS api_calls
FROM public.ai_token_usage
GROUP BY 1
ORDER BY 1 DESC;
