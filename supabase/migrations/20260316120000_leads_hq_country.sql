-- Add HQ country (single FK) separate from the countries they serve (array)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS hq_country_id UUID REFERENCES public.countries(id);
