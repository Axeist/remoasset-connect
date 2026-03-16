/**
 * vendor-outreach-email
 *
 * 1. Uses Claude (Haiku) to draft a personalized outreach email.
 * 2. Sends via Resend with CC to ranjith@remoasset.com (configurable).
 * 3. Returns token usage for cost tracking.
 *
 * Input:
 *   vendor: VendorResult
 *   settings: {
 *     from_name, from_address, reply_to, cc,
 *     subject_template, tone,
 *     ai_model, ai_max_tokens, ai_temperature
 *   }
 *
 * Output:
 *   { success, message_id, subject, body_html, body_preview, token_usage, error? }
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cost per million tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001':  { input: 0.80,  output: 4.00  },
  'claude-3-5-sonnet-20241022': { input: 3.00,  output: 15.00 },
  'claude-3-opus-20240229':     { input: 15.00, output: 75.00 },
}

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-haiku-4-5-20251001']
  return {
    input_cost_usd:  (inputTokens  / 1_000_000) * pricing.input,
    output_cost_usd: (outputTokens / 1_000_000) * pricing.output,
    total_cost_usd:  (inputTokens  / 1_000_000) * pricing.input +
                     (outputTokens / 1_000_000) * pricing.output,
  }
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional: 'Write in a professional, formal business tone. Be clear, concise, and respectful.',
  friendly:     'Write in a warm, friendly tone while remaining professional. Be personable and approachable.',
  concise:      'Write in an extremely concise style. Get to the point quickly. No more than 4 sentences in the body.',
  formal:       'Write in a formal, corporate tone. Use formal greetings and sign-offs. Be thorough and precise.',
}

const VENDOR_TYPE_FOCUS: Record<string, string> = {
  refurbished: 'certified refurbished IT devices (laptops, MacBooks, tablets, workstations). Mention interest in R2/ISO certification, grading standards (Grade A/B), and bulk pricing.',
  new_device:  'new IT hardware for enterprise procurement. Mention interest in authorized distributor status, bulk pricing tiers, and warranty terms.',
  rental:      'IT device rental and leasing for corporate clients. Mention interest in fleet management, rental duration options, and pricing per device per month.',
  warehouse:   'IT asset warehousing, QC, shipping operations, and device lifecycle services. RemoAsset is looking for warehouse partners who can: (1) receive and securely store IT assets (primarily laptops) on behalf of our clients, (2) perform quality checks (QC) and servicing/repair if needed, (3) handle inbound/outbound shipping and logistics operations, (4) support device retirement and redeployment — retire end-of-life laptops, clean/refurbish them, and make them ready for redeployment to new employees. RemoAsset handles procurement and delivery of new laptops with device vendors; the warehouse partner's role is to retire, store, QC, and redeploy. The goal of outreach is to get them on a discovery call to discuss storage pricing, QC fees, quantity requirements, tax implications, and logistics capabilities.',
}

// Context for email: what we do and what a discovery call covers (so the email can invite a call)
const REMOASSET_PITCH_CONTEXT = `
ABOUT REMOASSET:
RemoAsset is an all-in-one remote IT asset lifecycle management platform. We help 200+ companies across 35+ countries manage their entire device lifecycle — from procurement, provisioning, and tracking to recovery, QC, and storage — for distributed and remote workforces.

WAREHOUSE PARTNER DISCOVERY CALL CONTEXT (use for warehouse vendor emails):
We are actively building a global network of warehouse partners to support our clients' IT asset lifecycle needs. Here is what we are looking for from a warehouse partner:
- Secure storage of IT assets (primarily laptops) on behalf of our clients in their country/region
- Inbound/outbound shipping operations and coordination
- Quality checks (QC) and basic servicing/repair of laptops when needed (optional but preferred)
- Device retirement and redeployment support — when a laptop is retired from one employee, the warehouse partner would receive it, QC it, and make it ready for deployment to the next employee
- RemoAsset takes care of procurement and delivery of new laptops with our device vendor partners

On a discovery call we cover:
- Storage capacity and pricing (per unit or per pallet/sq ft)
- QC and servicing capabilities and cost
- Shipping operations and carrier partnerships
- Volume expectations and quantity requirements
- Tax implications and customs for cross-border shipments
- Billing/invoicing and payment terms
- Timeline and onboarding process

GENERAL DISCOVERY CALL CONTEXT (for non-warehouse vendors):
We run a device lifecycle management platform for companies with globally distributed teams. On a discovery call we cover: US entity & procurement fit, payment terms, tax/VAT for international buyers, shipping and delivery timelines, bulk orders and warehousing, device recovery/QC, and flexible billing/invoicing.

CALENDLY BOOKING LINK: https://calendly.com/ranjith-remoasset/30min
Always include this link when inviting them to book a call. Phrase it naturally, e.g. "book a 30-min call via: https://calendly.com/ranjith-remoasset/30min"
`.trim()

async function draftEmailWithClaude(vendor: any, tone: string, model: string, maxTokens: number, temperature: number) {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })

  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.professional
  const vendorFocus     = VENDOR_TYPE_FOCUS[vendor.vendor_type] ?? 'IT devices and services'
  const isWarehouse     = vendor.vendor_type === 'warehouse'

  const prompt = `Draft an outreach email from RemoAsset to a potential ${isWarehouse ? 'warehouse' : 'vendor'} partner.

${REMOASSET_PITCH_CONTEXT}

VENDOR DETAILS:
- Company: ${vendor.company_name}
- Country: ${vendor.country}
- Contact Name: ${vendor.contact_name || (isWarehouse ? 'Warehouse Operations Team' : 'Procurement Team')}
- Vendor Type: ${vendor.vendor_type}
- Description: ${vendor.description}
- Certifications: ${vendor.certifications?.length ? vendor.certifications.join(', ') : 'Unknown'}
- Specialties: ${vendor.specialties?.length ? vendor.specialties.join(', ') : 'IT assets'}
- Website: ${vendor.website ?? 'N/A'}
- Region: ${vendor.region ?? vendor.country}

INQUIRY FOCUS: ${vendorFocus}
TONE: ${toneInstruction}

REQUIREMENTS:
- Subject line: Short, specific — reference the company name or country. ${isWarehouse
  ? 'Examples: "Warehouse Partnership — RemoAsset × [Company]", "IT Asset Storage Partnership in [Country]", "Laptop Lifecycle Warehousing — Let\'s Connect"'
  : 'Examples: "IT Device Partnership — RemoAsset", "Sourcing Partnership — [Country]"'}
- Greeting: Use contact name if available, otherwise "Hi [Company Name] Team"
- Length: SHORT. Maximum 4 short paragraphs. No bullet lists in the email body. Conversational, not corporate.
- Paragraph 1 (2 sentences max): Who RemoAsset is — one line. Why we're reaching out to THIS company specifically.
- Paragraph 2 (3 sentences max): ${isWarehouse
  ? 'What we need from a warehouse partner — briefly: store IT assets (laptops), handle QC and servicing, manage shipping, and support device retirement/redeployment. Mention RemoAsset handles procurement; the partner handles storage, QC, and redeployment.'
  : 'What we are looking for from them — relevant to their type. Keep it to 2–3 sentences.'}
- Paragraph 3 (1–2 sentences): ${isWarehouse
  ? 'Invite them to a 30-min call to discuss storage pricing, QC services, volume, and tax/logistics details. Include the Calendly link naturally: https://calendly.com/ranjith-remoasset/30min'
  : 'Invite them to a quick call. Include the Calendly link: https://calendly.com/ranjith-remoasset/30min'}
- Sign-off: End with exactly this block:
  "Warm regards,

  Ranjithkumar Shanmugavel
  Head of Operations, Remoasset Corp.
  ranjith@remoasset.com
  +91 8667637565"

Return ONLY valid JSON:
{
  "subject": "email subject line",
  "body_text": "plain text version (no HTML)",
  "body_html": "HTML version using <p>, <br>, <strong> only"
}`

  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('Unexpected Claude response type')

  const jsonMatch = content.text.trim().match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude did not return valid JSON')

  const parsed = JSON.parse(jsonMatch[0])
  if (!parsed.subject || !parsed.body_text || !parsed.body_html) {
    throw new Error('Claude response missing required fields')
  }

  const cost = calculateCost(model, message.usage.input_tokens, message.usage.output_tokens)

  return {
    subject:   parsed.subject,
    body_html: parsed.body_html,
    body_text: parsed.body_text,
    token_usage: {
      model,
      input_tokens:    message.usage.input_tokens,
      output_tokens:   message.usage.output_tokens,
      ...cost,
    },
  }
}

async function sendViaResend(
  to: string,
  subject: string,
  bodyHtml: string,
  bodyText: string,
  fromName: string,
  fromAddress: string,
  replyTo?: string,
  cc?: string[],
): Promise<{ message_id: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')

  const payload: Record<string, any> = {
    from:    `${fromName} <${fromAddress}>`,
    to:      [to],
    subject,
    html:    bodyHtml,
    text:    bodyText,
  }
  if (replyTo)             payload.reply_to = replyTo
  if (cc && cc.length > 0) payload.cc       = cc

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`Resend API error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return { message_id: data.id }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { vendor, settings, draft_only, prepared_draft } = await req.json()

    if (!vendor?.company_name) {
      return new Response(
        JSON.stringify({ error: 'vendor object is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const {
      from_name  = 'RemoAsset Procurement',
      from_address = 'outreach@remoasset.in',
      reply_to,
      cc = 'ranjith@remoasset.com',
      tone = 'professional',
      ai_model = 'claude-haiku-4-5-20251001',
      ai_max_tokens = 2048,
      ai_temperature = 0.7,
    } = settings ?? {}

    const ccList: string[] = typeof cc === 'string'
      ? cc.split(',').map((e: string) => e.trim()).filter(Boolean)
      : Array.isArray(cc) ? cc : []

    // Send a pre-approved draft (no Claude) — used when user approves in chat
    if (prepared_draft?.subject && prepared_draft?.body_html && prepared_draft?.body_text) {
      if (!vendor.contact_email) {
        return new Response(
          JSON.stringify({ success: false, error: 'No contact email' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      const { message_id } = await sendViaResend(
        vendor.contact_email,
        prepared_draft.subject,
        prepared_draft.body_html,
        prepared_draft.body_text,
        from_name,
        from_address,
        reply_to,
        ccList,
      )
      return new Response(
        JSON.stringify({
          success: true,
          message_id,
          subject: prepared_draft.subject,
          body_preview: prepared_draft.body_text.slice(0, 200) + (prepared_draft.body_text.length > 200 ? '...' : ''),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (!vendor.contact_email) {
      return new Response(
        JSON.stringify({ success: false, skipped: true, reason: 'No contact email available' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Draft with Claude
    const { subject, body_html, body_text, token_usage } = await draftEmailWithClaude(
      vendor, tone, ai_model, ai_max_tokens, ai_temperature,
    )

    // Draft only — return without sending (for approval flow in chat)
    if (draft_only) {
      return new Response(
        JSON.stringify({
          draft_only: true,
          subject,
          body_html,
          body_text,
          body_preview: body_text.slice(0, 200) + (body_text.length > 200 ? '...' : ''),
          token_usage,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Send via Resend
    const { message_id } = await sendViaResend(
      vendor.contact_email, subject, body_html, body_text,
      from_name, from_address, reply_to, ccList,
    )

    return new Response(
      JSON.stringify({
        success: true,
        message_id,
        subject,
        body_html,
        body_preview: body_text.slice(0, 200) + (body_text.length > 200 ? '...' : ''),
        token_usage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('vendor-outreach-email error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
