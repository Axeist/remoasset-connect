-- Allow 'email' type for mail notifications and add metadata for thread/lead links
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('info', 'warning', 'success', 'task', 'lead', 'email'));

-- Optional metadata (e.g. { "threadId": "...", "leadId": "..." }) for email notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications
  FOR DELETE
  USING (user_id = auth.uid());
