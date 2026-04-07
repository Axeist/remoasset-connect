-- Vendor Device Pricing: structured RFP laptop pricing from vendors
CREATE TABLE public.vendor_device_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  country_id UUID NOT NULL REFERENCES public.countries(id),
  brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  processor TEXT NOT NULL,
  display_size TEXT NOT NULL,
  ram TEXT NOT NULL,
  storage TEXT NOT NULL,
  gpu TEXT,
  os TEXT,
  addons JSONB DEFAULT '[]'::jsonb,
  price_usd DECIMAL(12,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quote_validity_date DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vdp_vendor_id ON public.vendor_device_pricing(vendor_id);
CREATE INDEX idx_vdp_country_id ON public.vendor_device_pricing(country_id);
CREATE INDEX idx_vdp_brand ON public.vendor_device_pricing(brand);
CREATE INDEX idx_vdp_quote_validity ON public.vendor_device_pricing(quote_validity_date);

CREATE INDEX idx_vdp_search ON public.vendor_device_pricing
  USING gin (to_tsvector('english', coalesce(brand,'') || ' ' || coalesce(device_model,'') || ' ' || coalesce(processor,'') || ' ' || coalesce(ram,'') || ' ' || coalesce(storage,'')));

CREATE TRIGGER update_vendor_device_pricing_updated_at
  BEFORE UPDATE ON public.vendor_device_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vendor_device_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view device pricing"
  ON public.vendor_device_pricing FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert device pricing"
  ON public.vendor_device_pricing FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update device pricing"
  ON public.vendor_device_pricing FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete device pricing"
  ON public.vendor_device_pricing FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));
