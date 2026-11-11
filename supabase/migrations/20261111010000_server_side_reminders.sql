-- Server-side reminders and task-assignment notifications.
-- Replaces the browser poller: reminders now fire without an open tab, exactly once.

ALTER TABLE public.tasks      ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
ALTER TABLE public.tasks      ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.tasks      ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Re-arm the reminder when the due time changes.
CREATE OR REPLACE FUNCTION public.reset_reminder_on_reschedule()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN NEW.reminder_sent_at := NULL; END IF;
    IF NEW.is_completed AND NOT OLD.is_completed THEN NEW.completed_at := now(); END IF;
    IF NOT NEW.is_completed AND OLD.is_completed THEN NEW.completed_at := NULL; END IF;
  ELSE
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN NEW.reminder_sent_at := NULL; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tasks_reset_reminder ON public.tasks;
CREATE TRIGGER tasks_reset_reminder BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.reset_reminder_on_reschedule();
DROP TRIGGER IF EXISTS follow_ups_reset_reminder ON public.follow_ups;
CREATE TRIGGER follow_ups_reset_reminder BEFORE UPDATE ON public.follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.reset_reminder_on_reschedule();

-- Record who created a task.
CREATE OR REPLACE FUNCTION public.set_task_created_by()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tasks_set_created_by ON public.tasks;
CREATE TRIGGER tasks_set_created_by BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_created_by();

-- Notify the assignee when someone else assigns them a task.
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND NEW.assignee_id IS DISTINCT FROM auth.uid()
     AND (TG_OP = 'INSERT' OR NEW.assignee_id IS DISTINCT FROM OLD.assignee_id) THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.assignee_id,
      'New task assigned',
      coalesce(NEW.title, 'A task') || ' was assigned to you.',
      'task',
      jsonb_build_object('taskId', NEW.id, 'leadId', NEW.lead_id)
    );
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tasks_notify_assigned ON public.tasks;
CREATE TRIGGER tasks_notify_assigned AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- Reminder sweep: each task / follow-up is notified once, 15 min before (or up to 10 min after) it is due.
CREATE OR REPLACE FUNCTION public.send_due_reminders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_tasks int := 0; n_follow int := 0;
BEGIN
  WITH due AS (
    UPDATE public.tasks t SET reminder_sent_at = now()
    WHERE t.is_completed = false AND t.due_date IS NOT NULL AND t.reminder_sent_at IS NULL
      AND t.due_date BETWEEN now() - interval '10 minutes' AND now() + interval '15 minutes'
      AND coalesce((SELECT (p.notification_preferences->>'task_due')::boolean
                    FROM public.profiles p WHERE p.user_id = t.assignee_id), true)
    RETURNING t.id, t.title, t.assignee_id, t.lead_id
  ), ins AS (
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    SELECT assignee_id, 'Task due soon',
           CASE WHEN title IS NOT NULL THEN title || ' is due soon.' ELSE 'A task is due soon.' END,
           'task', jsonb_build_object('taskId', id, 'leadId', lead_id)
    FROM due RETURNING 1
  ) SELECT count(*) INTO n_tasks FROM ins;

  WITH due AS (
    UPDATE public.follow_ups f SET reminder_sent_at = now()
    WHERE f.is_completed = false AND f.reminder_sent_at IS NULL
      AND f.scheduled_at BETWEEN now() - interval '10 minutes' AND now() + interval '15 minutes'
      AND coalesce((SELECT (p.notification_preferences->>'follow_up')::boolean
                    FROM public.profiles p WHERE p.user_id = f.user_id), true)
    RETURNING f.id, f.user_id, f.notes, f.lead_id, f.scheduled_at
  ), ins AS (
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    SELECT d.user_id,
           CASE WHEN d.scheduled_at <= now() THEN 'Follow-up due now' ELSE 'Follow-up due soon' END,
           CASE WHEN l.company_name IS NOT NULL
                THEN 'Follow-up for ' || l.company_name ||
                     CASE WHEN d.notes IS NOT NULL THEN ' — "' || d.notes || '"' ELSE '' END ||
                     CASE WHEN d.scheduled_at <= now() THEN ' is due now.' ELSE ' is due soon.' END
                ELSE 'A follow-up is due.' END,
           'info', jsonb_build_object('followUpId', d.id, 'leadId', d.lead_id)
    FROM due d LEFT JOIN public.leads l ON l.id = d.lead_id RETURNING 1
  ) SELECT count(*) INTO n_follow FROM ins;

  RETURN n_tasks + n_follow;
END $$;

REVOKE ALL ON FUNCTION public.send_due_reminders() FROM PUBLIC, anon, authenticated;

-- Run every minute.
DO $$
BEGIN
  PERFORM cron.unschedule('send-due-reminders')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-due-reminders');
  PERFORM cron.schedule('send-due-reminders', '* * * * *', 'SELECT public.send_due_reminders()');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron scheduling skipped: %', SQLERRM;
END $$;
