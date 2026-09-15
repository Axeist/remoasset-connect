ALTER TABLE public.rfq_emails DROP CONSTRAINT IF EXISTS rfq_emails_kind_check;
ALTER TABLE public.rfq_emails ADD CONSTRAINT rfq_emails_kind_check
  CHECK (kind IN (
    'rfq_invite',
    'test_send',
    'remind',
    'award',
    'not_selected',
    'pricing_decision',
    'quote_received'
  ));
