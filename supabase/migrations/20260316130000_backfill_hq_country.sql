-- Backfill hq_country_id from first element of country_ids
-- for leads that have no HQ set but have at least one country served
UPDATE public.leads
SET hq_country_id = (country_ids)[1]
WHERE hq_country_id IS NULL
  AND array_length(country_ids, 1) > 0;
