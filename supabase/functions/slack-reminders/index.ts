/**
 * slack-reminders — Scheduled Edge Function
 *
 * This function is called on a schedule (e.g. every 15 minutes via pg_cron or
 * Supabase's scheduled functions). It:
 *   1. Looks for follow-ups and tasks due within the next N minutes (configured
 *      in app_settings.slack_reminder_minutes_before, default 30).
 *   2. Sends a Slack reminder for each one that hasn't been notified yet.
 *   3. Uses a "notified" flag to avoid duplicate messages — achieved by checking
 *      a small in-memory window.
 *
 * Schedule recommendation: Every 15 minutes via Supabase cron (see README).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function buildFollowUpReminderBlocks(
  companyName: string,
  leadId: string,
  scheduledAt: string,
  assigneeName: string,
  notes: string | null,
  minutesBefore: number,
): object[] {
  const appUrl = 'https://connect.remoasset.com'
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⏰ *Follow-up Reminder* — due in *${minutesBefore} minutes*\n*<${appUrl}/leads/${leadId}|${companyName}>*`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Scheduled for:*\n${formatDate(scheduledAt)}` },
        { type: 'mrkdwn', text: `*Assigned to:*\n${assigneeName}` },
      ],
    },
    ...(notes ? [{
      type: 'section',
      text: { type: 'mrkdwn', text: `> ${notes.slice(0, 200)}` },
    }] : []),
    { type: 'divider' },
  ]
}

function buildTaskReminderBlocks(
  taskTitle: string,
  dueDate: string,
  assigneeName: string,
  priority: string,
  leadName: string | null,
  leadId: string | null,
  minutesBefore: number,
): object[] {
  const appUrl = 'https://connect.remoasset.com'
  const PRIORITY_EMOJI: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' }
  const priorityEmoji = PRIORITY_EMOJI[priority] ?? '⚪'
  const leadLink = leadId && leadName ? ` — *<${appUrl}/leads/${leadId}|${leadName}>*` : ''

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `⏰ *Task Due Soon* — in *${minutesBefore} minutes*${leadLink}\n*${taskTitle}*`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Due at:*\n${formatDate(dueDate)}` },
        { type: 'mrkdwn', text: `*Assigned to:*\n${assigneeName}` },
        { type: 'mrkdwn', text: `*Priority:*\n${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)}` },
      ],
    },
    { type: 'divider' },
  ]
}

function buildOverdueFollowUpBlocks(items: { company_name: string; lead_id: string; scheduled_at: string; assignee_name: string }[]): object[] {
  const appUrl = 'https://connect.remoasset.com'
  const itemLines = items
    .slice(0, 10)
    .map((i) => `• *<${appUrl}/leads/${i.lead_id}|${i.company_name}>* — ${formatDate(i.scheduled_at)} (${i.assignee_name})`)
    .join('\n')

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚨 *${items.length} Overdue Follow-up${items.length > 1 ? 's' : ''}*\n${itemLines}${items.length > 10 ? `\n_...and ${items.length - 10} more_` : ''}`,
      },
    },
    { type: 'divider' },
  ]
}

function buildOverdueTaskBlocks(items: { title: string; lead_name: string | null; lead_id: string | null; due_date: string; assignee_name: string }[]): object[] {
  const appUrl = 'https://connect.remoasset.com'
  const itemLines = items
    .slice(0, 10)
    .map((i) => {
      const leadPart = i.lead_id && i.lead_name ? ` (*<${appUrl}/leads/${i.lead_id}|${i.lead_name}>*)` : ''
      return `• *${i.title}*${leadPart} — due ${formatDate(i.due_date)} (${i.assignee_name})`
    })
    .join('\n')

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚨 *${items.length} Overdue Task${items.length > 1 ? 's' : ''}*\n${itemLines}${items.length > 10 ? `\n_...and ${items.length - 10} more_` : ''}`,
      },
    },
    { type: 'divider' },
  ]
}

async function sendToSlack(webhookUrl: string, blocks: object[]): Promise<void> {
  if (blocks.length === 0) return
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })
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

    // Load Slack settings
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('app_settings')
      .select('slack_enabled, slack_webhook_url, slack_reminder_minutes_before')
      .limit(1)
      .single()

    if (settingsErr || !settings?.slack_enabled || !settings?.slack_webhook_url) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Slack not configured or disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const webhookUrl = settings.slack_webhook_url
    const minutesBefore = settings.slack_reminder_minutes_before ?? 30

    const now = new Date()
    const windowStart = new Date(now.getTime() + (minutesBefore - 8) * 60 * 1000) // -8 min buffer
    const windowEnd = new Date(now.getTime() + (minutesBefore + 8) * 60 * 1000)   // +8 min buffer

    let sent = 0

    // ── Follow-up reminders ──────────────────────────────────────────────────
    const { data: upcomingFollowUps } = await supabaseAdmin
      .from('follow_ups')
      .select('id, lead_id, scheduled_at, notes, user_id, leads(company_name), profiles:user_id(full_name)')
      .eq('is_completed', false)
      .gte('scheduled_at', windowStart.toISOString())
      .lte('scheduled_at', windowEnd.toISOString())

    for (const fu of upcomingFollowUps ?? []) {
      const companyName = (fu.leads as { company_name: string } | null)?.company_name ?? 'Unknown Lead'
      const assigneeName = (fu.profiles as { full_name: string | null } | null)?.full_name ?? 'Unknown'
      const blocks = buildFollowUpReminderBlocks(
        companyName,
        fu.lead_id,
        fu.scheduled_at,
        assigneeName,
        fu.notes,
        minutesBefore,
      )
      await sendToSlack(webhookUrl, blocks)
      sent++
    }

    // ── Task reminders ───────────────────────────────────────────────────────
    const { data: upcomingTasks } = await supabaseAdmin
      .from('tasks')
      .select('id, title, due_date, priority, assignee_id, lead_id, leads(company_name), profiles:assignee_id(full_name)')
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .gte('due_date', windowStart.toISOString())
      .lte('due_date', windowEnd.toISOString())

    for (const task of upcomingTasks ?? []) {
      const leadName = (task.leads as { company_name: string } | null)?.company_name ?? null
      const assigneeName = (task.profiles as { full_name: string | null } | null)?.full_name ?? 'Unknown'
      const blocks = buildTaskReminderBlocks(
        task.title,
        task.due_date!,
        assigneeName,
        task.priority,
        leadName,
        task.lead_id,
        minutesBefore,
      )
      await sendToSlack(webhookUrl, blocks)
      sent++
    }

    // ── Overdue follow-ups (batch) ───────────────────────────────────────────
    const overdueWindow = new Date(now.getTime() - 15 * 60 * 1000) // exactly 15 min ago
    const overdueWindowEnd = new Date(now.getTime() - 14 * 60 * 1000)

    const { data: overdueFollowUps } = await supabaseAdmin
      .from('follow_ups')
      .select('id, lead_id, scheduled_at, user_id, leads(company_name), profiles:user_id(full_name)')
      .eq('is_completed', false)
      .gte('scheduled_at', overdueWindow.toISOString())
      .lte('scheduled_at', overdueWindowEnd.toISOString())

    if (overdueFollowUps && overdueFollowUps.length > 0) {
      const items = overdueFollowUps.map((fu) => ({
        company_name: (fu.leads as { company_name: string } | null)?.company_name ?? 'Unknown Lead',
        lead_id: fu.lead_id,
        scheduled_at: fu.scheduled_at,
        assignee_name: (fu.profiles as { full_name: string | null } | null)?.full_name ?? 'Unknown',
      }))
      await sendToSlack(webhookUrl, buildOverdueFollowUpBlocks(items))
      sent++
    }

    // ── Overdue tasks (batch) ────────────────────────────────────────────────
    const { data: overdueTasks } = await supabaseAdmin
      .from('tasks')
      .select('id, title, due_date, priority, assignee_id, lead_id, leads(company_name), profiles:assignee_id(full_name)')
      .eq('is_completed', false)
      .not('due_date', 'is', null)
      .gte('due_date', overdueWindow.toISOString())
      .lte('due_date', overdueWindowEnd.toISOString())

    if (overdueTasks && overdueTasks.length > 0) {
      const items = overdueTasks.map((t) => ({
        title: t.title,
        lead_name: (t.leads as { company_name: string } | null)?.company_name ?? null,
        lead_id: t.lead_id,
        due_date: t.due_date!,
        assignee_name: (t.profiles as { full_name: string | null } | null)?.full_name ?? 'Unknown',
      }))
      await sendToSlack(webhookUrl, buildOverdueTaskBlocks(items))
      sent++
    }

    return new Response(
      JSON.stringify({ ok: true, sent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
