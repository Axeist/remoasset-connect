-- Lead transfers audit table
CREATE TABLE public.lead_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  transferred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_transfers_lead_id ON public.lead_transfers(lead_id);
CREATE INDEX idx_lead_transfers_created_at ON public.lead_transfers(created_at DESC);

ALTER TABLE public.lead_transfers ENABLE ROW LEVEL SECURITY;

-- Admins can see all transfers
CREATE POLICY "Admins can view all transfers" ON public.lead_transfers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Employees can see transfers involving them
CREATE POLICY "Users can view their own transfers" ON public.lead_transfers
  FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR transferred_by = auth.uid());

-- Any authenticated user can insert a transfer record
CREATE POLICY "Authenticated users can insert transfers" ON public.lead_transfers
  FOR INSERT TO authenticated
  WITH CHECK (transferred_by = auth.uid());

-- Add 'transfer' to allowed activity types
ALTER TABLE public.lead_activities
  DROP CONSTRAINT IF EXISTS lead_activities_activity_type_check;

ALTER TABLE public.lead_activities
  ADD CONSTRAINT lead_activities_activity_type_check
  CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'whatsapp', 'nda', 'linkedin', 'quotation', 'transfer'));
