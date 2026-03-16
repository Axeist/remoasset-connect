-- ============================================================
-- STEP 1: Add region column
-- ============================================================
ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS region TEXT;

-- ============================================================
-- STEP 2: Drop the unique constraint on name so we can work freely
-- ============================================================
ALTER TABLE public.countries DROP CONSTRAINT IF EXISTS countries_name_key;
ALTER TABLE public.countries DROP CONSTRAINT IF EXISTS countries_code_key;

-- ============================================================
-- STEP 3: Fix wrong / non-standard codes on existing rows
-- Order matters: free up a target code BEFORE assigning it to another row.
-- ============================================================

-- CHINA CH → CN  (must happen before Switzerland gets CH)
UPDATE public.countries SET code = 'CN' WHERE id = '8544a416-e1a3-4c2d-bdb3-082dd0a43758';
-- Russia RS → RU  (must happen before Serbia gets RS)
UPDATE public.countries SET code = 'RU' WHERE id = '79181c34-6038-4416-86ba-54953aff1636';
-- Serbia SE → RS  (must happen before Sweden gets SE)
UPDATE public.countries SET code = 'RS' WHERE id = '9d5a7b33-1065-4880-8da3-c03f59d0d457';
-- South Korea SK → KR  (must happen before Slovakia gets SK)
UPDATE public.countries SET code = 'KR' WHERE id = 'c153a63a-c41a-4e28-9a9f-9a4e1c98d1ee';
-- Croatia CR → HR  (must happen before Costa Rica gets CR)
UPDATE public.countries SET code = 'HR' WHERE id = 'cd1aa08d-1948-478f-97bf-3a90501d4b75';
-- Armenia AR → AM  (must happen before Argentina gets AR)
UPDATE public.countries SET code = 'AM' WHERE id = 'e2b76058-3a21-4fd9-941f-4597e6b7c9fe';
-- Latvia LA → LV  (must happen before Laos insert gets LA)
UPDATE public.countries SET code = 'LV' WHERE id = 'cbee94c6-10da-41bb-8e91-8d53b33e163a';
-- Ireland IR → IE  (free IR before any Iran row)
UPDATE public.countries SET code = 'IE' WHERE id = 'a6fe79a2-3c88-4ae4-83db-a558b909d22c';

-- Now safe to assign the freed codes:
-- Switzerland SW → CH  (CH now free)
UPDATE public.countries SET code = 'CH' WHERE id = '4800d907-9c07-4bb8-9761-3896b91ec490';
-- Sweden SD → SE  (SE now free)
UPDATE public.countries SET code = 'SE' WHERE id = 'bdda3a20-0700-4e04-94bd-af5eae5fd26c';
-- Costa Rica CI → CR  (CR now free)
UPDATE public.countries SET code = 'CR' WHERE id = '427026c0-26d8-4740-a633-d56e76cf6990';
-- Argentina AG → AR  (AR now free)
UPDATE public.countries SET code = 'AR' WHERE id = 'e836efdc-b3b2-48d4-a67c-e0a941ed140c';

-- Remaining straightforward fixes (no ordering dependency):
-- Turkey TK → TR
UPDATE public.countries SET code = 'TR' WHERE id = '0eb6119b-8286-4e4e-b8c9-77543a9e6e90';
-- Indonesia IA → ID (dupe — merged below)
UPDATE public.countries SET code = 'ID' WHERE id = '14aa3e7c-e3e5-4ab2-8060-e0fe1b72cd4c';
-- Morocco MO → MA
UPDATE public.countries SET code = 'MA' WHERE id = '2a7a7fea-8f9c-4f0f-bea0-ce767ad7a34c';
-- Uruguay UR → UY
UPDATE public.countries SET code = 'UY' WHERE id = '759b059f-328c-4d32-bbd9-22e03866c6e4';
-- Germany GM → DE (dupe — merged below)
UPDATE public.countries SET code = 'DE' WHERE id = 'a00a872d-6fc7-4eae-8726-51f8c1b28bf9';
-- Greece GK → GR
UPDATE public.countries SET code = 'GR' WHERE id = 'aafb768a-c104-4ea7-a667-961f2ca6f525';
-- Poland PO → PL
UPDATE public.countries SET code = 'PL' WHERE id = 'c4206850-893b-4723-9044-9aff520790eb';
-- Bulgaria BU → BG
UPDATE public.countries SET code = 'BG' WHERE id = 'd60042fe-e2b6-4c0a-b174-2d517a22d40d';
-- Qatar QT → QA
UPDATE public.countries SET code = 'QA' WHERE id = 'd8bfa18b-a56d-4d6a-8c19-e4637e25c0d7';
-- Malaysia ML → MY
UPDATE public.countries SET code = 'MY' WHERE id = 'e8790bce-c725-4ba2-884c-9b824aa7e788';
-- Bahrain BA → BH
UPDATE public.countries SET code = 'BH' WHERE id = 'e9e9177d-d687-4cbe-9cdd-d9cfd22396e1';
-- Thailand TI → TH
UPDATE public.countries SET code = 'TH' WHERE id = 'f2ef6403-b29f-48c5-99c4-367929a7f087';
-- Israel IS → IL
UPDATE public.countries SET code = 'IL' WHERE id = 'f367664e-21c4-413f-925b-16f54c695ab5';
-- Vietnam VT → VN
UPDATE public.countries SET code = 'VN' WHERE id = '4a702daf-ce0d-4dd1-afd3-1a687b215d54';
-- South Africa SF → ZA
UPDATE public.countries SET code = 'ZA' WHERE id = '09cef11e-eb2e-491b-953c-98b442252779';
-- North Macedonia NM → MK
UPDATE public.countries SET code = 'MK' WHERE id = 'bf80f160-970e-420e-b2ad-d1f7a65e677e';
-- Ukraine UE → UA
UPDATE public.countries SET code = 'UA' WHERE id = '869173ca-4572-4bab-ba36-456743b89597';
-- Georgia Tbilisi GT → GE, rename to Georgia
UPDATE public.countries SET code = 'GE', name = 'Georgia' WHERE id = '7f3f7280-9338-4459-9a82-a695d9b22009';

