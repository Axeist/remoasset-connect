-- Add whatsapp to the allowed activity types
ALTER TABLE public.lead_activities
  DROP CONSTRAINT IF EXISTS lead_activities_activity_type_check;

ALTER TABLE public.lead_activities
  ADD CONSTRAINT lead_activities_activity_type_check
  CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'whatsapp'));
