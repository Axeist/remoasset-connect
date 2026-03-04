import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SlackEvent =
  | 'lead_created'
  | 'activity_logged'
  | 'stage_changed'

interface LeadCreatedPayload {
  company_name: string
  contact_name?: string | null
  status?: string | null
  owner?: string | null
  country?: string | null
  lead_score?: number | null
  lead_id: string
}

interface ActivityLoggedPayload {
  company_name: string
  activity_type: string
  description: string
  logged_by?: string | null
  lead_id: string
}

interface StageChangedPayload {
  company_name: string
  from_stage: string
  to_stage: string
  moved_by?: string | null
  lead_id: string
}

type EventPayload = LeadCreatedPayload | ActivityLoggedPayload | StageChangedPayload

const ACTIVITY_EMOJI: Record<string, string> = {
  call: '📞',
  email: '📧',
  meeting: '🤝',
  whatsapp: '💬',
  linkedin: '🔗',
  nda: '📋',
  quotation: '📄',
  note: '📝',
}

function buildBlocks(event: SlackEvent, payload: EventPayload): object[] {
  const appUrl = 'https://connect.remoasset.com'

  if (event === 'lead_created') {
    const p = payload as LeadCreatedPayload
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🆕 *New Lead Added*\n*<${appUrl}/leads/${p.lead_id}|${p.company_name}>*`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Contact:*\n${p.contact_name || '—'}` },
          { type: 'mrkdwn', text: `*Status:*\n${p.status || 'Unassigned'}` },
          { type: 'mrkdwn', text: `*Owner:*\n${p.owner || 'Unassigned'}` },
          { type: 'mrkdwn', text: `*Country:*\n${p.country || '—'}` },
        ],
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Lead score: *${p.lead_score ?? 0}*` },
        ],
      },
      { type: 'divider' },
    ]
  }

  if (event === 'activity_logged') {
    const p = payload as ActivityLoggedPayload
    const emoji = ACTIVITY_EMOJI[p.activity_type] ?? '📌'
    const typeLabel = p.activity_type.charAt(0).toUpperCase() + p.activity_type.slice(1)
    const truncated = p.description.length > 200
      ? p.description.slice(0, 200) + '…'
      : p.description
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${typeLabel}* logged on *<${appUrl}/leads/${p.lead_id}|${p.company_name}>*`,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `> ${truncated.replace(/\n/g, '\n> ')}` },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Logged by: *${p.logged_by || 'Unknown'}*` },
        ],
      },
      { type: 'divider' },
    ]
  }

  if (event === 'stage_changed') {
    const p = payload as StageChangedPayload
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔀 *Stage Changed* — *<${appUrl}/leads/${p.lead_id}|${p.company_name}>*\n*${p.from_stage}* → *${p.to_stage}*`,
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Moved by: *${p.moved_by || 'Unknown'}*` },
        ],
      },
      { type: 'divider' },
    ]
  }

  return []
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
    )

    // Load Slack settings from app_settings
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('app_settings')
      .select('slack_enabled, slack_webhook_url')
      .limit(1)
      .single()

    if (settingsErr || !settings?.slack_enabled || !settings?.slack_webhook_url) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Slack not configured or disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const body = await req.json()
    const { event, payload } = body as { event: SlackEvent; payload: EventPayload }

    if (!event || !payload) {
      return new Response(
        JSON.stringify({ error: 'Missing event or payload' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const blocks = buildBlocks(event, payload)

    const slackRes = await fetch(settings.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    })

    if (!slackRes.ok) {
      const text = await slackRes.text()
      return new Response(
        JSON.stringify({ error: 'Slack rejected the message', detail: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      )
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
