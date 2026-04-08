-- Subscription-tier client bundle (USD), parallel to pay-as-you-go client_* columns
ALTER TABLE public.warehouse_vendor_pricing
  ADD COLUMN IF NOT EXISTS client_sub_box_procurement_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_sub_box_custom_printing_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_sub_shipping_to_employee DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_sub_retrieve_from_employee DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_sub_storage_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_sub_qc_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_sub_repair_upgrade_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_sub_redeployment_charges DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public.warehouse_vendor_pricing
  ADD COLUMN IF NOT EXISTS client_sub_grand_total DECIMAL(12,2) GENERATED ALWAYS AS (
    client_sub_box_procurement_charges + client_sub_box_custom_printing_charges +
    client_sub_shipping_to_employee + client_sub_retrieve_from_employee +
    client_sub_storage_charge + client_sub_qc_charges +
    client_sub_repair_upgrade_charges + client_sub_redeployment_charges
  ) STORED;
