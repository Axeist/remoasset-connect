-- CloudTalk: settings, call log, dial intents, E.164 phone backfill

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS cloudtalk_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cloudtalk_default_from_e164 TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cloudtalk_agent_id INTEGER;

CREATE TABLE IF NOT EXISTS public.cloudtalk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_secret TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cloudtalk_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cloudtalk settings"
  ON public.cloudtalk_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.cloudtalk_dial_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_digits TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cloudtalk_dial_intents_digits_created_idx
  ON public.cloudtalk_dial_intents (phone_digits, created_at DESC);

ALTER TABLE public.cloudtalk_dial_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own dial intents"
  ON public.cloudtalk_dial_intents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own dial intents"
  ON public.cloudtalk_dial_intents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.cloudtalk_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cloudtalk_call_id TEXT NOT NULL UNIQUE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  activity_id UUID REFERENCES public.lead_activities(id) ON DELETE SET NULL,
  direction TEXT,
  status TEXT,
  from_number TEXT,
  to_number TEXT,
  agent_id TEXT,
  agent_name TEXT,
  duration_seconds INTEGER,
  waiting_seconds INTEGER,
  wrapup_seconds INTEGER,
  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  recorded BOOLEAN,
  is_voicemail BOOLEAN,
  recording_link TEXT,
  recording_storage_path TEXT,
  tags TEXT[],
  notes TEXT,
  ci_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cloudtalk_calls_lead_id_idx ON public.cloudtalk_calls (lead_id);
CREATE INDEX IF NOT EXISTS cloudtalk_calls_created_at_idx ON public.cloudtalk_calls (created_at DESC);

ALTER TABLE public.cloudtalk_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view cloudtalk calls"
  ON public.cloudtalk_calls FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can update all profiles for CloudTalk mapping"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Generated digits for lead matching
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS phone_digits TEXT
  GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), '')) STORED;

CREATE INDEX IF NOT EXISTS leads_phone_digits_idx ON public.leads (phone_digits);

CREATE TABLE IF NOT EXISTS public.country_calling_codes (
  iso2 TEXT PRIMARY KEY,
  calling_code TEXT NOT NULL
);

INSERT INTO public.country_calling_codes (iso2, calling_code) VALUES
  ('US','1'),('CA','1'),('PR','1'),
  ('EG','20'),('ZA','27'),('GR','30'),('NL','31'),('BE','32'),('FR','33'),('ES','34'),
  ('HU','36'),('IT','39'),('RO','40'),('CH','41'),('AT','43'),('GB','44'),('UK','44'),
  ('DK','45'),('SE','46'),('NO','47'),('PL','48'),('DE','49'),
  ('PE','51'),('MX','52'),('AR','53'),('BR','55'),('CL','56'),('CO','57'),('VE','58'),
  ('MY','60'),('AU','61'),('ID','62'),('PH','63'),('NZ','64'),('SG','65'),('TH','66'),
  ('JP','81'),('KR','82'),('VN','84'),('CN','86'),('TR','90'),('IN','91'),('PK','92'),
  ('AF','93'),('LK','94'),('MM','95'),('IR','98'),
  ('SS','211'),('MA','212'),('DZ','213'),('TN','216'),('LY','218'),('GM','220'),
  ('SN','221'),('MR','222'),('ML','223'),('GN','224'),('CI','225'),('BF','226'),
  ('NE','227'),('TG','228'),('BJ','229'),('MU','230'),('LR','231'),('SL','232'),
  ('GH','233'),('NG','234'),('TD','235'),('CF','236'),('CM','237'),('CV','238'),
  ('ST','239'),('GQ','240'),('GA','241'),('CG','242'),('CD','243'),('AO','244'),
  ('GW','245'),('SC','248'),('SD','249'),('RW','250'),('ET','251'),('SO','252'),
  ('DJ','253'),('KE','254'),('TZ','255'),('UG','256'),('BI','257'),('MZ','258'),
  ('ZM','260'),('MG','261'),('RE','262'),('ZW','263'),('NA','264'),('MW','265'),
  ('LS','266'),('BW','267'),('SZ','268'),('KM','269'),('ER','291'),('AW','297'),
  ('FO','298'),('GL','299'),('GI','350'),('PT','351'),('LU','352'),('IE','353'),
  ('IS','354'),('AL','355'),('MT','356'),('CY','357'),('FI','358'),('BG','359'),
  ('LT','370'),('LV','371'),('EE','372'),('MD','373'),('AM','374'),('BY','375'),
  ('AD','376'),('MC','377'),('SM','378'),('UA','380'),('RS','381'),('ME','382'),
  ('HR','385'),('SI','386'),('BA','387'),('MK','389'),('CZ','420'),('SK','421'),
  ('LI','423'),('FK','500'),('BZ','501'),('GT','502'),('SV','503'),('HN','504'),
  ('NI','505'),('CR','506'),('PA','507'),('PM','508'),('HT','509'),('GP','590'),
  ('BO','591'),('GY','592'),('EC','593'),('GF','594'),('PY','595'),('MQ','596'),
  ('SR','597'),('UY','598'),('TL','670'),('BN','673'),('NR','674'),('PG','675'),
  ('TO','676'),('SB','677'),('VU','678'),('FJ','679'),('PW','680'),('WF','681'),
  ('CK','682'),('NU','683'),('WS','685'),('KI','686'),('NC','687'),('TV','688'),
  ('PF','689'),('TK','690'),('FM','691'),('MH','692'),('KP','850'),('HK','852'),
  ('MO','853'),('KH','855'),('LA','856'),('BD','880'),('TW','886'),('MV','960'),
  ('LB','961'),('JO','962'),('SY','963'),('IQ','964'),('KW','965'),('SA','966'),
  ('YE','967'),('OM','968'),('PS','970'),('AE','971'),('IL','972'),('BH','973'),
  ('QA','974'),('BT','975'),('MN','976'),('NP','977'),('TJ','992'),('TM','993'),
  ('AZ','994'),('GE','995'),('KG','996'),('UZ','998')
