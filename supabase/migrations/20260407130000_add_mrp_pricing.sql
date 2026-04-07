-- Manufacturer's Suggested Retail Price (MRP) / list price for comparisons
ALTER TABLE public.vendor_device_pricing
  ADD COLUMN IF NOT EXISTS mrp_usd DECIMAL(12,2);

ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS mrp_usd DECIMAL(12,2);

COMMENT ON COLUMN public.vendor_device_pricing.mrp_usd IS 'Optional list/MRP in USD to compare against vendor quote.';
COMMENT ON COLUMN public.client_requests.mrp_usd IS 'Optional list/MRP in USD to compare quoted and procurement prices.';
