
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS lead_score integer NOT NULL DEFAULT 0;

-- Function to recalculate lead score for a contact
CREATE OR REPLACE FUNCTION public.calculate_lead_score(_contact_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  score integer := 0;
  activity_count integer;
  message_count integer;
  has_email boolean;
  has_phone boolean;
  contact_value numeric;
  contact_quality text;
BEGIN
  -- Points for activities (+10 each)
  SELECT COUNT(*) INTO activity_count FROM activities WHERE contact_id = _contact_id;
  score := score + (activity_count * 10);

  -- Points for messages (+20 for inbound, +5 for outbound)
  SELECT COALESCE(SUM(CASE WHEN direction = 'inbound' THEN 20 ELSE 5 END), 0)
  INTO message_count FROM messages WHERE contact_id = _contact_id;
  score := score + message_count;

  -- Points for having contact info
  SELECT email IS NOT NULL, phone IS NOT NULL, COALESCE(value, 0), COALESCE(quality::text, 'cold')
  INTO has_email, has_phone, contact_value, contact_quality
  FROM contacts WHERE id = _contact_id;

  IF has_email THEN score := score + 10; END IF;
  IF has_phone THEN score := score + 10; END IF;

  -- Points for deal value
  IF contact_value > 0 THEN score := score + LEAST((contact_value / 100)::integer, 50); END IF;

  -- Quality bonus
  IF contact_quality = 'hot' THEN score := score + 30;
  ELSIF contact_quality = 'warm' THEN score := score + 15;
  END IF;

  -- Update the contact's score
  UPDATE contacts SET lead_score = score WHERE id = _contact_id;

  RETURN score;
END;
$$;

-- Trigger to recalculate score when activities are added
CREATE OR REPLACE FUNCTION public.trigger_update_lead_score_on_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    PERFORM calculate_lead_score(NEW.contact_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER update_lead_score_on_activity
AFTER INSERT ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_lead_score_on_activity();

-- Trigger to recalculate score when messages are added
CREATE OR REPLACE FUNCTION public.trigger_update_lead_score_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL THEN
    PERFORM calculate_lead_score(NEW.contact_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER update_lead_score_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trigger_update_lead_score_on_message();
