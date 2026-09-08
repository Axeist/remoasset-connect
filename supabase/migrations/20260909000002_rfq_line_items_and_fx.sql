-- RFQ multi-item cart + FX audit on bids
ALTER TABLE public.rfqs
  ADD COLUMN IF NOT EXISTS line_items jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.rfq_bids
  ADD COLUMN IF NOT EXISTS fx_rate_at_submit numeric,
  ADD COLUMN IF NOT EXISTS fx_as_of date,
  ADD COLUMN IF NOT EXISTS quoted_usd_at_submit numeric(12,2),
  ADD COLUMN IF NOT EXISTS landed_usd_at_submit numeric(12,2);

COMMENT ON COLUMN public.rfqs.line_items IS 'Device spec lines (same shape as client_requests.devices).';
COMMENT ON COLUMN public.rfq_bids.fx_rate_at_submit IS 'Multiply quoted currency by this to get USD at submit time (audit). Display uses live rate.';
