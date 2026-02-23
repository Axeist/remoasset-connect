-- Add additional_contacts JSONB column for multiple POC support
-- Primary contact remains in contact_name, email, phone, contact_designation
-- Additional contacts stored as JSONB array: [{name, email, phone, designation}]
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS additional_contacts JSONB DEFAULT '[]'::jsonb;
