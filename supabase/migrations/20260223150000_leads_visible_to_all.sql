-- Allow all authenticated users to view all leads (employees can see all but only edit their own)
DROP POLICY IF EXISTS "Employees can view their own leads" ON public.leads;

CREATE POLICY "Authenticated users can view all leads" ON public.leads
  FOR SELECT TO authenticated
  USING (true);

-- Update lead_activities SELECT to allow viewing activities for all leads
DROP POLICY IF EXISTS "Users can view activities for their leads" ON public.lead_activities;

CREATE POLICY "Authenticated users can view all lead activities" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (true);

-- Update lead_documents SELECT to allow viewing documents for all leads
DROP POLICY IF EXISTS "Users can view lead documents for their leads" ON public.lead_documents;

CREATE POLICY "Authenticated users can view all lead documents" ON public.lead_documents
  FOR SELECT TO authenticated
  USING (true);
