/**
 * slack-digest — Scheduled Edge Function
 *
 * Sends a daily summary to the Slack channel at the configured hour
 * (app_settings.slack_digest_hour, default 9 AM UTC).
 *
 * Schedule: Every hour via pg_cron — the function self-gates by checking
 * whether the current UTC hour matches the configured digest hour.
 *
 * Summary includes:
 *   • New leads added in the last 24h
 *   • Activities logged in the last 24h
 *   • Tasks due today (incomplete)
 *   • Follow-ups scheduled today (incomplete)
 *   • Overdue tasks (past due, still incomplete)
 *   • Overdue follow-ups (past due, still incomplete)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
    })
  } catch {
    return iso
  }
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
      .select('slack_enabled, slack_webhook_url, slack_notify_daily_digest, slack_digest_hour')
      .limit(1)
      .single()

    if (settingsErr || !settings?.slack_enabled || !settings?.slack_webhook_url) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Slack not configured or disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (!settings.slack_notify_daily_digest) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Daily digest is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Allow explicit trigger (force=true in body) to bypass hour check
    let force = false
    try {
      const body = await req.json().catch(() => ({}))
      force = body?.force === true
    } catch { /* ignore */ }

    const currentHour = new Date().getUTCHours()
    const digestHour = settings.slack_digest_hour ?? 9
    if (!force && currentHour !== digestHour) {
      return new Response(
        JSON.stringify({ ok: false, reason: `Not digest hour (current: ${currentHour}, configured: ${digestHour})` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const webhookUrl = settings.slack_webhook_url
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

    const appUrl = 'https://connect.remoasset.com'

    // Fetch all data in parallel
    const [
      { data: newLeads },
      { data: activities },
      { data: tasksDueToday },
      { data: followUpsDueToday },
      { data: overdueTasks },
      { data: overdueFollowUps },
    ] = await Promise.all([
      // New leads in last 24h
      supabaseAdmin
        .from('leads')
        .select('id, company_name, contact_name, lead_statuses:status_id(name)')
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false }),

      // Activities in last 24h
      supabaseAdmin
        .from('lead_activities')
        .select('id, activity_type, leads:lead_id(id, company_name), profiles:user_id(full_name)')
        .gte('created_at', yesterday.toISOString()),

      // Tasks due today (incomplete)
      supabaseAdmin
        .from('tasks')
        .select('id, title, priority, assignee_id, lead_id, leads(company_name), profiles:assignee_id(full_name)')
        .eq('is_completed', false)
        .gte('due_date', todayStart.toISOString())
        .lt('due_date', todayEnd.toISOString()),

      // Follow-ups scheduled today (incomplete)
      supabaseAdmin
        .from('follow_ups')
        .select('id, lead_id, scheduled_at, user_id, leads(company_name), profiles:user_id(full_name)')
        .eq('is_completed', false)
        .gte('scheduled_at', todayStart.toISOString())
        .lt('scheduled_at', todayEnd.toISOString()),

      // Overdue tasks
      supabaseAdmin
        .from('tasks')
        .select('id, title, due_date, priority, assignee_id, lead_id, leads(company_name), profiles:assignee_id(full_name)')
        .eq('is_completed', false)
        .not('due_date', 'is', null)
        .lt('due_date', now.toISOString()),

      // Overdue follow-ups
      supabaseAdmin
        .from('follow_ups')
        .select('id, lead_id, scheduled_at, user_id, leads(company_name), profiles:user_id(full_name)')
        .eq('is_completed', false)
        .lt('scheduled_at', now.toISOString()),
    ])

    // Count activities by type
    const activityCounts: Record<string, number> = {}
    ;(activities ?? []).forEach((a: { activity_type: string }) => {
      activityCounts[a.activity_type] = (activityCounts[a.activity_type] ?? 0) + 1
    })
    const activitySummary = Object.entries(activityCounts)
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ')

    const dateLabel = formatDate(now.toISOString())
    const blocks: object[] = []

    // Header
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: `📊 Daily CRM Digest — ${dateLabel}`, emoji: true },
    })
    blocks.push({ type: 'divider' })

    // Summary stats
    blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*🆕 New Leads (24h):*\n${newLeads?.length ?? 0}` },
        { type: 'mrkdwn', text: `*📌 Activities (24h):*\n${activities?.length ?? 0}${activitySummary ? ` _(${activitySummary})_` : ''}` },
        { type: 'mrkdwn', text: `*✅ Tasks Due Today:*\n${tasksDueToday?.length ?? 0}` },
        { type: 'mrkdwn', text: `*📅 Follow-ups Today:*\n${followUpsDueToday?.length ?? 0}` },
        { type: 'mrkdwn', text: `*⚠️ Overdue Tasks:*\n${overdueTasks?.length ?? 0}` },
        { type: 'mrkdwn', text: `*⚠️ Overdue Follow-ups:*\n${overdueFollowUps?.length ?? 0}` },
      ],
    })
    blocks.push({ type: 'divider' })

    // New leads section
    if (newLeads && newLeads.length > 0) {
      const leadLines = newLeads.slice(0, 5).map((l: { id: string; company_name: string; contact_name: string | null; lead_statuses: { name: string } | null }) => {
        const status = l.lead_statuses?.name ?? 'New'
        const contact = l.contact_name ? ` — ${l.contact_name}` : ''
        return `• *<${appUrl}/leads/${l.id}|${l.company_name}>*${contact} _(${status})_`
      }).join('\n')
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🆕 New Leads Added*\n${leadLines}${newLeads.length > 5 ? `\n_...and ${newLeads.length - 5} more_` : ''}`,
        },
      })
      blocks.push({ type: 'divider' })
    }

    // Tasks due today
    if (tasksDueToday && tasksDueToday.length > 0) {
      const PRIORITY_EMOJI: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' }
      const taskLines = tasksDueToday.slice(0, 8).map((t: {
        title: string; priority: string; lead_id: string | null;
        leads: { company_name: string } | null; profiles: { full_name: string | null } | null
      }) => {
        const emoji = PRIORITY_EMOJI[t.priority] ?? '⚪'
        const leadPart = t.lead_id && t.leads ? ` (*<${appUrl}/leads/${t.lead_id}|${t.leads.company_name}>*)` : ''
        const assignee = t.profiles?.full_name ?? 'Unknown'
        return `${emoji} *${t.title}*${leadPart} — ${assignee}`
      }).join('\n')
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*✅ Tasks Due Today*\n${taskLines}${tasksDueToday.length > 8 ? `\n_...and ${tasksDueToday.length - 8} more_` : ''}`,
        },
      })
      blocks.push({ type: 'divider' })
    }

    // Follow-ups today
    if (followUpsDueToday && followUpsDueToday.length > 0) {
      const fuLines = followUpsDueToday.slice(0, 8).map((fu: {
        lead_id: string; scheduled_at: string;
        leads: { company_name: string } | null; profiles: { full_name: string | null } | null
      }) => {
        const time = new Date(fu.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
        const companyName = fu.leads?.company_name ?? 'Unknown'
        const assignee = fu.profiles?.full_name ?? 'Unknown'
        return `• *<${appUrl}/leads/${fu.lead_id}|${companyName}>* at ${time} UTC — ${assignee}`
      }).join('\n')
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📅 Follow-ups Today*\n${fuLines}${followUpsDueToday.length > 8 ? `\n_...and ${followUpsDueToday.length - 8} more_` : ''}`,
        },
      })
      blocks.push({ type: 'divider' })
    }

    // Overdue alerts
    const overdueTaskCount = overdueTasks?.length ?? 0
    const overdueFollowUpCount = overdueFollowUps?.length ?? 0
    if (overdueTaskCount > 0 || overdueFollowUpCount > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*⚠️ Overdue Items Requiring Attention*\n${overdueTaskCount > 0 ? `• ${overdueTaskCount} overdue task${overdueTaskCount > 1 ? 's' : ''}` : ''}${overdueFollowUpCount > 0 ? `\n• ${overdueFollowUpCount} overdue follow-up${overdueFollowUpCount > 1 ? 's' : ''}` : ''}`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'View in CRM', emoji: true },
          url: `${appUrl}/tasks`,
        },
      })
      blocks.push({ type: 'divider' })
    }

    // Footer
    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `_RemoAsset CRM Daily Digest · <${appUrl}|Open CRM>_`,
      }],
    })

    const slackRes = await fetch(webhookUrl, {
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
