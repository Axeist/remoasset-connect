-- Recreate ISO2 helper without a leads row-type argument (Postgres could not
-- resolve lead_iso2_for_phone(l) as public.leads). Re-run phone backfill.

DROP FUNCTION IF EXISTS public.lead_iso2_for_phone(public.leads);
DROP FUNCTION IF EXISTS public.lead_iso2_for_phone(leads);

CREATE OR REPLACE FUNCTION public.normalize_phone_e164(p_raw TEXT, p_iso2 TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed TEXT;
  international BOOLEAN;
  digits TEXT;
  cc TEXT;
BEGIN
  IF p_raw IS NULL OR btrim(p_raw) = '' THEN
    RETURN NULL;
  END IF;
  trimmed := btrim(p_raw);
  international := left(trimmed, 1) = '+' OR left(trimmed, 2) = '00';
  digits := regexp_replace(trimmed, '[^0-9]', '', 'g');
  IF digits IS NULL OR length(digits) < 6 THEN
    RETURN trimmed;
  END IF;
  IF international THEN
    IF length(digits) < 8 OR length(digits) > 15 THEN
      RETURN trimmed;
    END IF;
    RETURN '+' || digits;
  END IF;
  IF p_iso2 IS NOT NULL THEN
    SELECT c.calling_code INTO cc
    FROM public.country_calling_codes c
    WHERE c.iso2 = upper(p_iso2);
  END IF;
  IF cc IS NULL THEN
    IF length(digits) >= 11 AND length(digits) <= 15 THEN
      RETURN '+' || digits;
    END IF;
    RETURN trimmed;
  END IF;
  IF digits LIKE cc || '%' AND length(digits) > length(cc) + 5 THEN
    RETURN '+' || digits;
  END IF;
  digits := regexp_replace(digits, '^0+', '');
  digits := cc || digits;
  IF length(digits) < 8 OR length(digits) > 15 THEN
    RETURN trimmed;
  END IF;
  RETURN '+' || digits;
END;
$$;

CREATE OR REPLACE FUNCTION public.lead_iso2_for_phone(p_hq_country_id UUID, p_country_ids UUID[])
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT c.code FROM public.countries c WHERE c.id = p_hq_country_id),
    (SELECT c.code FROM public.countries c WHERE c.id = p_country_ids[1])
  );
$$;

GRANT EXECUTE ON FUNCTION public.lead_iso2_for_phone(UUID, UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.normalize_phone_e164(TEXT, TEXT) TO authenticated, service_role;

UPDATE public.leads l
SET phone = public.normalize_phone_e164(l.phone, public.lead_iso2_for_phone(l.hq_country_id, l.country_ids))
WHERE l.phone IS NOT NULL
  AND btrim(l.phone) <> ''
  AND public.normalize_phone_e164(l.phone, public.lead_iso2_for_phone(l.hq_country_id, l.country_ids)) IS DISTINCT FROM l.phone;

UPDATE public.leads l
SET additional_contacts = sub.updated
FROM (
  SELECT
    l2.id,
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN jsonb_typeof(elem) = 'object' AND COALESCE(elem->>'phone', '') <> ''
            THEN elem || jsonb_build_object(
              'phone',
              public.normalize_phone_e164(elem->>'phone', public.lead_iso2_for_phone(l2.hq_country_id, l2.country_ids))
            )
            ELSE elem
          END
        )
        FROM jsonb_array_elements(COALESCE(l2.additional_contacts, '[]'::jsonb)) elem
      ),
      '[]'::jsonb
    ) AS updated
  FROM public.leads l2
  WHERE l2.additional_contacts IS NOT NULL
    AND jsonb_typeof(l2.additional_contacts) = 'array'
) sub
WHERE l.id = sub.id
  AND l.additional_contacts IS DISTINCT FROM sub.updated;
