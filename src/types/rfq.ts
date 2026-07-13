import type { VendorType } from '@/lib/vendorTypes';

export type RfqType = 'fulfillment' | 'retrieval_redeployment' | 'itad';

export type RfqStatus = 'draft' | 'sent' | 'bidding' | 'awarded' | 'expired' | 'cancelled';

export type RfqRecipientStatus =
  | 'pending_send'
  | 'sent'
  | 'opened'
  | 'quoted'
  | 'declined'
  | 'bounced'
  | 'no_response';

export type RfqPricingStatus = 'submitted' | 'revision_requested' | 'accepted' | 'rejected';
export type RfqAwardStatus = 'pending' | 'won' | 'lost';
export type RfqEmailKind =
  | 'rfq_invite'
  | 'test_send'
  | 'remind'
  | 'award'
  | 'not_selected'
  | 'pricing_decision';

export interface Rfq {
  id: string;
  client_id: string;
  client_request_id: string | null;
  country_id: string | null;
  rfq_type: RfqType;
  target_vendor_types: VendorType[] | string[];
  scope_summary: string | null;
  quantity: number | null;
  target_budget_usd: number | null;
  deadline: string;
  status: RfqStatus;
  cc_emails: string[];
  email_subject: string | null;
  email_body_html: string | null;
  sealed_until: string | null;
  unsealed_at: string | null;
  award_rationale: string | null;
  awarded_bid_id: string | null;
  awarded_vendor_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: { id: string; name: string } | null;
  country?: { id: string; name: string; code?: string } | null;
}

export interface RfqRecipient {
  id: string;
  rfq_id: string;
  vendor_id: string;
  email: string;
  token: string;
  status: RfqRecipientStatus;
  sent_at: string | null;
  opened_at: string | null;
  quoted_at: string | null;
  declined_at: string | null;
  reminded_at: string | null;
  resend_message_id: string | null;
  decline_reason: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { id: string; company_name: string } | null;
}

export interface RfqBid {
  id: string;
  rfq_id: string;
  recipient_id: string;
  vendor_id: string;
  quoted_price: number;
  currency: string;
  mrp_price: number | null;
  discount_pct: number | null;
  discount_amount: number | null;
  shipping_fee: number | null;
  tax_fee: number | null;
  other_fees: number | null;
  total_landed: number | null;
  line_items: unknown;
  quote_valid_until: string | null;
  lead_time_days: number | null;
  notes: string | null;
  quotation_file_path: string;
  quotation_file_name: string | null;
  pricing_status: RfqPricingStatus;
  award_status: RfqAwardStatus;
  revision_note: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  vendor?: { id: string; company_name: string } | null;
}

export interface RfqEmail {
  id: string;
  rfq_id: string;
  recipient_id: string | null;
  direction: 'outbound' | 'inbound';
  kind: RfqEmailKind;
  to_email: string;
  cc_emails: string[];
  subject: string;
  body_html: string;
  body_text: string | null;
  resend_message_id: string | null;
  sent_by: string | null;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  bounced_at: string | null;
  created_at: string;
}

export const RFQ_STATUS_LABELS: Record<RfqStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  bidding: 'Bidding',
  awarded: 'Awarded',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export const RFQ_RECIPIENT_STATUS_LABELS: Record<RfqRecipientStatus, string> = {
  pending_send: 'Pending',
  sent: 'Sent',
  opened: 'Opened',
  quoted: 'Quoted',
  declined: 'Declined',
  bounced: 'Bounced',
  no_response: 'No response',
};

export const CLOSED_STATUS_PATTERNS = ['won', 'closed won', 'closed-won', 'closed'];
