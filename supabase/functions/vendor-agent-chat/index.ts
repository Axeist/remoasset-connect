/**
 * vendor-agent-chat
 *
 * Handles chat messages from the VendorAgent UI.
 * Uses Claude to understand the user's intent, then orchestrates
 * vendor discovery, lead creation, and email sending accordingly.
 *
 * Returns a streaming SSE response so the UI can show progress in real time.
 *
 * Input:
 *   message: string
 *   conversation: Array<{ role: 'user'|'assistant', content: string }>
 *
 * Output: Server-Sent Events stream
 *   data: { type: 'text', content: string }
 *   data: { type: 'progress', step: string, icon: string }
 *   data: { type: 'result', leads_created, emails_sent, skipped, region?, vendor_types? }
 *   data: { type: 'error', message: string }
 *   data: { type: 'done' }
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function initSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )
}

async function callFunction(fnName: string, body: any): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${fnName} failed (${res.status}): ${text}`)
  }

  return res.json()
}

function sseEvent(data: any): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

async function parseIntent(
  message: string,
  conversation: any[],
  model: string,
  anthropic: Anthropic,
): Promise<{
  action: 'discover' | 'status' | 'question' | 'unknown'
  region?: string
  vendor_types?: string[]
  count?: number
  context?: string
}> {
  const historyText = conversation
    .slice(-4) // last 4 messages for context
    .map((m: any) => `${m.role}: ${m.content}`)
    .join('\n')

  const prompt = `You are parsing a user's message to the RemoAsset Vendor Discovery Agent.

Recent conversation:
${historyText || '(none)'}

User's new message: "${message}"

Determine the user's intent and extract parameters. Return ONLY valid JSON:

If they want to DISCOVER vendors:
{
  "action": "discover",
  "region": "APAC" | "US" | "EU" | "LATAM" | "MEA" | or a specific country name,
  "vendor_types": array of one or more: ["refurbished", "new_device", "rental", "warehouse"],
  "count": number (default 10, max 30),
  "context": "any extra instructions or specifics mentioned"
}

If they're asking about STATUS (last run, how many leads, etc.):
{ "action": "status" }

If they're asking a QUESTION about vendors or the system:
{ "action": "question", "context": "the question" }

Otherwise:
{ "action": "unknown" }

Rules for region detection:
- "Southeast Asia", "Asia Pacific", "APAC", "Asia" → "APAC"
- "United States", "America", "North America", "US" → "US"
- "Europe", "EU", "Western Europe" → "EU"
- "Latin America", "LATAM", "South America" → "LATAM"
- "Middle East", "Africa", "MEA" → "MEA"
- Specific country → use the country name as-is

Rules for vendor_type detection:
- "refurbished", "used", "second-hand", "certified pre-owned" → "refurbished"
- "new", "new device", "brand new", "fresh" → "new_device"
- "rental", "lease", "hire", "rent" → "rental"
- "warehouse", "storage", "logistics", "fulfillment" → "warehouse"
- If no type mentioned, default to ["refurbished", "new_device"]`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 512,
    temperature: 0,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] as any).text?.trim() || ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { action: 'unknown' }

  try {
    return JSON.parse(jsonMatch[0])
  } catch {
    return { action: 'unknown' }
  }
}

async function answerQuestion(
  question: string,
  model: string,
  anthropic: Anthropic,
  stats: any,
): Promise<string> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 1024,
    temperature: 0.5,
    messages: [{
      role: 'user',
      content: `You are the RemoAsset Vendor Discovery Agent assistant. Answer this question helpfully and concisely.

System stats:
- Last cron run: ${stats.last_run || 'Never'}
- Leads created (last run): ${stats.last_run_count ?? 'N/A'}
- Total vendors discovered (all time): ${stats.total_discovered ?? 'N/A'}

Question: ${question}`,
    }],
  })
  return (response.content[0] as any).text || 'I could not generate a response.'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { message, conversation = [] } = await req.json()

  if (!message) {
    return new Response(
      JSON.stringify({ error: 'message is required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  const supabase = initSupabase()

  // Load settings
  const { data: settings } = await supabase
    .from('app_settings')
    .select(`
      ai_enabled, ai_model, ai_max_tokens, ai_temperature,
      vendor_cron_regions, vendor_cron_types,
      vendor_email_enabled, vendor_email_from_name, vendor_email_from_address,
      vendor_email_reply_to, vendor_email_tone, vendor_email_cc,
      agni_agent_user_id, vendor_default_status_id,
      vendor_dedup_enabled, vendor_dedup_window_days,
      slack_notify_vendor_discovered, slack_notify_vendor_email_sent,
      vendor_cron_last_run, vendor_cron_last_run_count
    `)
    .limit(1)
    .single()

  const model = settings?.ai_model || 'claude-haiku-4-5-20251001'
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })

  console.log('[vendor-agent-chat] settings loaded:', JSON.stringify({
    ai_enabled: settings?.ai_enabled,
    vendor_email_enabled: settings?.vendor_email_enabled,
    vendor_email_from_address: settings?.vendor_email_from_address,
    agni_agent_user_id: settings?.agni_agent_user_id ? 'set' : 'missing',
  }))

  // Set up SSE stream
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  const send = async (data: any) => {
    await writer.write(encoder.encode(sseEvent(data)))
  }

  // Process asynchronously
  ;(async () => {
    try {
      if (!settings?.ai_enabled) {
        await send({ type: 'error', message: 'AI is disabled in settings. Enable it in Agent Settings.' })
        await send({ type: 'done' })
        return
      }

      // Parse intent
      await send({ type: 'progress', step: 'Understanding your request...', icon: '🧠' })
      const intent = await parseIntent(message, conversation, model, anthropic)

      if (intent.action === 'status') {
        const { data: jobHistory } = await supabase
          .from('vendor_discovery_jobs')
          .select('status, total_created, total_skipped, total_emailed, completed_at, triggered_by')
          .order('created_at', { ascending: false })
          .limit(5)

        const { data: logCount } = await supabase
          .from('vendor_discovery_log')
          .select('id', { count: 'exact', head: true })

        const lastJob = jobHistory?.[0]
        const statusText = [
          `**Vendor Agent Status**`,
          ``,
          `**Last run:** ${settings?.vendor_cron_last_run ? new Date(settings.vendor_cron_last_run).toLocaleString() : 'Never'}`,
          `**Leads created (last run):** ${settings?.vendor_cron_last_run_count ?? 0}`,
          `**Total vendors discovered:** ${(logCount as any)?.count ?? 0}`,
          lastJob ? `**Last job:** ${lastJob.total_created} created, ${lastJob.total_skipped} skipped, ${lastJob.total_emailed} emailed (${lastJob.status})` : '',
        ].filter(Boolean).join('\n')

        await send({ type: 'text', content: statusText })
        await send({ type: 'done' })
        return
      }

      if (intent.action === 'question') {
        const { data: logCount } = await supabase
          .from('vendor_discovery_log')
          .select('id', { count: 'exact', head: true })

        const answer = await answerQuestion(
          intent.context || message,
          model,
          anthropic,
          {
            last_run: settings?.vendor_cron_last_run,
            last_run_count: settings?.vendor_cron_last_run_count,
            total_discovered: (logCount as any)?.count,
          },
        )
        await send({ type: 'text', content: answer })
        await send({ type: 'done' })
        return
      }

      if (intent.action !== 'discover') {
        await send({
          type: 'text',
          content: `I can help you find vendors! Try saying something like:\n\n• *"Find 10 refurbished laptop vendors in Southeast Asia"*\n• *"Search for 5 warehouse partners in Germany"*\n• *"Find rental IT equipment companies in the US"*`,
        })
        await send({ type: 'done' })
        return
      }

      // Discovery flow
      const region = intent.region || 'APAC'
      const vendorTypes = intent.vendor_types || ['refurbished', 'new_device']
      const count = Math.min(intent.count || 10, 30)

      await send({
        type: 'text',
        content: `Searching for **${count} ${vendorTypes.join(' & ')} vendors** in **${region}**...`,
      })
      await send({ type: 'progress', step: `Searching Google for vendors in ${region}...`, icon: '🔍' })

      // Discover vendors
      let discoveryResult: any
      try {
        discoveryResult = await callFunction('vendor-discovery', {
          region,
          vendor_types: vendorTypes,
          count,
          context: intent.context,
          ai_model: model,
          ai_max_tokens: settings?.ai_max_tokens || 4096,
          ai_temperature: settings?.ai_temperature || 0.7,
        })
      } catch (err) {
        await send({ type: 'error', message: `Discovery failed: ${String(err)}` })
        await send({ type: 'done' })
        return
      }

      const vendors: any[] = discoveryResult.vendors || []

      if (vendors.length === 0) {
        await send({
          type: 'text',
          content: `No vendors found for ${region}. Try a different region or vendor type.`,
        })
        await send({ type: 'done' })
        return
      }

      await send({
        type: 'progress',
        step: `Found ${vendors.length} vendors. Creating leads and sending outreach...`,
        icon: '✅',
      })

      const emailSettings = {
        from_name: settings?.vendor_email_from_name || 'RemoAsset Procurement',
        from_address: settings?.vendor_email_from_address || 'outreach@remoasset.in',
        reply_to: settings?.vendor_email_reply_to,
        cc: settings?.vendor_email_cc || 'ranjith@remoasset.com',
        tone: settings?.vendor_email_tone || 'professional',
        ai_model: model,
        ai_max_tokens: Math.min(settings?.ai_max_tokens || 2048, 2048),
        ai_temperature: settings?.ai_temperature || 0.7,
      }

      const leadSettings = {
        agni_agent_user_id: settings?.agni_agent_user_id,
        default_status_id: settings?.vendor_default_status_id,
        dedup_enabled: settings?.vendor_dedup_enabled ?? true,
        dedup_window_days: settings?.vendor_dedup_window_days ?? 90,
        slack_notify_vendor_discovered: settings?.slack_notify_vendor_discovered ?? true,
        slack_notify_vendor_email_sent: settings?.slack_notify_vendor_email_sent ?? true,
      }

      let leadsCreated = 0
      let emailsSent = 0
      let skipped = 0

      // Process vendors in small parallel batches (3 at a time) to stay within
      // the 60s Edge Function wall-clock limit while respecting Resend rate limits.
      const BATCH_SIZE = 3

      for (let batchStart = 0; batchStart < vendors.length; batchStart += BATCH_SIZE) {
        const batch = vendors.slice(batchStart, batchStart + BATCH_SIZE)

        await Promise.all(batch.map(async (v, batchIdx) => {
          const globalIdx = batchStart + batchIdx
          const vendor = { ...v, region }

          await send({
            type: 'progress',
            step: `Processing ${vendor.company_name} (${globalIdx + 1}/${vendors.length})...`,
            icon: '⚙️',
          })

          let emailResult: any = { success: false, skipped: true, reason: 'email disabled or no contact email' }

          console.log(`[email-check] ${vendor.company_name}: email_enabled=${settings?.vendor_email_enabled}, has_email=${!!vendor.contact_email}`)

          if (settings?.vendor_email_enabled !== false && vendor.contact_email) {
            try {
              emailResult = await callFunction('vendor-outreach-email', { vendor, settings: emailSettings })
            } catch (err) {
              emailResult = { success: false, error: String(err) }
            }
          } else if (!vendor.contact_email) {
            emailResult = { success: false, skipped: true, reason: 'no contact email' }
          } else if (settings?.vendor_email_enabled === false) {
            emailResult = { success: false, skipped: true, reason: 'email sending disabled in settings' }
          }

          try {
            const leadResult = await callFunction('create-vendor-lead', {
              vendor,
              email_result: emailResult,
              settings: leadSettings,
              token_usage_discovery: discoveryResult.token_usage || null,
              token_usage_email: emailResult?.token_usage || null,
            })

            if (leadResult.skipped) {
              skipped++
            } else {
              leadsCreated++
              if (emailResult?.success) emailsSent++
            }
          } catch (err) {
            console.error(`Lead creation failed for ${vendor.company_name}:`, err)
          }
        }))

        // Small gap between batches to respect Resend rate limits
        if (batchStart + BATCH_SIZE < vendors.length) {
          await new Promise((r) => setTimeout(r, 400))
        }
      }

      await send({ type: 'progress', step: 'All done!', icon: '🎉' })

      const emailDisabled = settings?.vendor_email_enabled === false
      const noEmailCount = vendors.filter((v: any) => !v.contact_email).length

      await send({
        type: 'result',
        leads_created: leadsCreated,
        emails_sent: emailsSent,
        skipped,
        region,
        vendor_types: vendorTypes,
        email_note: emailDisabled
          ? 'Email sending is disabled in Automation Settings'
          : noEmailCount > 0
          ? `${noEmailCount} vendor(s) had no contact email — email skipped for those`
          : undefined,
      })
      await send({ type: 'done' })
    } catch (err) {
      console.error('vendor-agent-chat error:', err)
      try { await send({ type: 'error', message: String(err) }) } catch { /* stream may be closed */ }
      try { await send({ type: 'done' }) } catch { /* stream may be closed */ }
    } finally {
      try { await writer.close() } catch { /* already closed */ }
    }
  })()

  return new Response(readable, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})
