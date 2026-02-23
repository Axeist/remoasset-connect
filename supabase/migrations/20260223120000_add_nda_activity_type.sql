-- Add 'nda' to allowed activity types
ALTER TABLE public.lead_activities
  DROP CONSTRAINT IF EXISTS lead_activities_activity_type_check;

ALTER TABLE public.lead_activities
  ADD CONSTRAINT lead_activities_activity_type_check
  CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'whatsapp', 'nda'));

-- Update the score trigger to include nda
CREATE OR REPLACE FUNCTION public.update_lead_score_on_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_points   INTEGER;
  v_current  INTEGER;
  v_new      INTEGER;
BEGIN
  CASE NEW.activity_type
    WHEN 'call'      THEN v_points := 6;
    WHEN 'email'     THEN v_points := 3;
    WHEN 'meeting'   THEN v_points := 10;
    WHEN 'whatsapp'  THEN v_points := 5;
    WHEN 'nda'       THEN v_points := 8;
    ELSE                  v_points := 1;
  END CASE;

  IF NEW.activity_type = 'email' AND NEW.description ~*
    '(replied|reply|responded|response|interested|confirmed|agreed|scheduled|booked)'
  THEN
    v_points := v_points + 8;
  END IF;

  -- NDA Received gets bonus points (deal closing)
  IF NEW.activity_type = 'nda' AND NEW.description ~* 'NDA Received' THEN
    v_points := v_points + 7;
  END IF;

  SELECT COALESCE(lead_score, 0) INTO v_current
  FROM public.leads WHERE id = NEW.lead_id;

  v_new := GREATEST(0, LEAST(100, v_current + v_points));

  UPDATE public.leads SET lead_score = v_new WHERE id = NEW.lead_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
