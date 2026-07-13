-- RFQ Campaign module: campaigns, recipients, bids, email log

CREATE TABLE public.rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  client_request_id UUID REFERENCES public.client_requests(id) ON DELETE SET NULL,
  country_id UUID REFERENCES public.countries(id),
  rfq_type TEXT NOT NULL DEFAULT 'fulfillment'
    CHECK (rfq_type IN ('fulfillment', 'retrieval_redeployment', 'itad')),
  target_vendor_types TEXT[] NOT NULL DEFAULT '{}',
  scope_summary TEXT,
  quantity INTEGER DEFAULT 1,
  target_budget_usd DECIMAL(12,2),
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'bidding', 'awarded', 'expired', 'cancelled')),
  cc_emails TEXT[] NOT NULL DEFAULT '{}',
  email_subject TEXT,
  email_body_html TEXT,
  sealed_until TIMESTAMPTZ,
  unsealed_at TIMESTAMPTZ,
  award_rationale TEXT,
  awarded_bid_id UUID,
  awarded_vendor_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfqs_client_id ON public.rfqs(client_id);
CREATE INDEX idx_rfqs_status ON public.rfqs(status);
CREATE INDEX idx_rfqs_deadline ON public.rfqs(deadline);
CREATE INDEX idx_rfqs_owner_id ON public.rfqs(owner_id);

CREATE TRIGGER update_rfqs_updated_at
  BEFORE UPDATE ON public.rfqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rfq_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status TEXT NOT NULL DEFAULT 'pending_send'
    CHECK (status IN (
      'pending_send', 'sent', 'opened', 'quoted', 'declined', 'bounced', 'no_response'
    )),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  quoted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  reminded_at TIMESTAMPTZ,
  resend_message_id TEXT,
  decline_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, vendor_id)
);

CREATE INDEX idx_rfq_recipients_rfq_id ON public.rfq_recipients(rfq_id);
CREATE INDEX idx_rfq_recipients_token ON public.rfq_recipients(token);
CREATE INDEX idx_rfq_recipients_status ON public.rfq_recipients(status);

CREATE TRIGGER update_rfq_recipients_updated_at
  BEFORE UPDATE ON public.rfq_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.rfq_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.rfq_recipients(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  quoted_price DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  mrp_price DECIMAL(12,2),
  discount_pct DECIMAL(8,2),
  discount_amount DECIMAL(12,2),
  shipping_fee DECIMAL(12,2) DEFAULT 0,
  tax_fee DECIMAL(12,2) DEFAULT 0,
  other_fees DECIMAL(12,2) DEFAULT 0,
  total_landed DECIMAL(12,2),
  line_items JSONB DEFAULT '[]'::jsonb,
  quote_valid_until DATE,
  lead_time_days INTEGER,
  notes TEXT,
  quotation_file_path TEXT NOT NULL,
  quotation_file_name TEXT,
  pricing_status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (pricing_status IN ('submitted', 'revision_requested', 'accepted', 'rejected')),
  award_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (award_status IN ('pending', 'won', 'lost')),
  revision_note TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfq_bids_rfq_id ON public.rfq_bids(rfq_id);
CREATE INDEX idx_rfq_bids_recipient_id ON public.rfq_bids(recipient_id);

CREATE TRIGGER update_rfq_bids_updated_at
  BEFORE UPDATE ON public.rfq_bids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.rfqs
  ADD CONSTRAINT rfqs_awarded_bid_id_fkey
  FOREIGN KEY (awarded_bid_id) REFERENCES public.rfq_bids(id) ON DELETE SET NULL;

CREATE TABLE public.rfq_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id UUID NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.rfq_recipients(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  kind TEXT NOT NULL
    CHECK (kind IN (
      'rfq_invite', 'test_send', 'remind', 'award', 'not_selected', 'pricing_decision'
    )),
  to_email TEXT NOT NULL,
  cc_emails TEXT[] NOT NULL DEFAULT '{}',
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  resend_message_id TEXT,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfq_emails_rfq_id ON public.rfq_emails(rfq_id);
CREATE INDEX idx_rfq_emails_recipient_id ON public.rfq_emails(recipient_id);

-- Extend client_request statuses for RFQ-linked fulfillment
ALTER TABLE public.client_requests DROP CONSTRAINT IF EXISTS client_requests_status_check;
ALTER TABLE public.client_requests
  ADD CONSTRAINT client_requests_status_check
  CHECK (status IN (
    'pending',
    'rfq_in_progress',
    'quotes_received',
    'pricing_review',
    'vendor_allocated',
    'ordered',
    'po_sent',
    'in_transit',
    'fulfilled',
    'cancelled'
  ));

-- Storage for quotation PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rfq-quotations',
  'rfq-quotations',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can view rfq quotation files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rfq-quotations');

CREATE POLICY "Authenticated users can upload rfq quotation files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rfq-quotations');

-- RLS
ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfq_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rfqs"
  ON public.rfqs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rfqs"
  ON public.rfqs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rfqs"
  ON public.rfqs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete rfqs"
  ON public.rfqs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view rfq_recipients"
  ON public.rfq_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rfq_recipients"
  ON public.rfq_recipients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rfq_recipients"
  ON public.rfq_recipients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete rfq_recipients"
  ON public.rfq_recipients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view rfq_bids"
  ON public.rfq_bids FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rfq_bids"
  ON public.rfq_bids FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update rfq_bids"
  ON public.rfq_bids FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete rfq_bids"
  ON public.rfq_bids FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view rfq_emails"
  ON public.rfq_emails FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert rfq_emails"
  ON public.rfq_emails FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can delete rfq_emails"
  ON public.rfq_emails FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
