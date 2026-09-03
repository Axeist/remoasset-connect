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
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
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
  const notesRaw = historyRow?.Notes ?? det.notes
  let notes = ''
  if (typeof notesRaw === 'string') notes = notesRaw
  else if (Array.isArray(notesRaw)) {
    notes = notesRaw
      .map((n) => (typeof n === 'string' ? n : n && typeof n === 'object' && 'note' in n ? String((n as { note: unknown }).note) : ''))
      .filter(Boolean)
      .join('\n')
  }

  const type = asString(cdr.type ?? det.direction) ?? 'outgoing'
  const direction = /in/i.test(type) ? 'inbound' : 'outbound'
  const talking = parseSeconds(cdr.talking_time ?? det.call_times && (det.call_times as Record<string, unknown>).talking_time)
  const waiting = parseSeconds(cdr.waiting_time)
  const wrapup = parseSeconds(cdr.wrapup_time)
  const status = asString(cdr.status ?? det.status) ?? (talking && talking > 0 ? 'answered' : 'missed')
  const publicExternal = asString(cdr.public_external ?? contact.number)
  const publicInternal = asString(cdr.public_internal)
  const recordingLink = asString(cdr.recording_link)
  const recorded = Boolean(cdr.recorded ?? det.recorded)
  const isVoicemail = Boolean(cdr.is_voicemail)

  return {
    direction,
    status,
    from_number: direction === 'outbound' ? publicInternal : publicExternal,
    to_number: direction === 'outbound' ? publicExternal : publicInternal,
    external_number: publicExternal,
    internal_number: publicInternal,
    agent_id: asString(agent.id ?? cdr.user_id ?? det.agent_id),
    agent_name:
      asString(agent.fullname ?? agent.name) ||
      [asString(agent.firstname), asString(agent.lastname)].filter(Boolean).join(' ') ||
      null,
    agent_email: asString(agent.email),
    duration_seconds: talking,
    waiting_seconds: waiting,
    wrapup_seconds: wrapup,
    started_at: asString(cdr.started_at ?? det.date),
    answered_at: asString(cdr.answered_at),
    ended_at: asString(cdr.ended_at),
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
  return blob.includes('recording') && (blob.includes('uploaded') || blob.includes('recording_url') || blob.includes('"object":"recording"'))
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

function buildDescription(n: ReturnType<typeof normalizeCdr>): string {
  const talk = formatDuration(n.duration_seconds)
  const status = n.is_voicemail ? 'voicemail' : (n.status || 'completed')
  const lines = [
    `CloudTalk ${n.direction} · ${status} · ${talk}`,
  ]
  const meta: string[] = []
  if (n.agent_name) meta.push(`Agent: ${n.agent_name}`)
  const num = n.external_number ? (n.external_number.startsWith('+') ? n.external_number : `+${n.external_number}`) : null
  if (num) meta.push(num)
  if (meta.length) lines.push(meta.join(' · '))
  if (n.notes) lines.push(n.notes)
  if (n.tags.length) lines.push(`Tags: ${n.tags.join(', ')}`)
  return lines.join('\n')
}

function buildMeta(n: ReturnType<typeof normalizeCdr>, extras: Record<string, unknown>) {
  return {
    type: 'cloudtalk_call',
    url: (extras.recordingUrl as string) || n.recording_link || 'cloudtalk',
    name: 'CloudTalk call',
    callId: extras.callId,
    direction: n.direction,
    status: n.is_voicemail ? 'voicemail' : n.status,
    talkingSeconds: n.duration_seconds,
    waitingSeconds: n.waiting_seconds,
    wrapupSeconds: n.wrapup_seconds,
    agentName: n.agent_name,
    fromNumber: n.from_number,
    toNumber: n.to_number,
    startedAt: n.started_at,
    answeredAt: n.answered_at,
    endedAt: n.ended_at,
    tags: n.tags,
    notes: n.notes,
    recordingLink: n.recording_link,
    recordingUrl: extras.recordingUrl ?? null,
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

    const { historyRow, details } = await fetchCallBundle(callId, auth)
    const n = normalizeCdr(historyRow, details, payload)
    const wantRecording = isRecordingEvent(payload) || Boolean(n.recorded)

    const matchDigits = digits(n.external_number) || digits(n.to_number) || digits(n.from_number)
    const { data: matchedLeadId } = await supabase.rpc('match_lead_id_by_phone_digits', {
      p_digits: matchDigits,
    })
    const leadId = (matchedLeadId as string | null) ?? null

    let recordingUrl: string | null = null
    let recordingPath: string | null = null
    let ci: Record<string, unknown> = {}

    if (wantRecording) {
      const rec = await ctGet(`${CORE}/calls/recording/${encodeURIComponent(callId)}.json`, auth)
      if (rec.ok && rec.buf && rec.buf.byteLength > 100) {
        recordingPath = `${leadId ?? 'unmatched'}/${callId}.wav`
        const { error: upErr } = await supabase.storage.from('call-recordings').upload(recordingPath, rec.buf, {
          contentType: 'audio/wav',
          upsert: true,
        })
        if (!upErr) {
          const { data: pub } = supabase.storage.from('call-recordings').getPublicUrl(recordingPath)
          recordingUrl = pub.publicUrl
        }
      }
      ci = await fetchCi(callId, auth)
    }

    const { data: existing } = await supabase
      .from('cloudtalk_calls')
      .select('id, activity_id, lead_id')
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
      recording_link: n.recording_link,
      recording_storage_path: recordingPath,
      tags: n.tags,
      notes: n.notes,
      ci_payload: ci,
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

    const meta = buildMeta(n, {
      callId,
      recordingUrl,
      insightsPending: wantRecording ? Object.keys(ci).length === 0 : true,
      ci,
    })
    const description = buildDescription(n)
    const source = { type: 'activity_source', url: 'cloudtalk', name: 'CloudTalk' }
    const attachments = [meta, source]
    if (recordingUrl) {
      attachments.push({ type: 'file', url: recordingUrl, name: 'Call recording' } as typeof meta)
    }

    let activityId = saved?.activity_id ?? existing?.activity_id
    if (activityId) {
      const { data: prev } = await supabase.from('lead_activities').select('attachments').eq('id', activityId).maybeSingle()
      const prevAtt = Array.isArray(prev?.attachments) ? prev.attachments : []
      const kept = (prevAtt as { type?: string }[]).filter((a) => a.type !== 'cloudtalk_call' && a.type !== 'activity_source' && a.name !== 'Call recording')
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
