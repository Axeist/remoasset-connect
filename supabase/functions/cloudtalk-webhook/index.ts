import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-cloudtalk-secret, x-webhook-secret',
}

const CORE = 'https://my.cloudtalk.io/api'
const ANALYTICS = 'https://analytics-api.cloudtalk.io/api'
const CI = 'https://api.cloudtalk.io/v1'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function basicAuth(): string | null {
  const id = Deno.env.get('CLOUDTALK_API_KEY_ID')
  const secret = Deno.env.get('CLOUDTALK_API_KEY_SECRET')
  if (!id || !secret) return null
  return `Basic ${btoa(`${id}:${secret}`)}`
}

function walkFind(obj: unknown, keys: string[], depth = 0): unknown {
  if (obj == null || depth > 8) return undefined
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = walkFind(item, keys, depth + 1)
      if (found != null) return found
    }
    return undefined
  }
  if (typeof obj !== 'object') return undefined
  const rec = obj as Record<string, unknown>
  for (const k of keys) {
    if (rec[k] != null && rec[k] !== '') return rec[k]
  }
  for (const v of Object.values(rec)) {
    const found = walkFind(v, keys, depth + 1)
    if (found != null) return found
  }
  return undefined
}

function asString(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s || null
}

function digits(v: unknown): string {
  return asString(v)?.replace(/[^0-9]/g, '') ?? ''
}

function parseSeconds(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'string') {
    const t = v.trim()
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
      const parts = t.split(':').map(Number)
      if (parts.some((p) => !Number.isFinite(p))) return null
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
      return parts[0] * 60 + parts[1]
    }
  }
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

function prettyPhone(v: string | null): string | null {
  if (!v) return null
  const d = digits(v)
  if (!d) return v
  return v.startsWith('+') ? v : `+${d}`
}

function firstDuration(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = parseSeconds(v)
    if (n != null) return n
  }
  return null
}

function extractNotesText(raw: unknown): string {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'string') return raw.trim()
  if (Array.isArray(raw)) return raw.map(extractNotesText).filter(Boolean).join('\n')
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return extractNotesText(o.note ?? o.notes ?? o.text ?? o.content ?? o.message ?? o.body)
  }
  return String(raw).trim()
}

function payloadWrapupNotes(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const rec = payload as Record<string, unknown>
  const event = rec.event && typeof rec.event === 'object' ? rec.event as Record<string, unknown> : null
  const props =
    (rec.properties && typeof rec.properties === 'object' ? rec.properties as Record<string, unknown> : null) ??
    (event?.properties && typeof event.properties === 'object' ? event.properties as Record<string, unknown> : null) ??
    rec
  return extractNotesText(
    props.notes ??
      props.note ??
      props.wrapup_notes ??
      props.wrapup_note ??
      props.call_notes ??
      props.agent_note ??
      rec.notes ??
      rec.note,
  )
}

async function fetchCallNotes(callId: string, auth: string): Promise<string> {
  const urls = [
    `${CORE}/notes/index.json?call_id=${encodeURIComponent(callId)}&limit=20`,
    `${CORE}/calls/notes.json?call_id=${encodeURIComponent(callId)}`,
  ]
  for (const url of urls) {
    const res = await ctGet(url, auth)
    if (!res.ok || !res.json) continue
    const envelope = res.json as { responseData?: { data?: unknown[] }; data?: unknown[] }
    const rows = envelope.responseData?.data ?? envelope.data
    if (Array.isArray(rows) && rows.length) {
      const text = extractNotesText(rows)
      if (text) return text
    }
    const direct = extractNotesText(res.json)
    if (direct && direct.length < 4000) return direct
  }
  return ''
}

function firstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    const s = asString(v)
    if (s) return s
  }
  return null
}

/** CloudTalk uses incoming/outgoing. Do not match the letters "in" inside "outgoing". */
function parseCallDirection(raw: string | null): 'inbound' | 'outbound' {
  const t = (raw ?? '').toLowerCase()
  if (/\boutgoing\b|\boutbound\b|\bout\b/.test(t) || t === 'outgoing' || t === 'outbound') return 'outbound'
  if (t.includes('outgoing') || t.includes('outbound')) return 'outbound'
  if (t.includes('incoming') || t.includes('inbound')) return 'inbound'
  return 'outbound'
}

