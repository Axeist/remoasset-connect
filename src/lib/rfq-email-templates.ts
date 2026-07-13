export type RfqEmailTemplateVars = {
  vendor_name: string;
  contact_name?: string;
  country: string;
  deadline: string;
  deadline_countdown: string;
  magic_link: string;
  scope_summary: string;
  qty: string | number;
  owner_name: string;
  rfq_type_label: string;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function applyVars(template: string, vars: RfqEmailTemplateVars): string {
  return template
    .replaceAll('{{vendor_name}}', esc(vars.vendor_name))
    .replaceAll('{{contact_name}}', esc(vars.contact_name || vars.vendor_name))
    .replaceAll('{{country}}', esc(vars.country))
    .replaceAll('{{deadline}}', esc(vars.deadline))
    .replaceAll('{{deadline_countdown}}', esc(vars.deadline_countdown))
    .replaceAll('{{magic_link}}', vars.magic_link)
    .replaceAll('{{scope_summary}}', esc(vars.scope_summary))
    .replaceAll('{{qty}}', esc(String(vars.qty)))
    .replaceAll('{{owner_name}}', esc(vars.owner_name))
    .replaceAll('{{rfq_type_label}}', esc(vars.rfq_type_label));
}

/** Branded HTML shell — email-client safe single column */
export function wrapRfqEmailHtml(opts: {
  title: string;
  urgencyHtml?: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
  footerNote: string;
}): string {
  const urgency = opts.urgencyHtml
    ? `<tr><td style="padding:0 28px 16px;">
        <div style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:10px;padding:12px 16px;color:#92400E;font-size:14px;font-weight:600;text-align:center;">
          ${opts.urgencyHtml}
        </div>
      </td></tr>`
    : '';

  const secondary = opts.secondaryLabel && opts.secondaryUrl
    ? `<p style="margin:16px 0 0;text-align:center;font-size:13px;">
         <a href="${opts.secondaryUrl}" style="color:#6B7280;text-decoration:underline;">${esc(opts.secondaryLabel)}</a>
       </p>`
    : '';

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F3F4F6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
        <tr><td style="background:linear-gradient(135deg,#111827,#1F2937);padding:22px 28px;">
          <div style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:-0.02em;">RemoAsset</div>
          <div style="color:#9CA3AF;font-size:12px;margin-top:4px;">Partner RFQ · Closed network</div>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <h1 style="margin:0;font-size:22px;line-height:1.3;color:#111827;font-weight:700;">${esc(opts.title)}</h1>
        </td></tr>
        ${urgency}
        <tr><td style="padding:8px 28px 8px;color:#374151;font-size:15px;line-height:1.55;">
          ${opts.bodyHtml}
        </td></tr>
        <tr><td style="padding:8px 28px 24px;" align="center">
          <a href="${opts.ctaUrl}" style="display:inline-block;background:#2563EB;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;">
            ${esc(opts.ctaLabel)}
          </a>
          <p style="margin:12px 0 0;font-size:12px;color:#9CA3AF;word-break:break-all;">
            Or open: <a href="${opts.ctaUrl}" style="color:#6B7280;">${opts.ctaUrl}</a>
          </p>
          ${secondary}
        </td></tr>
        <tr><td style="padding:16px 28px 24px;border-top:1px solid #E5E7EB;color:#6B7280;font-size:12px;line-height:1.5;">
          ${opts.footerNote}
          <div style="margin-top:10px;color:#9CA3AF;">RemoAsset · Global IT asset lifecycle · Closed partner network</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function buildInviteSubject(vars: RfqEmailTemplateVars, kind: 'fulfillment' | 'retrieval'): string {
  if (kind === 'retrieval') {
    return `Paid warehouse + ITAD RFQ — ${vars.country} · reply in ${vars.deadline_countdown}`;
  }
  return `Action required: RemoAsset RFQ — ${vars.qty}× devices · ${vars.country} · quote due ${vars.deadline}`;
}

export function buildInviteEmail(vars: RfqEmailTemplateVars, kind: 'fulfillment' | 'retrieval') {
  const title =
    kind === 'retrieval'
      ? 'Paid warehouse + ITAD opportunity'
      : 'You’re invited to submit a competitive quote';

  const opportunity =
    kind === 'retrieval'
      ? `This is a <strong>paid</strong> retrieval / storage / redeploy opportunity in <strong>${esc(vars.country)}</strong>. Closed RemoAsset partners are invited to quote.`
      : `You’ve been shortlisted as a <strong>Closed RemoAsset partner</strong> in <strong>${esc(vars.country)}</strong> for a live paid device RFQ.`;

  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${esc(vars.contact_name || vars.vendor_name)},</p>
    <p style="margin:0 0 14px;">${opportunity}</p>
    <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:10px;padding:14px 16px;margin:0 0 14px;">
      <div style="font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;">Scope</div>
      <div style="white-space:pre-wrap;">${esc(vars.scope_summary)}</div>
      <div style="margin-top:8px;color:#4B5563;"><strong>Qty:</strong> ${esc(String(vars.qty))}</div>
    </div>
    <p style="margin:0 0 14px;">We need your <strong>quoted price</strong>, <strong>MRP / public price</strong>, landed costs, lead time, and a <strong>quotation PDF</strong>. Takes a few minutes.</p>
    <p style="margin:0;">Quotes after the deadline may not be considered. Other Closed partners are being invited — submit to compete.</p>
  `;

  const html = wrapRfqEmailHtml({
    title,
    urgencyHtml: `Deadline: ${esc(vars.deadline)} · <strong>${esc(vars.deadline_countdown)} remaining</strong>`,
    bodyHtml,
    ctaLabel: 'Submit your competitive quote',
    ctaUrl: vars.magic_link,
    secondaryLabel: 'Decline this RFQ',
    secondaryUrl: `${vars.magic_link}?decline=1`,
    footerNote: `${esc(vars.owner_name)} and RemoAsset Procurement are CC’d. Prefer using the secure link above.`,
  });

  const text = [
    `Hi ${vars.contact_name || vars.vendor_name},`,
    '',
    kind === 'retrieval'
      ? `Paid warehouse + ITAD RFQ in ${vars.country}.`
      : `Closed partner RFQ in ${vars.country}.`,
    `Scope: ${vars.scope_summary}`,
    `Qty: ${vars.qty}`,
    `Deadline: ${vars.deadline} (${vars.deadline_countdown} left)`,
    '',
    `Submit quote: ${vars.magic_link}`,
    `Decline: ${vars.magic_link}?decline=1`,
  ].join('\n');

  return {
    subject: buildInviteSubject(vars, kind),
    body_html: html,
    body_text: text,
  };
}

export function buildRemindEmail(vars: RfqEmailTemplateVars) {
  const bodyHtml = `
    <p style="margin:0 0 14px;">Hi ${esc(vars.contact_name || vars.vendor_name)},</p>
    <p style="margin:0 0 14px;"><strong>${esc(vars.deadline_countdown)} left</strong> — we have not received your quote yet for the RemoAsset RFQ in ${esc(vars.country)}.</p>
    <p style="margin:0;">Other Closed partners are already quoting. Submit now to stay in the running.</p>
  `;
  const html = wrapRfqEmailHtml({
    title: 'Last call — quote still needed',
    urgencyHtml: `Closes ${esc(vars.deadline)} · <strong>${esc(vars.deadline_countdown)} remaining</strong>`,
    bodyHtml,
    ctaLabel: 'Submit quote before deadline',
    ctaUrl: vars.magic_link,
    footerNote: `${esc(vars.owner_name)} is CC’d on this RFQ.`,
  });
  return {
    subject: `${vars.deadline_countdown} left — RemoAsset still needs your quote (${vars.country})`,
    body_html: html,
    body_text: `Hi ${vars.contact_name || vars.vendor_name},\n\n${vars.deadline_countdown} left. Submit: ${vars.magic_link}`,
  };
}

export function buildAwardEmail(vars: RfqEmailTemplateVars, won: boolean) {
  if (won) {
    const html = wrapRfqEmailHtml({
      title: 'You’re selected — pricing accepted',
      bodyHtml: `<p style="margin:0 0 14px;">Hi ${esc(vars.contact_name || vars.vendor_name)},</p>
        <p style="margin:0;">Congratulations — you won the RemoAsset RFQ in ${esc(vars.country)}. Pricing has been accepted. Open your link for next steps.</p>`,
      ctaLabel: 'View award status',
      ctaUrl: vars.magic_link,
      footerNote: `${esc(vars.owner_name)} is CC’d.`,
    });
    return {
      subject: `You’re selected — RemoAsset RFQ ${vars.country} (pricing accepted)`,
      body_html: html,
      body_text: `You won the RFQ in ${vars.country}. Status: ${vars.magic_link}`,
    };
  }
  const html = wrapRfqEmailHtml({
    title: 'RFQ closed — not selected this round',
    bodyHtml: `<p style="margin:0 0 14px;">Hi ${esc(vars.contact_name || vars.vendor_name)},</p>
      <p style="margin:0;">Thank you for quoting. You were not selected for this RemoAsset RFQ in ${esc(vars.country)}. You remain on our Closed partner network for future opportunities.</p>`,
    ctaLabel: 'View status',
    ctaUrl: vars.magic_link,
    footerNote: `${esc(vars.owner_name)} is CC’d.`,
  });
  return {
    subject: `Update: RFQ closed — not selected this round (stay on Closed network)`,
    body_html: html,
    body_text: `Not selected for RFQ in ${vars.country}. Status: ${vars.magic_link}`,
  };
}

export { applyVars };
