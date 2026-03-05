-- ============================================================
-- AI Vendor Agent — database additions
-- ============================================================

-- ── 1. app_settings: AI + vendor agent columns ──────────────

ALTER TABLE public.app_settings
  -- Claude AI settings
  ADD COLUMN IF NOT EXISTS ai_enabled                      BOOLEAN         NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_model                        TEXT            NOT NULL DEFAULT 'claude-3-5-haiku-20241022',
  ADD COLUMN IF NOT EXISTS ai_max_tokens                   INTEGER         NOT NULL DEFAULT 4096,
  ADD COLUMN IF NOT EXISTS ai_temperature                  NUMERIC(3,2)    NOT NULL DEFAULT 0.70,

  -- Daily cron automation
  ADD COLUMN IF NOT EXISTS vendor_cron_enabled             BOOLEAN         NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vendor_cron_schedule            TEXT            NOT NULL DEFAULT '0 9 * * *',
  ADD COLUMN IF NOT EXISTS vendor_cron_last_run            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vendor_cron_last_run_count      INTEGER,

  -- Regions (JSONB array, fully configurable from UI)
  ADD COLUMN IF NOT EXISTS vendor_cron_regions             JSONB           NOT NULL DEFAULT '[
    {"region": "APAC",  "enabled": true,  "count": 20},
    {"region": "US",    "enabled": true,  "count": 20},
    {"region": "EU",    "enabled": true,  "count": 20},
    {"region": "LATAM", "enabled": false, "count": 10},
    {"region": "MEA",   "enabled": false, "count": 10}
  ]'::jsonb,

  -- Vendor types (JSONB array)
  ADD COLUMN IF NOT EXISTS vendor_cron_types               JSONB           NOT NULL DEFAULT '[
    {"type": "refurbished", "enabled": true,  "label": "Refurbished Devices"},
    {"type": "new_device",  "enabled": true,  "label": "New Devices"},
    {"type": "rental",      "enabled": true,  "label": "Rental"},
    {"type": "warehouse",   "enabled": false, "label": "Warehouse & Storage"}
  ]'::jsonb,

  -- Outreach email settings
  ADD COLUMN IF NOT EXISTS vendor_email_enabled            BOOLEAN         NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vendor_email_from_name          TEXT            NOT NULL DEFAULT 'RemoAsset Procurement',
  ADD COLUMN IF NOT EXISTS vendor_email_from_address       TEXT            NOT NULL DEFAULT 'outreach@remoasset.in',
  ADD COLUMN IF NOT EXISTS vendor_email_reply_to           TEXT,
  ADD COLUMN IF NOT EXISTS vendor_email_subject_template   TEXT            NOT NULL DEFAULT 'Partnership Inquiry — IT Device Procurement | RemoAsset',
  ADD COLUMN IF NOT EXISTS vendor_email_tone               TEXT            NOT NULL DEFAULT 'professional',

  -- Lead assignment
  ADD COLUMN IF NOT EXISTS agni_agent_user_id              UUID,
  ADD COLUMN IF NOT EXISTS vendor_default_status_id        UUID,
  ADD COLUMN IF NOT EXISTS vendor_auto_assign              BOOLEAN         NOT NULL DEFAULT false,

  -- Duplicate prevention
  ADD COLUMN IF NOT EXISTS vendor_dedup_enabled            BOOLEAN         NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS vendor_dedup_window_days        INTEGER         NOT NULL DEFAULT 90,

  -- Slack notifications for agent events
  ADD COLUMN IF NOT EXISTS slack_notify_vendor_discovered  BOOLEAN         NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_vendor_email_sent  BOOLEAN         NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_notify_cron_summary       BOOLEAN         NOT NULL DEFAULT true;

-- Seed agni_agent_user_id from existing profiles (Agni dummy account)
UPDATE public.app_settings
SET agni_agent_user_id = (
  SELECT p.user_id
  FROM public.profiles p
  WHERE lower(p.full_name) LIKE '%agni%'
  LIMIT 1
)
WHERE agni_agent_user_id IS NULL;

-- Seed vendor_default_status_id to the first/lowest sort_order status (New)
UPDATE public.app_settings
SET vendor_default_status_id = (
  SELECT id FROM public.lead_statuses
  ORDER BY sort_order ASC
  LIMIT 1
)
WHERE vendor_default_status_id IS NULL;

-- ── 2. vendor_discovery_log — audit trail + dedup ───────────

CREATE TABLE IF NOT EXISTS public.vendor_discovery_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  TEXT        NOT NULL,
  website       TEXT,
  email         TEXT,
  region        TEXT,
  vendor_type   TEXT,
  lead_id       UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  email_sent    BOOLEAN     NOT NULL DEFAULT false,
  skipped_dedup BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_discovery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vendor_discovery_log"
  ON public.vendor_discovery_log
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Index for fast dedup lookups
CREATE INDEX IF NOT EXISTS idx_vendor_discovery_log_company
  ON public.vendor_discovery_log (lower(company_name));

CREATE INDEX IF NOT EXISTS idx_vendor_discovery_log_email
  ON public.vendor_discovery_log (lower(email))
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vendor_discovery_log_created
  ON public.vendor_discovery_log (created_at DESC);

-- ── 3. vendor_discovery_jobs — queue for async processing ───

CREATE TABLE IF NOT EXISTS public.vendor_discovery_jobs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','running','completed','failed')),
  triggered_by  TEXT        NOT NULL DEFAULT 'cron',  -- 'cron' | 'chat' | 'manual'
  regions       JSONB,
  vendor_types  JSONB,
  total_created INTEGER     NOT NULL DEFAULT 0,
  total_skipped INTEGER     NOT NULL DEFAULT 0,
  total_emailed INTEGER     NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_discovery_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vendor_discovery_jobs"
  ON public.vendor_discovery_jobs
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_vendor_discovery_jobs_status
  ON public.vendor_discovery_jobs (status, created_at DESC);