function formatDuration(sec: number | null): string {
  if (sec == null || sec < 0) return '—'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

async function ctGet(url: string, auth: string): Promise<{ ok: boolean; status: number; json?: unknown; buf?: ArrayBuffer }> {
  const res = await fetch(url, { headers: { Authorization: auth, Accept: 'application/json' } })
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('json')) {
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, json: data }
  }
  const buf = await res.arrayBuffer()
  return { ok: res.ok, status: res.status, buf }
}

async function fetchCallBundle(callId: string, auth: string) {
  const history = await ctGet(`${CORE}/calls/index.json?call_id=${encodeURIComponent(callId)}&limit=1`, auth)
  let row: Record<string, unknown> | null = null
  const envelope = history.json as { responseData?: { data?: unknown[] } } | null
  const data = envelope?.responseData?.data
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    row = data[0] as Record<string, unknown>
  }
  const details = await ctGet(`${ANALYTICS}/calls/${encodeURIComponent(callId)}`, auth)
  return { historyRow: row, details: details.ok ? details.json : null }
}

function normalizeCdr(historyRow: Record<string, unknown> | null, details: unknown, payload: unknown) {
  const cdr = (historyRow?.Cdr ?? historyRow?.cdr ?? {}) as Record<string, unknown>
  const agent = (historyRow?.Agent ?? {}) as Record<string, unknown>
  const det = (details && typeof details === 'object' ? details : {}) as Record<string, unknown>
  const contact = (historyRow?.Contact ?? det.contact ?? {}) as Record<string, unknown>
  const tagsRaw = historyRow?.Tags ?? det.call_tags ?? []
  const tags: string[] = []
  if (Array.isArray(tagsRaw)) {
    for (const t of tagsRaw) {
      if (typeof t === 'string') tags.push(t)
      else if (t && typeof t === 'object' && 'name' in t) tags.push(String((t as { name: unknown }).name))
    }
  }
  const notes = payloadWrapupNotes(payload) || extractNotesText(historyRow?.Notes ?? det.notes)

  const callTimes = (det.call_times && typeof det.call_times === 'object'
    ? det.call_times
    : {}) as Record<string, unknown>

  const type = firstString(
    walkFind(payload, ['direction', 'call_type']),
    cdr.type,
    det.direction,
  ) ?? 'outgoing'
  const direction = parseCallDirection(type)

  const talking = firstDuration(
    walkFind(payload, ['talking_time', 'talkingTime', 'talk_time', 'billsec', 'duration']),
    cdr.talking_time,
    callTimes.talking_time,
    det.talking_time,
  )
  const waiting = firstDuration(
    walkFind(payload, ['waiting_time', 'waitingTime']),
    cdr.waiting_time,
    callTimes.waiting_time,
  )
  const wrapup = firstDuration(
    walkFind(payload, ['wrapup_time', 'wrapupTime', 'wrap_up_time']),
    cdr.wrapup_time,
    callTimes.wrapup_time,
  )

  const publicExternal = prettyPhone(firstString(
    walkFind(payload, ['external_number', 'externalNumber', 'public_external', 'customer_number']),
    cdr.public_external,
    asString(contact.number),
  ))
  const publicInternal = prettyPhone(firstString(
    walkFind(payload, ['internal_number', 'internalNumber', 'public_internal', 'agent_number']),
    cdr.public_internal,
  ))

  const statusRaw = firstString(
    walkFind(payload, ['status', 'call_status', 'hangup_cause']),
    cdr.status,
    det.status,
  )
  const talkingPositive = talking != null && talking > 0
  const status = statusRaw ?? (talkingPositive ? 'answered' : 'missed')

  const recordingLink = firstString(
    walkFind(payload, ['recording_link', 'recording_url', 'recordingLink', 'recordingUrl']),
    cdr.recording_link,
    det.recording_link,
    det.recording_url,
  )
  const recorded = Boolean(
    walkFind(payload, ['recorded', 'is_recorded']) ?? cdr.recorded ?? det.recorded ?? recordingLink,
  )
  const isVoicemail = Boolean(
    walkFind(payload, ['is_voicemail', 'voicemail']) ?? cdr.is_voicemail,
  )

  const agentName =
    firstString(
      walkFind(payload, ['agent_name', 'agentName', 'user_name', 'userName']),
      agent.fullname,
      agent.name,
      [asString(agent.firstname), asString(agent.lastname)].filter(Boolean).join(' '),
    ) || null

  const contactName = firstString(
    walkFind(payload, ['contact_name', 'contactName']),
    contact.name,
    contact.fullname,
  )

  return {
    direction,
    status,
    from_number: direction === 'outbound' ? publicInternal : publicExternal,
    to_number: direction === 'outbound' ? publicExternal : publicInternal,
    external_number: publicExternal,
    internal_number: publicInternal,
    contact_name: contactName,
    agent_id: firstString(walkFind(payload, ['agent_id', 'user_id']), agent.id, cdr.user_id, det.agent_id),
    agent_name: agentName,
    agent_email: firstString(walkFind(payload, ['agent_email', 'user_email']), agent.email),
    duration_seconds: talking,
    waiting_seconds: waiting,
    wrapup_seconds: wrapup,
    started_at: firstString(walkFind(payload, ['started_at', 'start_time', 'date']), cdr.started_at, det.date),
    answered_at: firstString(walkFind(payload, ['answered_at', 'answer_time']), cdr.answered_at),
    ended_at: firstString(walkFind(payload, ['ended_at', 'end_time']), cdr.ended_at),
    recorded,
    is_voicemail: isVoicemail,
    recording_link: recordingLink,
    tags,
    notes,
    payload,
  }
}

