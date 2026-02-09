-- Replace single vendor_type with multi-select vendor_types (TEXT[])
-- So a lead can be e.g. both New Device and Refurbished

-- Add new array column
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS vendor_types TEXT[] DEFAULT '{}';

-- Migrate existing single vendor_type into array (only where we have data)
UPDATE public.leads
SET vendor_types = ARRAY[vendor_type]
WHERE vendor_type IS NOT NULL AND trim(vendor_type) != '';

-- Drop old column and its check
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_vendor_type_check;
ALTER TABLE public.leads DROP COLUMN IF EXISTS vendor_type;

-- Constraint: each element must be one of the allowed values
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS leads_vendor_types_check;
ALTER TABLE public.leads
ADD CONSTRAINT leads_vendor_types_check
CHECK (vendor_types <@ ARRAY['new_device', 'refurbished', 'rental']::text[]);
