-- Allow users to delete their own follow_ups and admins to delete any follow_ups
DROP POLICY IF EXISTS "Users can delete their own follow_ups" ON public.follow_ups;

CREATE POLICY "Users can delete their own follow_ups" ON public.follow_ups
  FOR DELETE USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