function isRecordingEvent(payload: unknown): boolean {
  const blob = JSON.stringify(payload).toLowerCase()
  return blob.includes('recording') && (
    blob.includes('uploaded') ||
    blob.includes('"object":"recording"') ||
    blob.includes('recording.uploaded')
  )
}

async function fetchCi(callId: string, auth: string) {
  const paths = [
    `calls/${callId}/summary`,
    `calls/${callId}/overall-sentiment`,
    `calls/${callId}/sentiment`,
    `calls/${callId}/smart-notes`,
    `calls/${callId}/transcription`,
    `calls/${callId}/talk-listen-ratio`,
    `calls/${callId}/topics`,
    `calls/${callId}/details-link`,
    `conversation-intelligence/calls/${callId}/summary`,
  ]
  const out: Record<string, unknown> = {}
  for (const p of paths) {
    const res = await ctGet(`${CI}/${p}`, auth)
    const key = p.split('/').pop() as string
    if (res.ok && res.json) out[key] = res.json
    await new Promise((r) => setTimeout(r, 150))
  }
  return out
}

function humanOutcome(n: ReturnType<typeof normalizeCdr>): string {
  if (n.is_voicemail) return 'Voicemail'
  const s = (n.status ?? '').toLowerCase().replace(/[_-]+/g, ' ')
  if (s.includes('answer') || s === 'completed') return n.duration_seconds && n.duration_seconds > 0 ? 'Answered' : 'Completed'
  if (s.includes('miss') || s.includes('no answer')) return 'Missed'
  if (s.includes('busy')) return 'Busy'
  if (s.includes('cancel')) return 'Cancelled'
  if (s.includes('fail')) return 'Failed'
  if (s) return s.replace(/\b\w/g, (c) => c.toUpperCase())
  return n.duration_seconds && n.duration_seconds > 0 ? 'Answered' : 'Missed'
}

