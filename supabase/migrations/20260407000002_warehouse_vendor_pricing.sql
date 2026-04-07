-- Warehouse vendor partner pricing: standardized service charges
CREATE TABLE public.warehouse_vendor_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  country_id UUID REFERENCES public.countries(id),
  box_procurement_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  box_custom_printing_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  shipping_to_employee DECIMAL(12,2) NOT NULL DEFAULT 0,
  retrieve_from_employee DECIMAL(12,2) NOT NULL DEFAULT 0,
  storage_charge DECIMAL(12,2) NOT NULL DEFAULT 0,
  qc_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  repair_upgrade_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  redeployment_charges DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(12,2) GENERATED ALWAYS AS (
    box_procurement_charges + box_custom_printing_charges +
    shipping_to_employee + retrieve_from_employee +
    storage_charge + qc_charges +
    repair_upgrade_charges + redeployment_charges
  ) STORED,
  currency TEXT NOT NULL DEFAULT 'USD',
  quote_date DATE DEFAULT CURRENT_DATE,
  quote_validity_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whp_vendor_id ON public.warehouse_vendor_pricing(vendor_id);
CREATE INDEX idx_whp_country_id ON public.warehouse_vendor_pricing(country_id);

CREATE TRIGGER update_warehouse_vendor_pricing_updated_at
  BEFORE UPDATE ON public.warehouse_vendor_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.warehouse_vendor_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view warehouse pricing"
  ON public.warehouse_vendor_pricing FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert warehouse pricing"
  ON public.warehouse_vendor_pricing FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update warehouse pricing"
  ON public.warehouse_vendor_pricing FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete warehouse pricing"
  ON public.warehouse_vendor_pricing FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
