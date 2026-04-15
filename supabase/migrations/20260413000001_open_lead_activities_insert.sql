-- Allow any authenticated user to insert activities on any lead,
-- but enforce that user_id matches the inserting user so every
-- activity is attributed to the person who created it.
DROP POLICY IF EXISTS "Users can insert lead activities for their leads" ON public.lead_activities;

CREATE POLICY "Authenticated users can insert lead activities"
ON public.lead_activities FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());