-- Name-only fixes (typos)
-- Sovenia → Slovenia, SO → SI
UPDATE public.countries SET code = 'SI', name = 'Slovenia' WHERE id = '56a5678e-7d8d-4a78-ad9f-077c208e0eda';
-- Solakia → Slovakia, SI → SK  (SI now free after Slovenia took it)
UPDATE public.countries SET code = 'SK', name = 'Slovakia' WHERE id = '5d6d537d-6cd3-416f-8568-cfdf6df709e7';
-- Srilanka → Sri Lanka, SL → LK
UPDATE public.countries SET code = 'LK', name = 'Sri Lanka' WHERE id = 'eba80971-71cb-4507-a7f9-5b2b03f7d95a';
-- Columbia → Colombia
UPDATE public.countries SET name = 'Colombia' WHERE id = '27c7dd40-04d9-458f-bdeb-c9c209432d2d';
-- Baharin → Bahrain
UPDATE public.countries SET name = 'Bahrain' WHERE id = 'e9e9177d-d687-4cbe-9cdd-d9cfd22396e1';
-- Dubai → United Arab Emirates duplicate; re-point leads then delete
UPDATE public.leads SET country_id = 'b9c3f7ec-95e7-4210-a5a0-8536ac19771d'
  WHERE country_id = '1519ca1f-4e30-4b37-9d95-a27fe7a8bc41';
DELETE FROM public.countries WHERE id = '1519ca1f-4e30-4b37-9d95-a27fe7a8bc41';
-- Europe (not a country) → delete, re-point leads to NULL
UPDATE public.leads SET country_id = NULL
  WHERE country_id = 'bf9a209b-fa35-40cb-a8f9-eb8ae0f6f0e5';
DELETE FROM public.countries WHERE id = 'bf9a209b-fa35-40cb-a8f9-eb8ae0f6f0e5';
-- North Macedonia NM → MK
UPDATE public.countries SET code = 'MK' WHERE id = 'bf80f160-970e-420e-b2ad-d1f7a65e677e';
-- Ukraine UE → UA
UPDATE public.countries SET code = 'UA' WHERE id = '869173ca-4572-4bab-ba36-456743b89597';

-- ============================================================
-- STEP 4: Merge true duplicates (same country, two rows)
--         Keep the older/canonical row, re-point leads, delete the dupe
-- ============================================================

-- Germany: keep 3f04806f (DE, older), delete a00a872d (DE, newer)
UPDATE public.leads SET country_id = '3f04806f-c385-4302-9728-2bb4c658058a'
  WHERE country_id = 'a00a872d-6fc7-4eae-8726-51f8c1b28bf9';
DELETE FROM public.countries WHERE id = 'a00a872d-6fc7-4eae-8726-51f8c1b28bf9';

-- Indonesia: keep 9673891a (ID, older), delete 14aa3e7c (ID, newer)
UPDATE public.leads SET country_id = '9673891a-ab67-40dc-b47a-bf8c0e9ad0f7'
  WHERE country_id = '14aa3e7c-e3e5-4ab2-8060-e0fe1b72cd4c';
DELETE FROM public.countries WHERE id = '14aa3e7c-e3e5-4ab2-8060-e0fe1b72cd4c';

-- Argentina: keep e2b76058 is Armenia(AM); e836efdc is Argentina(AR) — no true dupe, both kept
-- France: a4f07c45 (FR) — only one row, no dupe

-- ============================================================
-- STEP 5: Standardize all names to Title Case
-- ============================================================
UPDATE public.countries
SET name = initcap(lower(name))
WHERE name IS NOT NULL;

