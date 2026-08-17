-- Last-activity / stage clocks + per-status SLAs for the Action Center.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ;

ALTER TABLE public.lead_statuses
  ADD COLUMN IF NOT EXISTS sla_idle_days INTEGER,
  ADD COLUMN IF NOT EXISTS sla_stage_days INTEGER,
  ADD COLUMN IF NOT EXISTS sla_followup_intent TEXT;

UPDATE public.leads l
SET last_activity_at = COALESCE(
  (SELECT MAX(a.created_at) FROM public.lead_activities a WHERE a.lead_id = l.id),
  l.created_at
)
WHERE last_activity_at IS NULL;

UPDATE public.leads
SET status_changed_at = COALESCE(status_changed_at, updated_at, created_at)
WHERE status_changed_at IS NULL;

UPDATE public.lead_statuses SET
  sla_idle_days = 2,
  sla_stage_days = 3,
  sla_followup_intent = 'First outreach; they have not been contacted yet. Introduce RemoAsset briefly and ask for a short call.'
WHERE lower(name) = 'new';

UPDATE public.lead_statuses SET
  sla_idle_days = 5,
  sla_stage_days = 10,
  sla_followup_intent = 'First touch already happened. Continue the conversation; do not re-introduce the company.'
WHERE lower(name) = 'contacted';

UPDATE public.lead_statuses SET
  sla_idle_days = 7,
  sla_stage_days = 14,
  sla_followup_intent = 'Fit is established. Push the next commercial step (call, pricing, or sample).'
WHERE lower(name) = 'qualified';

UPDATE public.lead_statuses SET
  sla_idle_days = 5,
  sla_stage_days = 14,
  sla_followup_intent = 'NDA or contract was sent; they have not signed yet. Polite nudge to review and sign.'
WHERE lower(name) = 'proposal';

UPDATE public.lead_statuses SET
  sla_idle_days = 3,
  sla_stage_days = 10,
  sla_followup_intent = 'They sent a rebuttal or redlines on the NDA. Address next step on those points; do not re-send the original intro or a fresh NDA as if unsigned.'
WHERE lower(name) = 'negotiation';

UPDATE public.lead_statuses SET
  sla_idle_days = NULL,
  sla_stage_days = NULL,
  sla_followup_intent = NULL
WHERE lower(name) IN ('won', 'lost');

CREATE OR REPLACE FUNCTION public.touch_lead_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.leads
  SET last_activity_at = COALESCE(NEW.created_at, now())
  WHERE id = NEW.lead_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_touch_lead_last_activity ON public.lead_activities;
CREATE TRIGGER trg_touch_lead_last_activity
  AFTER INSERT ON public.lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_lead_last_activity();

CREATE OR REPLACE FUNCTION public.touch_lead_status_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_changed_at IS NULL THEN
      NEW.status_changed_at := COALESCE(NEW.created_at, now());
    END IF;
    IF NEW.last_activity_at IS NULL THEN
      NEW.last_activity_at := COALESCE(NEW.created_at, now());
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_touch_lead_status_changed ON public.leads;
CREATE TRIGGER trg_touch_lead_status_changed
  BEFORE INSERT OR UPDATE OF status_id ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_lead_status_changed();

CREATE OR REPLACE FUNCTION public.leads_matching_sla(p_mode text DEFAULT 'breach')
RETURNS TABLE(lead_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT l.id
  FROM public.leads l
  JOIN public.lead_statuses s ON s.id = l.status_id
  WHERE
    CASE
      WHEN p_mode = 'warning' THEN
        (
          (
            COALESCE(s.sla_idle_days, 0) > 0
            AND COALESCE(l.last_activity_at, l.created_at) < now() - (s.sla_idle_days * interval '1 day' * 0.8)
            AND COALESCE(l.last_activity_at, l.created_at) >= now() - (s.sla_idle_days * interval '1 day')
          )
          OR (
            COALESCE(s.sla_stage_days, 0) > 0
            AND COALESCE(l.status_changed_at, l.created_at) < now() - (s.sla_stage_days * interval '1 day' * 0.8)
            AND COALESCE(l.status_changed_at, l.created_at) >= now() - (s.sla_stage_days * interval '1 day')
          )
        )
        AND NOT (
          (COALESCE(s.sla_idle_days, 0) > 0 AND COALESCE(l.last_activity_at, l.created_at) < now() - (s.sla_idle_days * interval '1 day'))
          OR (COALESCE(s.sla_stage_days, 0) > 0 AND COALESCE(l.status_changed_at, l.created_at) < now() - (s.sla_stage_days * interval '1 day'))
        )
      ELSE
        (
          (COALESCE(s.sla_idle_days, 0) > 0 AND COALESCE(l.last_activity_at, l.created_at) < now() - (s.sla_idle_days * interval '1 day'))
          OR (COALESCE(s.sla_stage_days, 0) > 0 AND COALESCE(l.status_changed_at, l.created_at) < now() - (s.sla_stage_days * interval '1 day'))
        )
    END;
$$;

GRANT EXECUTE ON FUNCTION public.leads_matching_sla(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leads_matching_sla(text) TO service_role;
