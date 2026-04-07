-- Clients table: organizations that RemoAsset serves
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_id UUID REFERENCES public.countries(id),
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_country_id ON public.clients(country_id);
CREATE INDEX idx_clients_name ON public.clients(name);

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view clients"
  ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clients"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients"
  ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Client requests: laptop fulfillment orders tracked per client
CREATE TABLE public.client_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  device_pricing_id UUID REFERENCES public.vendor_device_pricing(id) ON DELETE SET NULL,
  country_id UUID REFERENCES public.countries(id),
  expected_delivery_date DATE,
  brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  processor TEXT NOT NULL,
  display_size TEXT NOT NULL,
  ram TEXT NOT NULL,
  storage TEXT NOT NULL,
  gpu TEXT,
  os TEXT,
  addons JSONB DEFAULT '[]'::jsonb,
  vendor_price_usd DECIMAL(12,2),
  client_price_usd DECIMAL(12,2),
  shipping_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'vendor_allocated', 'ordered', 'in_transit', 'fulfilled', 'cancelled')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cr_client_id ON public.client_requests(client_id);
CREATE INDEX idx_cr_vendor_id ON public.client_requests(vendor_id);
CREATE INDEX idx_cr_status ON public.client_requests(status);

CREATE TRIGGER update_client_requests_updated_at
  BEFORE UPDATE ON public.client_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.client_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client requests"
  ON public.client_requests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert client requests"
  ON public.client_requests FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update client requests"
  ON public.client_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins can delete client requests"
  ON public.client_requests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
