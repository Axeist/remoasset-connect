-- Client-facing warehouse service bundle (USD only), parallel to vendor landing charges
ALTER TABLE public.warehouse_vendor_pricing
  ADD COLUMN IF NOT EXISTS client_box_procurement_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_box_custom_printing_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_shipping_to_employee DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_retrieve_from_employee DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_storage_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_qc_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_repair_upgrade_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_redeployment_charges DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.warehouse_vendor_pricing
  ADD COLUMN IF NOT EXISTS client_grand_total DECIMAL(12,2) GENERATED ALWAYS AS (
    client_box_procurement_charges + client_box_custom_printing_charges +
    client_shipping_to_employee + client_retrieve_from_employee +
    client_storage_charge + client_qc_charges +
    client_repair_upgrade_charges + client_redeployment_charges
  ) STORED;
