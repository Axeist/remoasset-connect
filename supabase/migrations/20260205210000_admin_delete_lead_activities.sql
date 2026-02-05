-- Allow admins to delete any lead activity (e.g. to remove sensitive or erroneous logs)
CREATE POLICY "Admins can delete lead activities"
ON public.lead_activities
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
