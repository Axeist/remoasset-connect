-- Add 'quotation' to the document_type check constraint on lead_documents

ALTER TABLE public.lead_documents
  DROP CONSTRAINT IF EXISTS lead_documents_document_type_check;

ALTER TABLE public.lead_documents
  ADD CONSTRAINT lead_documents_document_type_check
  CHECK (document_type IN ('nda', 'pricing', 'custom', 'quotation'));
