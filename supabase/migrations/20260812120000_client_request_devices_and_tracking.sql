-- Multi-device line items, serial numbers, and actual delivery date
ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS devices JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS delivery_date DATE;

COMMENT ON COLUMN public.client_requests.devices IS 'JSON array of device line items (category, brand, model, specs, serial, custom fields).';
COMMENT ON COLUMN public.client_requests.serial_number IS 'Comma-separated serial numbers when tracking at request level.';
COMMENT ON COLUMN public.client_requests.delivery_date IS 'Actual delivery date (distinct from expected_delivery_date).';

-- Fulfillment only requires brand + model (specs vary by device category)
ALTER TABLE public.client_requests
  DROP CONSTRAINT IF EXISTS client_requests_fulfillment_specs_check;

ALTER TABLE public.client_requests
  ADD CONSTRAINT client_requests_fulfillment_specs_check CHECK (
    request_type <> 'fulfillment'
    OR (
      brand IS NOT NULL AND btrim(brand) <> ''
      AND device_model IS NOT NULL AND btrim(device_model) <> ''
    )
  );
