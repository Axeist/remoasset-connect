-- Allow admins to insert follow_ups for any user
DROP POLICY IF EXISTS "Users can create follow_ups" ON public.follow_ups;

CREATE POLICY "Users can create follow_ups" ON public.follow_ups
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Allow users to delete their own follow_ups and admins to delete any follow_ups
DROP POLICY IF EXISTS "Users can delete their own follow_ups" ON public.follow_ups;

CREATE POLICY "Users can delete their own follow_ups" ON public.follow_ups
  FOR DELETE USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Allow admins to update any follow_ups
DROP POLICY IF EXISTS "Users can update their own follow_ups" ON public.follow_ups;

CREATE POLICY "Users can update their own follow_ups" ON public.follow_ups
  FOR UPDATE USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
