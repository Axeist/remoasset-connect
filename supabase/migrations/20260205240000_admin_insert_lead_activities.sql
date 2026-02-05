-- Allow admins to insert lead activities for any lead
DROP POLICY IF EXISTS "Users can insert lead activities for their leads" ON public.lead_activities;

CREATE POLICY "Users can insert lead activities for their leads"
ON public.lead_activities FOR INSERT
TO authenticated
WITH CHECK (
  -- Admins can insert for any lead
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR
  -- Regular users can only insert for leads they own
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_activities.lead_id
    AND leads.owner_id = auth.uid()
  )
);
