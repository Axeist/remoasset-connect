/**
 * rfq-campaign
 * Authenticated: send | remind | award_emails | test_send
 * Public (token): get | open | submit | decline
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = Deno.env.get('RFQ_APP_URL') || 'https://connect.remoasset.in'

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function sendViaResend(opts: {
  to: string
  subject: string
  html: string
  text: string
  cc?: string[]
  fromName?: string
  fromAddress?: string
  replyTo?: string
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  const fromName = opts.fromName || 'RemoAsset Procurement'
  const fromAddress = opts.fromAddress || 'outreach@remoasset.in'
  const payload: Record<string, unknown> = {
    from: `${fromName} <${fromAddress}>`,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  }
  if (opts.replyTo) payload.reply_to = opts.replyTo
  if (opts.cc?.length) payload.cc = opts.cc

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Resend API error ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return { message_id: data.id as string }
}

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
}

function computePricing(quoted: number, mrp: number | null, shipping: number, tax: number, other: number) {
  const total = quoted + shipping + tax + other
  let discount_pct: number | null = null
  let discount_amount: number | null = null
  if (mrp != null && mrp > 0) {
    discount_amount = Math.round((mrp - quoted) * 100) / 100
    discount_pct = Math.round(((mrp - quoted) / mrp) * 10000) / 100
  }
  return { total_landed: Math.round(total * 100) / 100, discount_pct, discount_amount }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const action = body.action as string
    const sb = serviceClient()

    // ——— Public token actions ———
    if (['get', 'open', 'submit', 'decline'].includes(action)) {
      const token = body.token as string
      if (!token) return json({ error: 'token required' }, 400)

      const { data: recipient, error: rErr } = await sb
        .from('rfq_recipients')
        .select('*, vendor:leads!vendor_id(id, company_name, contact_name)')
        .eq('token', token)
        .maybeSingle()
      if (rErr || !recipient) return json({ error: 'Invalid or expired link' }, 404)

      const { data: rfq } = await sb
        .from('rfqs')
        .select('*, client:clients!client_id(id, name), country:countries!country_id(id, name)')
        .eq('id', recipient.rfq_id)
        .single()
      if (!rfq) return json({ error: 'RFQ not found' }, 404)

      const { data: bid } = await sb
        .from('rfq_bids')
        .select('*')
        .eq('recipient_id', recipient.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (action === 'open') {
        if (!recipient.opened_at && ['sent', 'pending_send'].includes(recipient.status)) {
          await sb.from('rfq_recipients').update({
            status: recipient.status === 'quoted' ? 'quoted' : 'opened',
            opened_at: new Date().toISOString(),
          }).eq('id', recipient.id)
        }
        return json({ ok: true })
      }

      if (action === 'get') {
        const sealed = !rfq.unsealed_at && new Date(rfq.sealed_until || rfq.deadline).getTime() > Date.now()
        const deadlinePassed = new Date(rfq.deadline).getTime() < Date.now()
        let view: string = 'bid_form'
        if (rfq.status === 'cancelled' || rfq.status === 'expired') view = 'closed'
        else if (bid?.award_status === 'won' || bid?.pricing_status === 'accepted') view = 'won'
        else if (bid?.award_status === 'lost') view = 'lost'
        else if (bid?.pricing_status === 'revision_requested') view = 'revise'
        else if (bid && rfq.status !== 'awarded') view = 'submitted'
        else if (deadlinePassed && rfq.status !== 'awarded') view = 'closed'
        else if (rfq.status === 'awarded' && bid?.award_status !== 'won') view = 'lost'

        return json({
          view,
          sealed,
          deadline: rfq.deadline,
          status: rfq.status,
          rfq: {
            id: rfq.id,
            rfq_type: rfq.rfq_type,
            scope_summary: rfq.scope_summary,
            quantity: rfq.quantity,
            deadline: rfq.deadline,
            client_name: rfq.client?.name,
            country_name: rfq.country?.name,
          },
          vendor_name: recipient.vendor?.company_name,
          recipient_status: recipient.status,
          bid: bid
            ? {
                quoted_price: bid.quoted_price,
                currency: bid.currency,
                mrp_price: bid.mrp_price,
                discount_pct: bid.discount_pct,
                total_landed: bid.total_landed,
                lead_time_days: bid.lead_time_days,
                quote_valid_until: bid.quote_valid_until,
                notes: bid.notes,
                quotation_file_name: bid.quotation_file_name,
                pricing_status: bid.pricing_status,
                award_status: bid.award_status,
                revision_note: bid.revision_note,
              }
            : null,
        })
      }

      if (action === 'decline') {
        await sb.from('rfq_recipients').update({
          status: 'declined',
          declined_at: new Date().toISOString(),
          decline_reason: body.reason || null,
        }).eq('id', recipient.id)
        return json({ ok: true })
      }

      if (action === 'submit') {
        if (rfq.status === 'awarded' || rfq.status === 'cancelled') {
          return json({ error: 'This RFQ is closed for new quotes' }, 400)
        }
        const quoted = Number(body.quoted_price)
        const mrp = body.mrp_price != null ? Number(body.mrp_price) : null
        const shipping = Number(body.shipping_fee || 0)
        const tax = Number(body.tax_fee || 0)
        const other = Number(body.other_fees || 0)
        if (!Number.isFinite(quoted) || quoted < 0) return json({ error: 'quoted_price required' }, 400)
        if (rfq.rfq_type === 'fulfillment' && (mrp == null || mrp <= 0)) {
          return json({ error: 'MRP / public price is required' }, 400)
        }
        if (!body.file_base64 || !body.file_name) {
          return json({ error: 'Quotation file is mandatory' }, 400)
        }

        const pricing = computePricing(quoted, mrp, shipping, tax, other)
        const ext = String(body.file_name).split('.').pop() || 'pdf'
        const path = `${rfq.id}/${recipient.id}-${Date.now()}.${ext}`
        const raw = body.file_base64.includes(',')
          ? body.file_base64.split(',')[1]
          : body.file_base64
        const bytes = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
        const { error: upErr } = await sb.storage.from('rfq-quotations').upload(path, bytes, {
          contentType: body.file_content_type || 'application/pdf',
          upsert: true,
        })
        if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 500)

        const bidRow = {
          rfq_id: rfq.id,
          recipient_id: recipient.id,
          vendor_id: recipient.vendor_id,
          quoted_price: quoted,
          currency: body.currency || 'USD',
          mrp_price: mrp,
          discount_pct: pricing.discount_pct,
          discount_amount: pricing.discount_amount,
          shipping_fee: shipping,
          tax_fee: tax,
          other_fees: other,
          total_landed: pricing.total_landed,
          line_items: body.line_items || [],
          quote_valid_until: body.quote_valid_until || null,
          lead_time_days: body.lead_time_days != null ? Number(body.lead_time_days) : null,
          notes: body.notes || null,
          quotation_file_path: path,
          quotation_file_name: body.file_name,
          pricing_status: 'submitted',
          award_status: 'pending',
          revision_note: null,
          submitted_at: new Date().toISOString(),
        }

        if (bid?.id && ['submitted', 'revision_requested'].includes(bid.pricing_status)) {
          await sb.from('rfq_bids').update(bidRow).eq('id', bid.id)
        } else {
          await sb.from('rfq_bids').insert(bidRow)
        }

        await sb.from('rfq_recipients').update({
          status: 'quoted',
          quoted_at: new Date().toISOString(),
          opened_at: recipient.opened_at || new Date().toISOString(),
        }).eq('id', recipient.id)

        if (rfq.client_request_id) {
          await sb.from('client_requests').update({ status: 'quotes_received' }).eq('id', rfq.client_request_id)
        }
        if (rfq.status === 'sent') {
          await sb.from('rfqs').update({ status: 'bidding' }).eq('id', rfq.id)
        }

        return json({ ok: true, total_landed: pricing.total_landed, discount_pct: pricing.discount_pct })
      }
    }

    // ——— Authenticated actions ———
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    // Validate JWT via Auth API (same pattern as invite-user). Avoid anon-client
    // getUser() without an explicit token — that often 401s in Edge Functions.
    const { data: { user }, error: userError } = await sb.auth.getUser(jwt)
    if (userError || !user) {
      return json({ error: 'Unauthorized', detail: userError?.message }, 401)
    }

    if (action === 'send' || action === 'test_send' || action === 'remind' || action === 'award_emails') {
      const rfqId = body.rfq_id as string
      const { data: rfq } = await sb.from('rfqs').select('*').eq('id', rfqId).single()
      if (!rfq) return json({ error: 'RFQ not found' }, 404)

      const ownerEmail = user.email || ''
      const cc = Array.from(new Set([
        ...(rfq.cc_emails || []),
        ownerEmail,
        ...(body.extra_cc || []),
      ].filter(Boolean).map((e: string) => e.trim().toLowerCase())))

      if (action === 'test_send') {
        const to = body.to || ownerEmail
        if (!to) return json({ error: 'No test recipient' }, 400)

        // Use a real recipient token so the magic link works end-to-end when testing
        const { data: sampleRecipient } = await sb
          .from('rfq_recipients')
          .select('id, token, email, vendor:leads!vendor_id(company_name)')
          .eq('rfq_id', rfqId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (!sampleRecipient?.token) {
          return json({
            error: 'No recipients on this RFQ yet — add partners before test send, or send the campaign first.',
          }, 400)
        }

        const magic = `${APP_URL}/rfq/respond/${sampleRecipient.token}`
        const subject = body.subject || rfq.email_subject || 'RFQ test'
        const htmlRaw = body.body_html || rfq.email_body_html || ''
        const html = htmlRaw
          .replaceAll('{{magic_link}}', magic)
          .replaceAll('{{vendor_name}}', (sampleRecipient as any).vendor?.company_name || 'Partner')
        const text = (body.body_text || `Submit your quote: ${magic}`)
          .replaceAll('{{magic_link}}', magic)

        const { message_id } = await sendViaResend({
          to,
          subject: `[TEST] ${subject}`,
          html,
          text,
          cc: cc.filter((e) => e !== to.toLowerCase()),
        })
        await sb.from('rfq_emails').insert({
          rfq_id: rfqId,
          recipient_id: sampleRecipient.id,
          kind: 'test_send',
          to_email: to,
          cc_emails: cc,
          subject: `[TEST] ${subject}`,
          body_html: html,
          body_text: text,
          resend_message_id: message_id,
          sent_by: user.id,
        })
        return json({
          ok: true,
          message_id,
          magic_link: magic,
          note: 'Test email uses the first partner’s real quote link so you can click through and submit a quote.',
        })
      }

      if (action === 'send') {
        const { data: recipients } = await sb
          .from('rfq_recipients')
          .select('*, vendor:leads!vendor_id(company_name, contact_name)')
          .eq('rfq_id', rfqId)
          .in('status', ['pending_send', 'sent'])

        if (!recipients?.length) return json({ error: 'No recipients' }, 400)

        const subjectTemplate = body.subject || rfq.email_subject
        const htmlTemplate = body.body_html || rfq.email_body_html
        if (!subjectTemplate || !htmlTemplate) return json({ error: 'Email subject/body required' }, 400)
        if (!htmlTemplate.includes('{{magic_link}}') && !htmlTemplate.includes('/rfq/respond/')) {
          // allow if already personalized per-send below
        }

        const results: { recipient_id: string; ok: boolean; error?: string }[] = []
        for (const r of recipients) {
          try {
            const magic = `${APP_URL}/rfq/respond/${r.token}`
            const html = htmlTemplate.replaceAll('{{magic_link}}', magic)
              .replaceAll('{{vendor_name}}', r.vendor?.company_name || 'Partner')
            const subject = subjectTemplate.replaceAll('{{vendor_name}}', r.vendor?.company_name || 'Partner')
            const { message_id } = await sendViaResend({
              to: r.email,
              subject,
              html,
              text: body.body_text || `Submit your quote: ${magic}`,
              cc: cc.filter((e) => e !== r.email.toLowerCase()),
            })
            await sb.from('rfq_recipients').update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              resend_message_id: message_id,
            }).eq('id', r.id)
            await sb.from('rfq_emails').insert({
              rfq_id: rfqId,
              recipient_id: r.id,
              kind: 'rfq_invite',
              to_email: r.email,
              cc_emails: cc,
              subject,
              body_html: html,
              body_text: body.body_text || null,
              resend_message_id: message_id,
              sent_by: user.id,
            })
            results.push({ recipient_id: r.id, ok: true })
          } catch (e) {
            results.push({ recipient_id: r.id, ok: false, error: e instanceof Error ? e.message : String(e) })
          }
        }

        await sb.from('rfqs').update({
          status: 'sent',
          email_subject: subjectTemplate,
          email_body_html: htmlTemplate,
          sealed_until: rfq.deadline,
        }).eq('id', rfqId)

        if (rfq.client_request_id) {
          await sb.from('client_requests').update({ status: 'rfq_in_progress' }).eq('id', rfq.client_request_id)
        }

        return json({ ok: true, results })
      }

      if (action === 'remind') {
        const { data: recipients } = await sb
          .from('rfq_recipients')
          .select('*, vendor:leads!vendor_id(company_name)')
          .eq('rfq_id', rfqId)
          .in('status', ['sent', 'opened'])

        const subjectTemplate = body.subject
        const htmlTemplate = body.body_html
        if (!subjectTemplate || !htmlTemplate) return json({ error: 'subject/body required' }, 400)

        let sent = 0
        for (const r of recipients || []) {
          const magic = `${APP_URL}/rfq/respond/${r.token}`
          const html = htmlTemplate.replaceAll('{{magic_link}}', magic)
          const { message_id } = await sendViaResend({
            to: r.email,
            subject: subjectTemplate,
            html,
            text: body.body_text || magic,
            cc: cc.filter((e) => e !== r.email.toLowerCase()),
          })
          await sb.from('rfq_recipients').update({ reminded_at: new Date().toISOString() }).eq('id', r.id)
          await sb.from('rfq_emails').insert({
            rfq_id: rfqId,
            recipient_id: r.id,
            kind: 'remind',
            to_email: r.email,
            cc_emails: cc,
            subject: subjectTemplate,
            body_html: html,
            body_text: body.body_text || null,
            resend_message_id: message_id,
            sent_by: user.id,
          })
          sent++
        }
        return json({ ok: true, sent })
      }

      if (action === 'award_emails') {
        const { data: recipients } = await sb
          .from('rfq_recipients')
          .select('*, vendor:leads!vendor_id(company_name, contact_name)')
          .eq('rfq_id', rfqId)
        const winnerId = body.winner_vendor_id as string
        const winTpl = body.winner
        const loseTpl = body.loser
        let sent = 0
        for (const r of recipients || []) {
          const won = r.vendor_id === winnerId
          // Only notify partners who were actually emailed (or the winner)
          if (!won && r.status === 'pending_send') continue
          const tpl = won ? winTpl : loseTpl
          if (!tpl?.subject || !tpl?.body_html) continue
          const magic = `${APP_URL}/rfq/respond/${r.token}`
          const company = (r as any).vendor?.company_name || 'Partner'
          const contact = (r as any).vendor?.contact_name || company
          const first = String(contact).trim().split(/\s+/)[0] || company
          const html = String(tpl.body_html)
            .replaceAll('{{magic_link}}', magic)
            .replaceAll('{{vendor_name}}', company)
            .replaceAll('{{contact_name}}', first)
          const text = String(tpl.body_text || magic)
            .replaceAll('{{magic_link}}', magic)
            .replaceAll('{{vendor_name}}', company)
            .replaceAll('{{contact_name}}', first)
          const { message_id } = await sendViaResend({
            to: r.email,
            subject: tpl.subject,
            html,
            text,
            cc: cc.filter((e) => e !== r.email.toLowerCase()),
          })
          await sb.from('rfq_emails').insert({
            rfq_id: rfqId,
            recipient_id: r.id,
            kind: won ? 'award' : 'not_selected',
            to_email: r.email,
            cc_emails: cc,
            subject: tpl.subject,
            body_html: html,
            body_text: text,
            resend_message_id: message_id,
            sent_by: user.id,
          })
          sent++
        }
        return json({ ok: true, sent })
      }
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    console.error(e)
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
