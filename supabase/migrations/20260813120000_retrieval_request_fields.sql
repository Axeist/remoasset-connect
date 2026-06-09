-- Retrieval / redeployment: route types, services, and schedule
ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS retrieval_from_type TEXT
    CHECK (retrieval_from_type IS NULL OR retrieval_from_type IN ('employee', 'inventory')),
  ADD COLUMN IF NOT EXISTS retrieval_to_type TEXT
    CHECK (retrieval_to_type IS NULL OR retrieval_to_type IN ('employee', 'inventory')),
  ADD COLUMN IF NOT EXISTS qc_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_wipe_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_date DATE,
  ADD COLUMN IF NOT EXISTS warehouse_delivery_date DATE,
  ADD COLUMN IF NOT EXISTS receiver_delivery_date DATE;

COMMENT ON COLUMN public.client_requests.retrieval_from_type IS 'Retrieval pickup: employee home/office or Remoasset inventory.';
COMMENT ON COLUMN public.client_requests.retrieval_to_type IS 'Retrieval destination: employee redeploy or Remoasset inventory.';
COMMENT ON COLUMN public.client_requests.qc_required IS 'Quality check required at warehouse.';
COMMENT ON COLUMN public.client_requests.data_wipe_required IS 'Secure data wipe required before storage/redeploy.';
COMMENT ON COLUMN public.client_requests.pickup_date IS 'Scheduled device pickup date.';
COMMENT ON COLUMN public.client_requests.warehouse_delivery_date IS 'Expected arrival at warehouse when shipping to inventory.';
COMMENT ON COLUMN public.client_requests.receiver_delivery_date IS 'Expected delivery to end employee when redeploying.';
