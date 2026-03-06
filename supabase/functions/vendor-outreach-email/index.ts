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
  warehouse:   'IT equipment warehousing and storage services. Mention interest in capacity, security standards, and fulfillment capabilities.',
}

// Context for email: what we do and what a discovery call covers (so the email can invite a call)
const REMOASSET_PITCH_CONTEXT = `
DISCOVERY CALL CONTEXT (use when inviting them to a call):
RemoAsset is US-based. We run a device lifecycle management platform for companies with globally distributed teams (remote-first, EORs). We help clients procure, deploy, manage, recover, and store IT devices across countries and are building a vendor network. On a discovery call we typically cover: US entity & procurement fit, payment terms (we often do pay-and-carry), tax/VAT for international buyers, shipping and delivery timelines, bulk orders and warehousing, device recovery/QC, and flexible billing/invoicing. Invite them to a short call to discuss how we could work together and to understand their services.
`.trim()

async function draftEmailWithClaude(vendor: any, tone: string, model: string, maxTokens: number, temperature: number) {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })

  const toneInstruction = TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS.professional
  const vendorFocus     = VENDOR_TYPE_FOCUS[vendor.vendor_type] ?? 'IT devices and services'

  const prompt = `Draft an outreach email from RemoAsset to a potential vendor partner.

ABOUT REMOASSET:
RemoAsset is an all-in-one remote IT asset lifecycle management platform. We help 200+ companies across 35+ countries manage their entire device lifecycle — from procurement to provisioning, tracking, and recovery for distributed workforces. We are SOC 2 certified and HIPAA compliant.

${REMOASSET_PITCH_CONTEXT}

VENDOR DETAILS:
- Company: ${vendor.company_name}
- Country: ${vendor.country}
- Contact Name: ${vendor.contact_name || 'Procurement Team'}
- Vendor Type: ${vendor.vendor_type}
- Description: ${vendor.description}
- Certifications: ${vendor.certifications?.length ? vendor.certifications.join(', ') : 'Unknown'}
- Specialties: ${vendor.specialties?.length ? vendor.specialties.join(', ') : 'IT devices'}
- Website: ${vendor.website ?? 'N/A'}

INQUIRY FOCUS: ${vendorFocus}
TONE: ${toneInstruction}

REQUIREMENTS:
- Subject line: Concise, professional, specific to their vendor type
- Greeting: Use contact name if available, otherwise "Hi [Company Name] Team"
- Opening: Brief intro to RemoAsset (1 sentence)
- Body: Explain why we're reaching out to THEM specifically. Reference their specialties/certs if known.
- Key questions to ask (pick 2-3):
  * Inventory/capacity availability
  * Certifications and quality standards
  * Minimum order quantities or pricing structure
  * Geographic coverage / lead times
- Closing: Invite them to a brief call or email reply (you can mention we often do a short discovery call to discuss fit, their services, and next steps — see context above).
- Sign-off: "The RemoAsset Procurement Team"

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
