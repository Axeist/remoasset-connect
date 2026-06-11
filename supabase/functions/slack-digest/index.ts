/**
 * slack-digest — Scheduled Edge Function
 *
 * Sends the MTD Lead Pipeline Report to Slack each morning at the configured
 * IST hour (app_settings.slack_digest_hour, default 9 AM IST).
 *
 * Replaces the legacy daily CRM digest with the Lead Report format from
 * Reports → Lead Report (created-date, this-month MTD).
 *
 * Schedule: hourly via pg_cron — self-gates on slack_digest_hour.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const APP_URL = 'https://connect.remoasset.com'
const BATCH_SIZE = 1000

function istHourToUtcHour(istHour: number): number {
  const utcMinutes = istHour * 60 - 330
  return Math.floor(((utcMinutes % 1440) + 1440) % 1440 / 60)
}

function getMtdRangeIST(): { from: string; to: string; label: string; rangeLabel: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const year = parts.find((p) => p.type === 'year')!.value
  const month = parts.find((p) => p.type === 'month')!.value
  const day = parts.find((p) => p.type === 'day')!.value

  const from = `${year}-${month}-01T00:00:00+05:30`
  const to = now.toISOString()

  const monthName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'long',
    year: 'numeric',
  }).format(now)

  const dayNum = parseInt(day, 10)
  const shortMonth = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
  }).format(now)

  return {
    from,
    to,
    label: `${monthName} — MTD Lead Report`,
    rangeLabel: `${shortMonth} 1–${dayNum}, ${year}`,
  }
}

async function fetchAllPaginated<T>(
  runQuery: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await runQuery(offset, offset + BATCH_SIZE - 1)
    if (error) throw error
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }
  return all
}

type LeadRow = {
  id: string
  owner_id: string | null
  country_ids: string[] | null
  lead_statuses: { name: string; color: string } | { name: string; color: string }[] | null
}

function todayIstDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function truncateMrkdwn(text: string, max = 2800): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function statusName(lead: LeadRow): string {
  const s = lead.lead_statuses
  if (!s) return 'Unassigned'
  const info = Array.isArray(s) ? s[0] : s
  return info?.name ?? 'Unassigned'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
    )

    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from('app_settings')
      .select('id, slack_enabled, slack_webhook_url, slack_notify_daily_digest, slack_digest_hour, slack_digest_last_sent_ist')
      .limit(1)
      .single()

    if (settingsErr || !settings?.slack_enabled || !settings?.slack_webhook_url) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Slack not configured or disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    let force = false
    try {
      const body = await req.json().catch(() => ({}))
      force = body?.force === true
    } catch { /* ignore */ }

    if (!settings.slack_notify_daily_digest && !force) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Morning lead report is disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    const currentHour = new Date().getUTCHours()
    const digestHour = settings.slack_digest_hour ?? 9
    const targetUtcHour = istHourToUtcHour(digestHour)
    if (!force && currentHour !== targetUtcHour) {
      return new Response(
        JSON.stringify({ ok: false, reason: `Not report hour (UTC ${currentHour}, target UTC ${targetUtcHour} = ${digestHour}:00 IST)` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    const todayIst = todayIstDate()
    if (!force && settings.slack_digest_last_sent_ist === todayIst) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'Morning lead report already sent today (IST)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      )
    }

    const { from, to, label, rangeLabel } = getMtdRangeIST()

    const [leads, statuses, countries, profiles] = await Promise.all([
      fetchAllPaginated<LeadRow>((pageFrom, pageTo) =>
        supabaseAdmin
          .from('leads')
          .select('id, owner_id, country_ids, lead_statuses:status_id(name, color)')
          .gte('created_at', from)
          .lte('created_at', to)
          .range(pageFrom, pageTo),
      ),
      supabaseAdmin.from('lead_statuses').select('name, color, sort_order').order('sort_order'),
      supabaseAdmin.from('countries').select('id, name, region'),
      supabaseAdmin.from('profiles').select('user_id, full_name'),
    ])

    const statusList = statuses.data ?? []
    const countryMap = Object.fromEntries((countries.data ?? []).map((c: { id: string; name: string; region: string | null }) => [c.id, c]))
    const profileMap = Object.fromEntries((profiles.data ?? []).map((p: { user_id: string; full_name: string | null }) => [p.user_id, p.full_name || 'Unknown']))

    const total = leads.length
    const proposal = leads.filter((l) => statusName(l) === 'Proposal').length
    const won = leads.filter((l) => statusName(l) === 'Won').length
    const lost = leads.filter((l) => statusName(l) === 'Lost').length

    const countryIds = new Set<string>()
    const regions = new Set<string>()
    leads.forEach((l) => {
      (l.country_ids ?? []).forEach((cid: string) => {
        countryIds.add(cid)
        const r = countryMap[cid]?.region
        if (r) regions.add(r)
      })
    })

    const winRate = total > 0 ? ((won / total) * 100).toFixed(1) : '0'
    const proposalRate = total > 0 ? ((proposal / total) * 100).toFixed(1) : '0'

    type AgentAgg = { name: string; total: number; byStatus: Record<string, number>; countries: Record<string, number>; regions: Set<string> }
    const byAgent: Record<string, AgentAgg> = {}

    leads.forEach((lead) => {
      const uid = lead.owner_id ?? '__unassigned__'
      if (!byAgent[uid]) {
        byAgent[uid] = {
          name: uid === '__unassigned__' ? 'Unassigned' : (profileMap[uid] ?? uid.slice(0, 8)),
          total: 0,
          byStatus: {},
          countries: {},
          regions: new Set(),
        }
      }
      const row = byAgent[uid]
      row.total++
      const sName = statusName(lead)
      row.byStatus[sName] = (row.byStatus[sName] ?? 0) + 1
      ;(lead.country_ids ?? []).forEach((cid: string) => {
        const c = countryMap[cid]
        if (!c) return
        if (c.region) row.regions.add(c.region)
        row.countries[c.name] = (row.countries[c.name] ?? 0) + 1
      })
    })

    const agentRows = Object.entries(byAgent)
      .map(([userId, agg]) => ({ userId, ...agg }))
      .sort((a, b) => b.total - a.total)

    const statusCols = statusList.length > 0
      ? statusList.map((s: { name: string }) => s.name)
      : ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']

    const blocks: object[] = []

    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: `📊 ${label}`, emoji: true },
    })
    blocks.push({
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `_Live · ${rangeLabel} · Created-date basis_` }],
    })
    blocks.push({ type: 'divider' })

    blocks.push({
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Total leads*\n*${total}*` },
        { type: 'mrkdwn', text: `*Proposal / NDA*\n*${proposal}* _(${proposalRate}%)_` },
        { type: 'mrkdwn', text: `*Closed won*\n*${won}* _(${winRate}% win rate)_` },
        { type: 'mrkdwn', text: `*Countries*\n*${countryIds.size}* _(${regions.size} regions)_` },
        { type: 'mrkdwn', text: `*Lost*\n*${lost}*` },
        { type: 'mrkdwn', text: `*Agents*\n*${agentRows.length}*` },
      ],
    })
    blocks.push({ type: 'divider' })

    if (agentRows.length > 0) {
      const headerCols = ['Agent', 'Tot', ...statusCols.slice(0, 5).map((n: string) => n.slice(0, 4))]
      const tableHeader = headerCols.map((h) => h.padEnd(6)).join(' ')
      const tableRows = agentRows.slice(0, 8).map((row) => {
        const cols = [
          row.name.slice(0, 14).padEnd(14),
          String(row.total).padStart(3),
          ...statusCols.slice(0, 5).map((s: string) => String(row.byStatus[s] ?? 0).padStart(4)),
        ]
        return cols.join(' ')
      })

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Agent performance*\n\`\`\`${tableHeader}\n${tableRows.join('\n')}\`\`\`${agentRows.length > 8 ? `\n_...and ${agentRows.length - 8} more agents_` : ''}`,
        },
      })
      blocks.push({ type: 'divider' })

      const coverageLines = agentRows.slice(0, 5).map((row) => {
        const topCountries = Object.entries(row.countries)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 4)
          .map(([name, count]) => `${name} ${count}`)
          .join(', ')
        const regionStr = [...row.regions].join(' · ')
        return `*${row.name}*${regionStr ? ` _(${regionStr})_` : ''}\n${topCountries || '_No countries_'}`
      }).join('\n\n')

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: truncateMrkdwn(`*Country coverage*\n${coverageLines}`) },
      })
      blocks.push({ type: 'divider' })
    }

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${APP_URL}/reports|Open Lead Report in RemoAsset →>`,
      },
    })

    blocks.push({
      type: 'context',
      elements: [{
        type: 'mrkdwn',
        text: `_RemoAsset Morning Lead Report · ${new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date())} IST_`,
      }],
    })

    const fallbackText = `${label} · ${total} leads · ${won} won · ${agentRows.length} agents`

    const slackRes = await fetch(settings.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fallbackText, blocks }),
    })

    if (!slackRes.ok) {
      const text = await slackRes.text()
      return new Response(
        JSON.stringify({ error: 'Slack rejected the message', detail: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 },
      )
    }

    if (settings.id) {
      await supabaseAdmin
        .from('app_settings')
        .update({ slack_digest_last_sent_ist: todayIst })
        .eq('id', settings.id)
    }

    return new Response(
      JSON.stringify({ ok: true, leads: total, agents: agentRows.length, report: 'morning_lead' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