function buildDescription(n: ReturnType<typeof normalizeCdr>): string {
  const talk = formatDuration(n.duration_seconds)
  const dir = n.direction === 'inbound' ? 'Inbound' : 'Outbound'
  const lines = [`CloudTalk ${dir} · ${humanOutcome(n)} · ${talk}`]
  const bits: string[] = []
  if (n.agent_name) bits.push(n.agent_name)
  if (n.contact_name) bits.push(n.contact_name)
  if (n.external_number) bits.push(n.external_number)
  if (bits.length) lines.push(bits.join(' · '))
  if (n.from_number && n.to_number) lines.push(`${n.from_number} → ${n.to_number}`)
  if (n.notes) lines.push(n.notes)
  if (n.tags.length) lines.push(`Tags: ${n.tags.join(', ')}`)
  return lines.join('\n')
}

function buildMeta(n: ReturnType<typeof normalizeCdr>, extras: Record<string, unknown>) {
  return {
    type: 'cloudtalk_call',
    url: n.recording_link || 'cloudtalk',
    name: 'CloudTalk call',
    callId: extras.callId,
    direction: n.direction,
    status: n.is_voicemail ? 'voicemail' : n.status,
    outcome: humanOutcome(n),
    talkingSeconds: n.duration_seconds,
    waitingSeconds: n.waiting_seconds,
    wrapupSeconds: n.wrapup_seconds,
    agentName: n.agent_name,
    agentEmail: n.agent_email,
    contactName: n.contact_name,
    fromNumber: n.from_number,
    toNumber: n.to_number,
    externalNumber: n.external_number,
    internalNumber: n.internal_number,
    startedAt: n.started_at,
    answeredAt: n.answered_at,
    endedAt: n.ended_at,
    tags: n.tags,
    notes: n.notes,
    recordingLink: n.recording_link,
    recordingUrl: null,
    recorded: n.recorded,
    isVoicemail: n.is_voicemail,
    insightsPending: extras.insightsPending ?? false,
    ci: extras.ci ?? {},
  }
}

async function resolveUserId(
  supabase: SupabaseClient,
  agentId: string | null,
  agentEmail: string | null,
  leadOwnerId: string | null,
): Promise<string> {
  if (agentId) {
    const { data } = await supabase.from('profiles').select('user_id').eq('cloudtalk_agent_id', Number(agentId)).maybeSingle()
    if (data?.user_id) return data.user_id
  }
  if (agentEmail) {
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 500 })
    const match = users?.users?.find((u) => u.email?.toLowerCase() === agentEmail.toLowerCase())
    if (match) return match.id
  }
  if (leadOwnerId) return leadOwnerId
  const { data: admin } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(1).maybeSingle()
  if (admin?.user_id) return admin.user_id
  throw new Error('No user to attribute CloudTalk activity')
}