ON CONFLICT (iso2) DO UPDATE SET calling_code = EXCLUDED.calling_code;

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

-- Backfill primary phones
UPDATE public.leads l
SET phone = public.normalize_phone_e164(l.phone, public.lead_iso2_for_phone(l.hq_country_id, l.country_ids))
WHERE l.phone IS NOT NULL
  AND btrim(l.phone) <> ''
  AND public.normalize_phone_e164(l.phone, public.lead_iso2_for_phone(l.hq_country_id, l.country_ids)) IS DISTINCT FROM l.phone;

-- Backfill additional_contacts phones
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

CREATE OR REPLACE FUNCTION public.match_lead_id_by_phone_digits(p_digits TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  suffix TEXT;
  found_id UUID;
BEGIN
  IF p_digits IS NULL OR length(p_digits) < 7 THEN
    RETURN NULL;
  END IF;
  suffix := right(p_digits, 8);

  SELECT lead_id INTO found_id
  FROM public.cloudtalk_dial_intents
  WHERE right(phone_digits, 8) = suffix
    AND created_at > now() - interval '30 minutes'
  ORDER BY created_at DESC
  LIMIT 1;
  IF found_id IS NOT NULL THEN
    RETURN found_id;
  END IF;

  SELECT id INTO found_id
  FROM public.leads
  WHERE phone_digits IS NOT NULL AND right(phone_digits, 8) = suffix
  ORDER BY updated_at DESC
  LIMIT 1;
  IF found_id IS NOT NULL THEN
    RETURN found_id;
  END IF;

  SELECT l.id INTO found_id
  FROM public.leads l,
    LATERAL jsonb_array_elements(COALESCE(l.additional_contacts, '[]'::jsonb)) elem
  WHERE jsonb_typeof(l.additional_contacts) = 'array'
    AND right(regexp_replace(COALESCE(elem->>'phone', ''), '[^0-9]', '', 'g'), 8) = suffix
  ORDER BY l.updated_at DESC
  LIMIT 1;

  RETURN found_id;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings',
  true,
  52428800,
  ARRAY['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mpeg', 'audio/mp3', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read call recordings"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'call-recordings');

CREATE POLICY "Service role uploads call recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'call-recordings' AND public.has_role(auth.uid(), 'admin'));

COMMENT ON FUNCTION public.normalize_phone_e164 IS
  'E.164 for CloudTalk C2C. Backfill uses HQ / first country; skips short local numbers without a country.';

GRANT EXECUTE ON FUNCTION public.normalize_phone_e164(TEXT, TEXT) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.match_lead_id_by_phone_digits(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_lead_id_by_phone_digits(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.lead_iso2_for_phone(UUID, UUID[]) TO authenticated, service_role;
