/**
 * RFQ emails — RemoAsset brand (Outfit/Manrope, #30282B + #EA6E35)
 * Tone: human, short, conversational — not automated system copy.
 */

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

const BRAND = {
  dark: '#30282B',
  darkMid: '#3d3336',
  orange: '#EA6E35',
  orangeSoft: '#F09A72',
  orangePale: '#FBBC9A',
  pageBg: '#F0F0F5',
  card: '#ffffff',
  text: '#30282B',
  muted: '#6E7180',
  soft: '#9DA2B3',
  cream: '#FFF6F0',
  creamBorder: '#F5D0B8',
} as const;

const FONT =
  "'Manrope',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const FONT_DISPLAY =
  "'Outfit','Manrope',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

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

function firstName(vars: RfqEmailTemplateVars): string {
  const raw = (vars.contact_name || vars.vendor_name || 'there').trim();
  const first = raw.split(/\s+/)[0];
  return first || 'there';
}

/** Branded shell aligned with invite-user.html / Connect theme */
export function wrapRfqEmailHtml(opts: {
  eyebrow?: string;
  title: string;
  introHtml?: string;
  urgencyHtml?: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  secondaryLabel?: string;
  secondaryUrl?: string;
  signOffName: string;
}): string {
  const urgency = opts.urgencyHtml
    ? `<tr><td style="padding:0 36px 18px;">
        <div style="background:${BRAND.cream};border:1px solid ${BRAND.creamBorder};border-radius:12px;padding:14px 16px;color:${BRAND.dark};font-family:${FONT};font-size:14px;font-weight:600;line-height:1.45;text-align:left;">
          ${opts.urgencyHtml}
        </div>
      </td></tr>`
    : '';

  const secondary = opts.secondaryLabel && opts.secondaryUrl
    ? `<p style="margin:18px 0 0;text-align:center;font-family:${FONT};font-size:13px;">
         <a href="${opts.secondaryUrl}" style="color:${BRAND.muted};text-decoration:underline;">${esc(opts.secondaryLabel)}</a>
       </p>`
    : '';

  const intro = opts.introHtml
    ? `<p style="margin:0 0 20px;font-family:${FONT};font-size:15px;line-height:1.7;color:#BCBFCC;text-align:center;">${opts.introHtml}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en"><head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="margin:0;padding:0;background-color:${BRAND.pageBg};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BRAND.pageBg};padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">

        <!-- Logo -->
        <tr><td style="padding:0 0 24px;text-align:center;">
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
            <tr><td style="background-color:${BRAND.dark};border-radius:12px;padding:12px 22px;">
              <span style="font-family:${FONT_DISPLAY};font-size:20px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;">
                Remo<span style="color:${BRAND.orange};">Asset</span>
              </span>
            </td></tr>
          </table>
        </td></tr>

        <!-- Card -->
        <tr><td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.card};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(48,40,43,0.10),0 1px 4px rgba(48,40,43,0.06);">

            <tr><td style="height:5px;background:linear-gradient(90deg,${BRAND.orange} 0%,${BRAND.orangeSoft} 60%,${BRAND.orangePale} 100%);font-size:0;line-height:0;">&nbsp;</td></tr>

            <tr><td style="background:linear-gradient(145deg,${BRAND.dark} 0%,${BRAND.darkMid} 50%,#2a2227 100%);padding:36px 36px 28px;">
              ${opts.eyebrow ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${BRAND.orangeSoft};text-align:center;">${esc(opts.eyebrow)}</p>` : ''}
              <h1 style="margin:0 0 10px;font-family:${FONT_DISPLAY};font-size:24px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;text-align:center;line-height:1.25;">
                ${esc(opts.title)}
              </h1>
              ${intro}
            </td></tr>

            ${urgency}

            <tr><td style="padding:28px 36px 8px;font-family:${FONT};font-size:15px;line-height:1.7;color:${BRAND.text};">
              ${opts.bodyHtml}
            </td></tr>

            <tr><td style="padding:12px 36px 28px;" align="center">
              <a href="${opts.ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,${BRAND.orange} 0%,${BRAND.orangeSoft} 100%);color:#ffffff;text-decoration:none;font-family:${FONT};font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px;box-shadow:0 4px 14px rgba(234,110,53,0.35);">
                ${esc(opts.ctaLabel)}
              </a>
              <p style="margin:14px 0 0;font-family:${FONT};font-size:12px;color:${BRAND.soft};line-height:1.5;word-break:break-all;">
                Or paste this link if the button doesn’t work:<br/>
                <a href="${opts.ctaUrl}" style="color:${BRAND.orange};">${opts.ctaUrl}</a>
              </p>
              ${secondary}
            </td></tr>

            <tr><td style="padding:0 36px 32px;font-family:${FONT};font-size:14px;line-height:1.65;color:${BRAND.text};">
              <p style="margin:0 0 4px;">Warm regards,</p>
              <p style="margin:0;font-weight:700;">${esc(opts.signOffName)}</p>
              <p style="margin:2px 0 0;color:${BRAND.muted};font-size:13px;">RemoAsset · Procurement</p>
            </td></tr>

            <tr><td style="padding:16px 36px 24px;border-top:1px solid #EEE8EA;font-family:${FONT};font-size:12px;line-height:1.5;color:${BRAND.soft};text-align:center;">
              RemoAsset · Global IT asset lifecycle · Closed partner network
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function buildInviteSubject(vars: RfqEmailTemplateVars, kind: 'fulfillment' | 'retrieval'): string {
  if (kind === 'retrieval') {
    return `Quick ask — warehouse / ITAD quote for ${vars.country}?`;
  }
  return `Could you quote us on devices in ${vars.country}?`;
}

