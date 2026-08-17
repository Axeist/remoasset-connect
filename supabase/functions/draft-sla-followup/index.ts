/**
 * draft-sla-followup — tiny Haiku draft for SLA follow-up emails.
 * Input: lead_id. Output: { subject, body }. Never sends mail.
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FALLBACK_INTENTS: Record<string, string> = {
  new: 'First outreach; they have not been contacted yet.',
  contacted: 'First touch already happened. Continue; do not re-introduce.',
  qualified: 'Fit is established. Push the next commercial step.',
  proposal: 'NDA/contract sent; they have not signed yet.',
  negotiation: 'They rebutted the NDA. Address redlines; do not re-send intro.',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const lead_id = body.lead_id as string | undefined
    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'lead_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select(`
        id, company_name, contact_name, email, last_activity_at, status_changed_at, created_at,
        status:lead_statuses(name, sla_followup_intent, sla_idle_days, sla_stage_days)
      `)
      .eq('id', lead_id)
      .single()

    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: leadErr?.message ?? 'Lead not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const status = Array.isArray(lead.status) ? lead.status[0] : lead.status
    const statusName = status?.name ?? 'Unknown'
    const intent =
      (status?.sla_followup_intent as string | null)?.trim() ||
      FALLBACK_INTENTS[String(statusName).toLowerCase()] ||
      'Nudge the next step. Stay brief.'

    const { data: lastAct } = await supabase
      .from('lead_activities')
      .select('activity_type, description, created_at')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const now = Date.now()
    const idleDays = Math.floor(
      (now - new Date(lead.last_activity_at || lead.created_at).getTime()) / 86400000
    )
    const stageDays = Math.floor(
      (now - new Date(lead.status_changed_at || lead.created_at).getTime()) / 86400000
    )
    const snippet = String(lastAct?.description ?? '').replace(/\s+/g, ' ').slice(0, 200)
    const firstName = String(lead.contact_name || lead.company_name || 'there').trim().split(/\s+/)[0]

    const { data: settings } = await supabase
      .from('app_settings')
      .select('ai_model, from_name')
      .limit(1)
      .maybeSingle()

    const model = 'claude-haiku-4-5-20251001'
    const fromName = settings?.from_name || 'RemoAsset'
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })

    const response = await anthropic.messages.create({
      model,
      max_tokens: 350,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: `Write a short follow-up email. Return JSON only: {"subject":"...","body":"..."}
Playbook: ${intent}
To first name: ${firstName}
Company: ${lead.company_name}
Stage: ${statusName}
Idle days: ${idleDays}
Days in stage: ${stageDays}
Last activity: ${lastAct?.activity_type ?? 'none'} ${lastAct?.created_at ?? ''} ${snippet}
Sign as ${fromName}. Body 120-180 words, no markdown, no HTML.`,
        },
      ],
    })

    const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let parsed: { subject?: string; body?: string } = {}
    try {
      parsed = JSON.parse(jsonMatch?.[0] ?? '{}')
    } catch {
      parsed = {}
    }

    if (!parsed.subject || !parsed.body) {
      return new Response(JSON.stringify({ error: 'Could not draft email', raw: text.slice(0, 400) }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        subject: parsed.subject,
        body: parsed.body,
        to: lead.email,
        stage: statusName,
        usage: response.usage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Draft failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
