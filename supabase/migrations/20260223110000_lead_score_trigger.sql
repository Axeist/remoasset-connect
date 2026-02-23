-- ============================================================
-- Automatic lead_score update via trigger on lead_activities
-- Runs with SECURITY DEFINER so it always has permission to
-- update leads regardless of the caller's RLS context.
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_lead_score_on_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_points   INTEGER;
  v_current  INTEGER;
  v_new      INTEGER;
BEGIN
  -- Base points per activity type
  CASE NEW.activity_type
    WHEN 'call'      THEN v_points := 6;
    WHEN 'email'     THEN v_points := 3;
    WHEN 'meeting'   THEN v_points := 10;
    WHEN 'whatsapp'  THEN v_points := 5;
    ELSE                  v_points := 1;   -- 'note' and any future type
  END CASE;

  -- Bonus for emails where the contact replied / showed interest
  IF NEW.activity_type = 'email' AND NEW.description ~* 
    '(replied|reply|responded|response|interested|confirmed|agreed|scheduled|booked)'
  THEN
    v_points := v_points + 8;
  END IF;

  -- Read current score (default 0 if somehow NULL)
  SELECT COALESCE(lead_score, 0) INTO v_current
  FROM public.leads
  WHERE id = NEW.lead_id;

  -- Clamp new score to [0, 100]
  v_new := GREATEST(0, LEAST(100, v_current + v_points));

  -- Update the lead score
  UPDATE public.leads
  SET lead_score = v_new
  WHERE id = NEW.lead_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop old trigger if it exists, then re-create
DROP TRIGGER IF EXISTS trg_update_lead_score ON public.lead_activities;

CREATE TRIGGER trg_update_lead_score
  AFTER INSERT ON public.lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_score_on_activity();
