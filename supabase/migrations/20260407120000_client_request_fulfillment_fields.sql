-- Employee / payment / wire / device summary for client fulfillment tracking
ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS employee_address TEXT,
  ADD COLUMN IF NOT EXISTS employee_phone TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('paid', 'unpaid')),
  ADD COLUMN IF NOT EXISTS client_payment_date DATE,
  ADD COLUMN IF NOT EXISTS wire_cost_usd DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS device_summary TEXT;

COMMENT ON COLUMN public.client_requests.device_summary IS 'Full device description line (e.g. for reports); may mirror structured brand/model/specs.';
COMMENT ON COLUMN public.client_requests.wire_cost_usd IS 'Bank / wire transfer fees in USD (informational; profit calc matches spreadsheet: quoted - procurement).';
