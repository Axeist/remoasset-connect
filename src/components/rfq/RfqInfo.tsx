/** User-facing copy so RFQ screens stay informative and consistent. */

export const RFQ_HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Raise',
    body: 'Choose client, country, vendor types, scope, and deadline.',
  },
  {
    step: '2',
    title: 'Match & mail',
    body: 'Invite Closed partners in that country. Edit the email, then send.',
  },
  {
    step: '3',
    title: 'Track',
    body: 'See who was emailed, who opened, and who quoted.',
  },
  {
    step: '4',
    title: 'Award',
    body: 'Compare landed cost, award a winner, continue fulfillment.',
  },
] as const;

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

export function HowItWorksStrip() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {RFQ_HOW_IT_WORKS.map((item) => (
        <div key={item.step} className="rounded-xl border bg-card p-3.5">
          <p className="text-xs font-bold text-primary mb-1">
            Step {item.step} · {item.title}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
        </div>
      ))}
    </div>
  );
}
