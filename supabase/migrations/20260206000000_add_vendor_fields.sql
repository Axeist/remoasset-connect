-- Drop the old lead_score check constraint
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_lead_score_check;

-- Add new check constraint allowing 0-100
ALTER TABLE public.leads ADD CONSTRAINT leads_lead_score_check CHECK (lead_score >= 0 AND lead_score <= 100);

-- Add new vendor-related fields to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS vendor_type TEXT CHECK (vendor_type IN ('new_device', 'refurbished', 'rental')),
ADD COLUMN IF NOT EXISTS warehouse_available BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS warehouse_location TEXT,
ADD COLUMN IF NOT EXISTS warehouse_notes TEXT,
ADD COLUMN IF NOT EXISTS warehouse_price DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS warehouse_currency TEXT DEFAULT 'USD';

-- Set all existing lead scores to 0
UPDATE public.leads SET lead_score = 0 WHERE lead_score IS NOT NULL;

-- Set default lead score to 0 for new leads
ALTER TABLE public.leads ALTER COLUMN lead_score SET DEFAULT 0;