export function buildInviteEmail(vars: RfqEmailTemplateVars, kind: 'fulfillment' | 'retrieval') {
  const name = firstName(vars);
  const signOff = vars.owner_name || 'RemoAsset team';

  const title =
    kind === 'retrieval'
      ? 'Need a quick warehouse quote'
      : 'Hoping you can help with a quote';

  const intro =
    kind === 'retrieval'
      ? `A short paid job in <strong style="color:${BRAND.orangeSoft};">${esc(vars.country)}</strong> — figured you’d be a good fit.`
      : `We’ve got a live buy in <strong style="color:${BRAND.orangeSoft};">${esc(vars.country)}</strong> and wanted to come to you first.`;

  const opener =
    kind === 'retrieval'
      ? `Hope you’re doing well. We’re lining up retrieval / storage / redeploy support in ${esc(vars.country)} and would love a quote from you if you’re able.`
      : `Hope you’re doing well. We’re sourcing devices for a client in ${esc(vars.country)} and wanted to get your pricing before we close this out.`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${esc(name)},</p>
    <p style="margin:0 0 16px;">${opener}</p>
    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:${BRAND.muted};letter-spacing:0.02em;">Here’s what we need</p>
    <div style="background:${BRAND.pageBg};border-radius:12px;padding:16px 18px;margin:0 0 16px;border:1px solid #E8E4E6;">
      <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:${BRAND.text};">${esc(vars.scope_summary)}</div>
      <p style="margin:12px 0 0;font-size:14px;color:${BRAND.muted};"><strong style="color:${BRAND.text};">Qty:</strong> ${esc(String(vars.qty))}</p>
    </div>
    <p style="margin:0 0 16px;">
      If you can help, the link below takes about two minutes — quote price, public/MRP price, any shipping or tax, and your quotation PDF.
    </p>
    <p style="margin:0;">
      We’re aiming to decide soon, so ideally before <strong>${esc(vars.deadline)}</strong> (${esc(vars.deadline_countdown)} from now). Totally fine to decline if it’s not a fit.
    </p>
  `;

  const html = wrapRfqEmailHtml({
    eyebrow: 'Partner request',
    title,
    introHtml: intro,
    urgencyHtml: `Whenever you can — ideally by <strong>${esc(vars.deadline)}</strong> <span style="color:${BRAND.orange};">(${esc(vars.deadline_countdown)} left)</span>`,
    bodyHtml,
    ctaLabel: 'Send your quote',
    ctaUrl: vars.magic_link,
    secondaryLabel: 'Can’t take this one? Decline here',
    secondaryUrl: `${vars.magic_link}?decline=1`,
    signOffName: signOff,
  });

  const text = [
    `Hi ${name},`,
    '',
    kind === 'retrieval'
      ? `Hope you’re well. We’re lining up warehouse / ITAD support in ${vars.country} and would love a quote if you can help.`
      : `Hope you’re well. We’re sourcing devices in ${vars.country} and wanted your pricing before we decide.`,
    '',
    `What we need:`,
    vars.scope_summary,
    `Qty: ${vars.qty}`,
    '',
    `Quote here (≈2 min): ${vars.magic_link}`,
    `Ideal by ${vars.deadline} (${vars.deadline_countdown} left). Decline link if not a fit: ${vars.magic_link}?decline=1`,
    '',
    `Warm regards,`,
    signOff,
    `RemoAsset · Procurement`,
  ].join('\n');

  return {
    subject: buildInviteSubject(vars, kind),
    body_html: html,
    body_text: text,
  };
}

export function buildRemindEmail(vars: RfqEmailTemplateVars) {
  const name = firstName(vars);
  const signOff = vars.owner_name || 'RemoAsset team';
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hi ${esc(name)},</p>
    <p style="margin:0 0 16px;">
      Just a quick nudge — we still don’t have your quote for the ${esc(vars.country)} request.
      No stress if you’re slammed; even a rough number helps.
    </p>
    <p style="margin:0;">
      We’re wrapping this up in about <strong>${esc(vars.deadline_countdown)}</strong> (by ${esc(vars.deadline)}).
      The same link is below whenever you’re ready.
    </p>
  `;
  const html = wrapRfqEmailHtml({
    eyebrow: 'Friendly reminder',
    title: 'Still open if you can quote',
    urgencyHtml: `<strong>${esc(vars.deadline_countdown)}</strong> left · closes ${esc(vars.deadline)}`,
    bodyHtml,
    ctaLabel: 'Open quote form',
    ctaUrl: vars.magic_link,
    signOffName: signOff,
  });
  return {
    subject: `Still hoping for your quote on ${vars.country}`,
    body_html: html,
    body_text: `Hi ${name},\n\nQuick nudge on the ${vars.country} quote — ${vars.deadline_countdown} left. ${vars.magic_link}\n\nWarm regards,\n${signOff}`,
  };
}

