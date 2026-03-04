import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SlackEvent =
  | 'lead_created'
  | 'activity_logged'
  | 'stage_changed'
  | 'lead_assigned'
  | 'task_created'
  | 'task_completed'
  | 'followup_created'
  | 'document_sent'

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

interface LeadAssignedPayload {
  company_name: string
  assigned_to: string
  assigned_by?: string | null
  lead_id: string
}

interface TaskCreatedPayload {
  task_title: string
  description?: string | null
  assigned_to: string
  due_date?: string | null
  priority: string
  lead_name?: string | null
  lead_id?: string | null
  created_by?: string | null
}

interface TaskCompletedPayload {
  task_title: string
  completed_by: string
  lead_name?: string | null
  lead_id?: string | null
}

interface FollowUpCreatedPayload {
  company_name: string
  scheduled_at: string
  notes?: string | null
  assigned_to: string
  lead_id: string
}

interface DocumentSentPayload {
  company_name: string
  document_type: string
  file_name?: string | null
  sent_by?: string | null
  lead_id: string
}

type EventPayload =
  | LeadCreatedPayload
  | ActivityLoggedPayload
  | StageChangedPayload
  | LeadAssignedPayload
  | TaskCreatedPayload
  | TaskCompletedPayload
  | FollowUpCreatedPayload
  | DocumentSentPayload

interface AppSettings {
  slack_enabled: boolean
  slack_webhook_url: string
  slack_notify_lead_created: boolean
  slack_notify_stage_changed: boolean
  slack_notify_activity_logged: boolean
  slack_notify_task_created: boolean
  slack_notify_task_completed: boolean
  slack_notify_followup_created: boolean
  slack_notify_lead_assigned: boolean
  slack_notify_document_sent: boolean
}

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

const PRIORITY_EMOJI: Record<string, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  urgent: '🔴',
}

const DOC_EMOJI: Record<string, string> = {
  nda: '📋',
  quotation: '📄',
  pricing: '💰',
  custom: '📎',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    }) + ' UTC'
  } catch {
    return iso
  }
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
        elements: [{ type: 'mrkdwn', text: `Lead score: *${p.lead_score ?? 0}*` }],
      },
      { type: 'divider' },
    ]
  }

  if (event === 'activity_logged') {
    const p = payload as ActivityLoggedPayload
    const emoji = ACTIVITY_EMOJI[p.activity_type] ?? '📌'
    const typeLabel = p.activity_type.charAt(0).toUpperCase() + p.activity_type.slice(1)
    const truncated = p.description.length > 200 ? p.description.slice(0, 200) + '…' : p.description
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
        elements: [{ type: 'mrkdwn', text: `Logged by: *${p.logged_by || 'Unknown'}*` }],
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
        elements: [{ type: 'mrkdwn', text: `Moved by: *${p.moved_by || 'Unknown'}*` }],
      },
      { type: 'divider' },
    ]
  }

  if (event === 'lead_assigned') {
    const p = payload as LeadAssignedPayload
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `👤 *Lead Assigned* — *<${appUrl}/leads/${p.lead_id}|${p.company_name}>*\nNow assigned to *${p.assigned_to}*`,
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Assigned by: *${p.assigned_by || 'Unknown'}*` }],
      },
      { type: 'divider' },
    ]
  }

  if (event === 'task_created') {
    const p = payload as TaskCreatedPayload
    const priorityEmoji = PRIORITY_EMOJI[p.priority] ?? '⚪'
    const leadLink = p.lead_id && p.lead_name
      ? ` — *<${appUrl}/leads/${p.lead_id}|${p.lead_name}>*`
      : ''
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ *New Task Created*${leadLink}\n*${p.task_title}*`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Assigned to:*\n${p.assigned_to}` },
          { type: 'mrkdwn', text: `*Priority:*\n${priorityEmoji} ${p.priority.charAt(0).toUpperCase() + p.priority.slice(1)}` },
          { type: 'mrkdwn', text: `*Due date:*\n${p.due_date ? formatDate(p.due_date) : 'No due date'}` },
          { type: 'mrkdwn', text: `*Created by:*\n${p.created_by || 'Unknown'}` },
        ],
      },
      ...(p.description ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `> ${p.description.slice(0, 200)}` },
      }] : []),
      { type: 'divider' },
    ]
  }

  if (event === 'task_completed') {
    const p = payload as TaskCompletedPayload
    const leadLink = p.lead_id && p.lead_name
      ? ` — *<${appUrl}/leads/${p.lead_id}|${p.lead_name}>*`
      : ''
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🎉 *Task Completed*${leadLink}\n*${p.task_title}*`,
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `Completed by: *${p.completed_by}*` }],
      },
      { type: 'divider' },
    ]
  }

  if (event === 'followup_created') {
    const p = payload as FollowUpCreatedPayload
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📅 *Follow-up Scheduled* — *<${appUrl}/leads/${p.lead_id}|${p.company_name}>*`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Scheduled for:*\n${formatDate(p.scheduled_at)}` },
          { type: 'mrkdwn', text: `*Assigned to:*\n${p.assigned_to}` },
        ],
      },
      ...(p.notes ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `> ${p.notes.slice(0, 200)}` },
      }] : []),
      { type: 'divider' },
    ]
  }

  if (event === 'document_sent') {
    const p = payload as DocumentSentPayload
    const emoji = DOC_EMOJI[p.document_type] ?? '📄'
    const docLabel = p.document_type.charAt(0).toUpperCase() + p.document_type.slice(1)
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *${docLabel} Sent* — *<${appUrl}/leads/${p.lead_id}|${p.company_name}>*`,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*File:*\n${p.file_name || '—'}` },
          { type: 'mrkdwn', text: `*Sent by:*\n${p.sent_by || 'Unknown'}` },
        ],
      },
      { type: 'divider' },
    ]
  }

  return []
}

const EVENT_TOGGLE_MAP: Record<SlackEvent, keyof AppSettings> = {
  lead_created: 'slack_notify_lead_created',
  stage_changed: 'slack_notify_stage_changed',
  activity_logged: 'slack_notify_activity_logged',
  task_created: 'slack_notify_task_created',
  task_completed: 'slack_notify_task_completed',
  followup_created: 'slack_notify_followup_created',
  lead_assigned: 'slack_notify_lead_assigned',
  document_sent: 'slack_notify_document_sent',
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

    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('app_settings')
      .select('slack_enabled, slack_webhook_url, slack_notify_lead_created, slack_notify_stage_changed, slack_notify_activity_logged, slack_notify_task_created, slack_notify_task_completed, slack_notify_followup_created, slack_notify_lead_assigned, slack_notify_document_sent')
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

    // Check per-event toggle
    const toggleKey = EVENT_TOGGLE_MAP[event]
    if (toggleKey && settings[toggleKey] === false) {
      return new Response(
        JSON.stringify({ ok: false, reason: `Notifications for "${event}" are disabled` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const blocks = buildBlocks(event, payload)
    if (blocks.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Unknown event type' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

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
