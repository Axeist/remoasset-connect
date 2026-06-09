-- Separate service fees from landing / vendor cost on client requests
ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS service_cost_usd DECIMAL(12,2);

COMMENT ON COLUMN public.client_requests.service_cost_usd IS 'Additional service fees (QC, wipe, logistics handling) in USD, separate from vendor_price_usd landing cost.';
