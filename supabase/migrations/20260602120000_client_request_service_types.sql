-- Additional client request types: retrieval/redeployment, cross-border, ITAD
ALTER TABLE public.client_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'fulfillment'
    CHECK (request_type IN ('fulfillment', 'retrieval_redeployment', 'cross_border', 'itad')),
  ADD COLUMN IF NOT EXISTS from_address TEXT,
  ADD COLUMN IF NOT EXISTS to_address TEXT,
  ADD COLUMN IF NOT EXISTS service_request_date DATE,
  ADD COLUMN IF NOT EXISTS origin_country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_country_id UUID REFERENCES public.countries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin_poc_name TEXT,
  ADD COLUMN IF NOT EXISTS origin_poc_email TEXT,
  ADD COLUMN IF NOT EXISTS origin_poc_phone TEXT,
  ADD COLUMN IF NOT EXISTS destination_poc_name TEXT,
  ADD COLUMN IF NOT EXISTS destination_poc_email TEXT,
  ADD COLUMN IF NOT EXISTS destination_poc_phone TEXT,
  ADD COLUMN IF NOT EXISTS itad_services TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Device spec columns optional for non-fulfillment service requests
ALTER TABLE public.client_requests
  ALTER COLUMN brand DROP NOT NULL,
  ALTER COLUMN device_model DROP NOT NULL,
  ALTER COLUMN processor DROP NOT NULL,
  ALTER COLUMN display_size DROP NOT NULL,
  ALTER COLUMN ram DROP NOT NULL,
  ALTER COLUMN storage DROP NOT NULL;

ALTER TABLE public.client_requests
  DROP CONSTRAINT IF EXISTS client_requests_fulfillment_specs_check;

ALTER TABLE public.client_requests
  ADD CONSTRAINT client_requests_fulfillment_specs_check CHECK (
    request_type <> 'fulfillment'
    OR (
      brand IS NOT NULL AND brand <> ''
      AND device_model IS NOT NULL AND device_model <> ''
      AND processor IS NOT NULL AND processor <> ''
      AND display_size IS NOT NULL AND display_size <> ''
      AND ram IS NOT NULL AND ram <> ''
      AND storage IS NOT NULL AND storage <> ''
    )
  );

CREATE INDEX IF NOT EXISTS idx_cr_request_type ON public.client_requests(request_type);

COMMENT ON COLUMN public.client_requests.request_type IS 'fulfillment = laptop procurement; retrieval_redeployment; cross_border; itad';
COMMENT ON COLUMN public.client_requests.attachments IS 'JSON array of {type, url, name} for cross-border and other docs';

-- Storage for client request documents (cross-border customs, etc.)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-request-documents',
  'client-request-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload client request documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-request-documents');

CREATE POLICY "Authenticated read client request documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-request-documents');

CREATE POLICY "Authenticated delete client request documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-request-documents');
