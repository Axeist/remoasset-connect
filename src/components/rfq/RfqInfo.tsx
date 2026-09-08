/** User-facing copy so RFQ screens stay informative and consistent. */

export const RFQ_STATUS_HELP: Record<string, string> = {
  draft: 'Saved but not emailed yet. Review partners and send.',
  sent: 'Invites are out. Waiting for opens and quotes.',
  bidding: 'At least one quote received. Compare and award when ready.',
  awarded: 'Winner selected and notified. Finish handoff to PO.',
  expired: 'Deadline passed without an award.',
  cancelled: 'Campaign stopped. Vendors see this RFQ as closed.',
};

export const RFQ_RECIPIENT_HELP: Record<string, string> = {
  pending_send: 'Selected for this campaign; email not sent yet.',
  sent: 'Invite delivered to their inbox.',
  opened: 'They opened the quote link.',
  quoted: 'They submitted a quote with a quotation file.',
  declined: 'They declined this RFQ.',
  bounced: 'Email bounced — check the address on the vendor lead.',
  no_response: 'Deadline passed with no quote or decline.',
};
