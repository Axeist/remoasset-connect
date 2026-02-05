-- Allow authenticated users to create notifications (e.g. when assigning leads to team members).
-- Recipients can only view/update their own notifications via existing RLS policies.
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
