-- Fix foreign key constraints so deleting a user from auth.users doesn't fail.
-- leads.owner_id  → SET NULL  (leads become unassigned)
-- tasks.assignee_id → SET NULL (tasks become unassigned)
-- lead_activities.user_id → SET NULL (activity log preserved but author removed)
-- follow_ups.user_id → SET NULL

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_owner_id_fkey,
  ADD CONSTRAINT leads_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_assignee_id_fkey,
  ADD CONSTRAINT tasks_assignee_id_fkey
    FOREIGN KEY (assignee_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.lead_activities
  DROP CONSTRAINT IF EXISTS lead_activities_user_id_fkey,
  ADD CONSTRAINT lead_activities_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.follow_ups
  DROP CONSTRAINT IF EXISTS follow_ups_user_id_fkey,
  ADD CONSTRAINT follow_ups_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
