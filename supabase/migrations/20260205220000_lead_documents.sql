-- Lead documents: NDA, Pricing, and custom documents per lead
CREATE TABLE public.lead_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('nda', 'pricing', 'custom')),
  custom_name TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_lead_documents_lead_id ON public.lead_documents(lead_id);

ALTER TABLE public.lead_documents ENABLE ROW LEVEL SECURITY;

-- Users can view documents for leads they own or are allowed to see (same as leads)
CREATE POLICY "Users can view lead documents for their leads"
ON public.lead_documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_documents.lead_id
    AND (leads.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Users can insert lead documents for their leads"
ON public.lead_documents FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.leads
    WHERE leads.id = lead_documents.lead_id
    AND (leads.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

CREATE POLICY "Users can delete own lead documents"
ON public.lead_documents FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Storage bucket for lead documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lead-documents',
  'lead-documents',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users; path must be under lead_id folder
CREATE POLICY "Authenticated upload lead documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lead-documents');

CREATE POLICY "Authenticated read lead documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lead-documents');

CREATE POLICY "Authenticated delete own lead documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lead-documents');
