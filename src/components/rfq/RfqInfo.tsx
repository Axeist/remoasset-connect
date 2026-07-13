import type { ReactNode } from 'react';

/** User-facing copy so RFQ screens stay informative and consistent. */

export const RFQ_HOW_IT_WORKS = [
  {
    step: '1',
    title: 'Raise',
    body: 'Choose client, country, vendor types, scope, and deadline. You stay on CC.',
  },
  {
    step: '2',
    title: 'Match & mail',
    body: 'We invite only Closed partners in that country. You edit the email, then send.',
  },
  {
    step: '3',
    title: 'Track',
    body: 'See who was emailed, who opened, and who quoted — person by person.',
  },
  {
    step: '4',
    title: 'Award',
    body: 'Unseal bids, compare landed cost vs MRP, award a winner, continue fulfillment.',
  },
] as const;

export const RFQ_STATUS_HELP: Record<string, string> = {
  draft: 'Campaign saved but not emailed yet. Review partners and click Send.',
  sent: 'Invite emails are out. Waiting for opens and quotes.',
  bidding: 'At least one quote received. Compare full bid details and award when ready.',
  awarded: 'Winner selected and notified. Use the checklist to finish handoff to PO.',
  expired: 'Deadline passed without an award. Extend, re-raise, or cancel.',
  cancelled: 'Campaign stopped. Vendors will see this RFQ as closed.',
};

export const RFQ_RECIPIENT_HELP: Record<string, string> = {
  pending_send: 'Selected for this campaign; email not sent yet.',
  sent: 'Invite delivered to their inbox (or accepted by Resend).',
  opened: 'They opened the magic link (or the email open was tracked).',
  quoted: 'They submitted a quote with a quotation file.',
  declined: 'They declined this RFQ.',
  bounced: 'Email bounced — check the address on the vendor lead.',
  no_response: 'Deadline passed with no quote or decline.',
};

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground leading-relaxed mt-1">{children}</p>;
}

export function InfoCallout({
  title,
  children,
  tone = 'neutral',
}: {
  title?: string;
  children: ReactNode;
  tone?: 'neutral' | 'amber' | 'blue' | 'emerald';
}) {
  const tones = {
    neutral: 'bg-muted/50 border-border text-foreground',
    amber: 'bg-amber-50 border-amber-200 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100',
    blue: 'bg-sky-50 border-sky-200 text-sky-950 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-100',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${tones[tone]}`}>
      {title && <p className="font-semibold mb-1">{title}</p>}
      <div className="text-[13px] opacity-90 space-y-1">{children}</div>
    </div>
  );
}

export function HowItWorksStrip() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {RFQ_HOW_IT_WORKS.map((item) => (
        <div key={item.step} className="rounded-xl border bg-card p-3.5">
          <p className="text-xs font-bold text-primary mb-1">Step {item.step} · {item.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
        </div>
      ))}
    </div>
  );
}