export function buildAwardEmail(vars: RfqEmailTemplateVars, won: boolean) {
  const name = firstName(vars);
  const signOff = vars.owner_name || 'RemoAsset team';

  if (won) {
    const html = wrapRfqEmailHtml({
      eyebrow: 'Good news',
      title: 'You’re selected',
      bodyHtml: `<p style="margin:0 0 16px;">Hi ${esc(name)},</p>
        <p style="margin:0 0 16px;">Thanks again for quoting — we’d like to move forward with you on the ${esc(vars.country)} request. Pricing looks good on our side.</p>
        <p style="margin:0;">I’ll follow up on next steps / PO shortly. You can also confirm status on the link below anytime.</p>`,
      ctaLabel: 'View confirmation',
      ctaUrl: vars.magic_link,
      signOffName: signOff,
    });
    return {
      subject: `You’re on for ${vars.country} — thanks for quoting`,
      body_html: html,
      body_text: `Hi ${name},\n\nWe’re moving forward with you on ${vars.country}. ${vars.magic_link}\n\nWarm regards,\n${signOff}`,
    };
  }

  const html = wrapRfqEmailHtml({
    eyebrow: 'Update',
    title: 'Thank you — we went another way this time',
    bodyHtml: `<p style="margin:0 0 16px;">Hi ${esc(name)},</p>
      <p style="margin:0 0 16px;">Appreciate you taking the time to quote for ${esc(vars.country)}. We ended up selecting another partner for this one.</p>
      <p style="margin:0;">You’re still on our Closed partner list, and I’ll reach out again when something fits. Grateful either way.</p>`,
    ctaLabel: 'View status',
    ctaUrl: vars.magic_link,
    signOffName: signOff,
  });
  return {
    subject: `Thanks for quoting — update on ${vars.country}`,
    body_html: html,
    body_text: `Hi ${name},\n\nThanks for quoting on ${vars.country}. We went with another partner this round — you’re still on our Closed list.\n\nWarm regards,\n${signOff}`,
  };
}

export { applyVars, BRAND };