-- ============================================================
-- STEP 6: Assign regions
-- ============================================================
UPDATE public.countries SET region = 'NA'    WHERE code IN ('US', 'CA');
UPDATE public.countries SET region = 'EU'    WHERE code IN ('UK', 'GB', 'DE', 'NL', 'FR', 'IT', 'ES', 'BE', 'AT', 'PL', 'SE', 'CH', 'IE', 'PT', 'GR', 'RO', 'CZ', 'HU', 'FI', 'NO', 'DK', 'LU', 'SK', 'BG', 'HR', 'SI', 'EE', 'LV', 'LT', 'MT', 'CY', 'AL', 'RS', 'MK', 'UA', 'RU', 'AM', 'GE');
UPDATE public.countries SET region = 'ANZ'   WHERE code IN ('AU', 'NZ');
UPDATE public.countries SET region = 'APAC'  WHERE code IN ('IN', 'SG', 'JP', 'CN', 'KR', 'HK', 'TW', 'TH', 'MY', 'ID', 'PH', 'VN', 'PK', 'BD', 'LK', 'NP', 'MM', 'KH', 'LA', 'MO', 'BN');
UPDATE public.countries SET region = 'MENA'  WHERE code IN ('AE', 'SA', 'QA', 'BH', 'KW', 'OM', 'EG', 'IL', 'TR', 'JO', 'LB', 'SY', 'IQ', 'IR', 'YE', 'MA', 'TN', 'DZ', 'LY', 'PS');
UPDATE public.countries SET region = 'LATAM' WHERE code IN ('MX', 'BR', 'AR', 'CL', 'CO', 'PE', 'EC', 'VE', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR', 'JM', 'TT', 'BS', 'BB', 'BZ', 'GY', 'SR');
UPDATE public.countries SET region = 'APAC'  WHERE code IN ('ZA', 'KE', 'NG', 'BW') AND region IS NULL;
-- Africa overrides (not APAC)
UPDATE public.countries SET region = 'Africa' WHERE code IN ('ZA', 'KE', 'NG', 'BW');

-- ============================================================
-- STEP 7: Re-add unique constraints on clean data
-- ============================================================
ALTER TABLE public.countries ADD CONSTRAINT countries_name_key UNIQUE (name);
ALTER TABLE public.countries ADD CONSTRAINT countries_code_key UNIQUE (code);

-- ============================================================
-- STEP 8: Insert any missing standard countries (skip existing by code)
-- ============================================================
INSERT INTO public.countries (name, code, region) VALUES
  ('Oman', 'OM', 'MENA'),
  ('Kuwait', 'KW', 'MENA'),
  ('Iraq', 'IQ', 'MENA'),
  ('Iran', 'IR', 'MENA'),
  ('Syria', 'SY', 'MENA'),
  ('Lebanon', 'LB', 'MENA'),
  ('Jordan', 'JO', 'MENA'),
  ('Yemen', 'YE', 'MENA'),
  ('Libya', 'LY', 'MENA'),
  ('Algeria', 'DZ', 'MENA'),
  ('Tunisia', 'TN', 'MENA'),
  ('Palestine', 'PS', 'MENA'),
  ('Ecuador', 'EC', 'LATAM'),
  ('Venezuela', 'VE', 'LATAM'),
  ('Cuba', 'CU', 'LATAM'),
  ('Bolivia', 'BO', 'LATAM'),
  ('Dominican Republic', 'DO', 'LATAM'),
  ('Honduras', 'HN', 'LATAM'),
  ('Paraguay', 'PY', 'LATAM'),
  ('El Salvador', 'SV', 'LATAM'),
  ('Nicaragua', 'NI', 'LATAM'),
  ('Panama', 'PA', 'LATAM'),
  ('Puerto Rico', 'PR', 'LATAM'),
  ('Jamaica', 'JM', 'LATAM'),
  ('Trinidad and Tobago', 'TT', 'LATAM'),
  ('Bahamas', 'BS', 'LATAM'),
  ('Barbados', 'BB', 'LATAM'),
  ('Belize', 'BZ', 'LATAM'),
  ('Guyana', 'GY', 'LATAM'),
  ('Suriname', 'SR', 'LATAM'),
  ('China', 'CN', 'APAC'),
  ('Taiwan', 'TW', 'APAC'),
  ('Bangladesh', 'BD', 'APAC'),
  ('Nepal', 'NP', 'APAC'),
  ('Myanmar', 'MM', 'APAC'),
  ('Cambodia', 'KH', 'APAC'),
  ('Laos', 'LA', 'APAC'),
  ('Macau', 'MC', 'APAC'),
  ('Brunei', 'BN', 'APAC'),
  ('Italy', 'IT', 'EU'),
  ('Austria', 'AT', 'EU'),
  ('Hungary', 'HU', 'EU'),
  ('Norway', 'NO', 'EU'),
  ('Denmark', 'DK', 'EU'),
  ('Luxembourg', 'LU', 'EU'),
  ('Estonia', 'EE', 'EU'),
  ('Lithuania', 'LT', 'EU'),
  ('Malta', 'MT', 'EU'),
  ('Cyprus', 'CY', 'EU'),
  ('Portugal', 'PT', 'EU')
ON CONFLICT (code) DO UPDATE SET region = EXCLUDED.region;
