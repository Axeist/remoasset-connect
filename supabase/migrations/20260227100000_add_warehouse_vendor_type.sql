-- Allow 'warehouse' in leads.vendor_types (form already supports it)
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_vendor_types_check;

ALTER TABLE public.leads
ADD CONSTRAINT leads_vendor_types_check
CHECK (vendor_types <@ ARRAY['new_device', 'refurbished', 'rental', 'warehouse']::text[]);