async function loadWebhookSecret(supabase: SupabaseClient): Promise<string | null> {
  const envSecret = Deno.env.get('CLOUDTALK_WEBHOOK_SECRET')
  if (envSecret) return envSecret
  const { data } = await supabase.from('cloudtalk_settings').select('webhook_secret').limit(1).maybeSingle()
  return data?.webhook_secret ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )

  try {
    const expected = await loadWebhookSecret(supabase)
    const provided =
      req.headers.get('x-cloudtalk-secret') ??
      req.headers.get('x-webhook-secret') ??
      req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
      ''
    if (!expected || provided !== expected) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const auth = basicAuth()
    if (!auth) return json({ error: 'CloudTalk API keys are not configured' }, 500)

    const payload = await req.json().catch(() => ({}))
    const callId = asString(
      walkFind(payload, ['call_id', 'callId', 'cdr_id', 'cdrId', 'id', 'uuid', 'call_uuid']),
    )
    if (!callId) return json({ error: 'call_id missing in payload' }, 400)

    let { historyRow, details } = await fetchCallBundle(callId, auth)
    let n = normalizeCdr(historyRow, details, payload)
    if (!n.notes) {
      n = { ...n, notes: await fetchCallNotes(callId, auth) }
    }
    if (!n.notes) {
      await new Promise((r) => setTimeout(r, 1200))
      const retry = await fetchCallBundle(callId, auth)
      historyRow = retry.historyRow
      details = retry.details
      n = normalizeCdr(historyRow, details, payload)
      if (!n.notes) n = { ...n, notes: await fetchCallNotes(callId, auth) }
    }
    const recordingEvent = isRecordingEvent(payload)

    const matchDigits = digits(n.external_number) || digits(n.to_number) || digits(n.from_number)
    const { data: matchedLeadId } = await supabase.rpc('match_lead_id_by_phone_digits', {
      p_digits: matchDigits,
    })
    const leadId = (matchedLeadId as string | null) ?? null

    let ci: Record<string, unknown> = {}
    if (recordingEvent) {
      ci = await fetchCi(callId, auth)
    }

    const { data: existing } = await supabase
      .from('cloudtalk_calls')
      .select('id, activity_id, lead_id, recording_link, ci_payload, notes')
      .eq('cloudtalk_call_id', callId)
      .maybeSingle()

    const callRow = {
      cloudtalk_call_id: callId,
      lead_id: leadId ?? existing?.lead_id ?? null,
      direction: n.direction,
      status: n.status,
      from_number: n.from_number,
      to_number: n.to_number,
      agent_id: n.agent_id,
      agent_name: n.agent_name,
      duration_seconds: n.duration_seconds,
      waiting_seconds: n.waiting_seconds,
      wrapup_seconds: n.wrapup_seconds,
      started_at: n.started_at,
      answered_at: n.answered_at,
      ended_at: n.ended_at,
      recorded: n.recorded,
      is_voicemail: n.is_voicemail,
      recording_link: n.recording_link ?? existing?.recording_link ?? null,
      tags: n.tags,
      notes: n.notes || existing?.notes || '',
      ci_payload: Object.keys(ci).length > 0 ? ci : (existing?.ci_payload ?? {}),
      raw_payload: payload,
      updated_at: new Date().toISOString(),
    }

    const { data: saved, error: saveErr } = await supabase
      .from('cloudtalk_calls')
      .upsert(callRow, { onConflict: 'cloudtalk_call_id' })
      .select('id, activity_id, lead_id')
      .single()
    if (saveErr) return json({ error: saveErr.message }, 500)

    const finalLeadId = leadId ?? saved?.lead_id ?? existing?.lead_id
    if (!finalLeadId) {
      return json({ ok: true, matched: false, call_id: callId, message: 'No matching lead' })
    }

    const { data: lead } = await supabase.from('leads').select('owner_id').eq('id', finalLeadId).single()
    const userId = await resolveUserId(supabase, n.agent_id, n.agent_email, lead?.owner_id ?? null)

    const meta = buildMeta({
      ...n,
      recording_link: n.recording_link ?? existing?.recording_link ?? null,
      notes: n.notes || existing?.notes || '',
    }, {
      callId,
      insightsPending: recordingEvent && Object.keys(ci).length === 0,
      ci: Object.keys(ci).length > 0 ? ci : (existing?.ci_payload ?? {}),
    })
    const description = buildDescription(n)
    const source = { type: 'activity_source', url: 'cloudtalk', name: 'CloudTalk' }
    const attachments = [meta, source]

    let activityId = saved?.activity_id ?? existing?.activity_id
    if (activityId) {
      const { data: prev } = await supabase.from('lead_activities').select('attachments').eq('id', activityId).maybeSingle()
      const prevAtt = Array.isArray(prev?.attachments) ? prev.attachments : []
      const kept = (prevAtt as { type?: string; name?: string }[]).filter(
        (a) => a.type !== 'cloudtalk_call' && a.type !== 'activity_source' && a.name !== 'Call recording',
      )
      await supabase.from('lead_activities').update({
        description,
        attachments: [...kept, ...attachments],
      }).eq('id', activityId)
    } else {
      const { data: activity, error: actErr } = await supabase.from('lead_activities').insert({
        lead_id: finalLeadId,
        user_id: userId,
        activity_type: 'call',
        description,
        attachments,
      }).select('id').single()
      if (actErr) return json({ error: actErr.message }, 500)
      activityId = activity.id
      await supabase.from('cloudtalk_calls').update({ activity_id: activityId, lead_id: finalLeadId }).eq('cloudtalk_call_id', callId)
    }

    return json({ ok: true, matched: true, call_id: callId, lead_id: finalLeadId, activity_id: activityId })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Webhook failed' }, 500)
  }
})
