import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CORE = 'https://my.cloudtalk.io/api'

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

function randomSecret() {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !user) return json({ error: 'Unauthorized' }, 401)

    const { data: callerRole } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).single()
    if (callerRole?.role !== 'admin') return json({ error: 'Admin role required' }, 403)

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const action = (body as { action?: string }).action ?? (req.method === 'GET' ? 'status' : 'status')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const webhookUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/cloudtalk-webhook`
    const apiConfigured = Boolean(basicAuth())

    async function ensureSecret(rotate = false) {
      const { data: existing } = await supabaseAdmin.from('cloudtalk_settings').select('id, webhook_secret').limit(1).maybeSingle()
      if (existing && !rotate) return existing.webhook_secret as string
      const secret = randomSecret()
      if (existing?.id) {
        await supabaseAdmin.from('cloudtalk_settings').update({ webhook_secret: secret, updated_at: new Date().toISOString() }).eq('id', existing.id)
      } else {
        await supabaseAdmin.from('cloudtalk_settings').insert({ webhook_secret: secret })
      }
      return secret
    }

    if (action === 'status' || action === 'ensure_secret') {
      const secret = await ensureSecret(false)
      return json({
        ok: true,
        api_configured: apiConfigured,
        webhook_url: webhookUrl,
        webhook_secret: secret,
        env_secret_overrides: Boolean(Deno.env.get('CLOUDTALK_WEBHOOK_SECRET')),
      })
    }

    if (action === 'rotate_secret') {
      const secret = await ensureSecret(true)
      return json({ ok: true, webhook_url: webhookUrl, webhook_secret: secret })
    }

    if (action === 'test' || action === 'agents' || action === 'numbers') {
      const auth = basicAuth()
      if (!auth) return json({ error: 'Set CLOUDTALK_API_KEY_ID and CLOUDTALK_API_KEY_SECRET on the Edge Function secrets.' }, 400)

      if (action === 'test' || action === 'agents') {
        const res = await fetch(`${CORE}/agents/index.json?limit=200`, { headers: { Authorization: auth } })
        const data = await res.json().catch(() => null)
        if (!res.ok) return json({ error: 'CloudTalk agents request failed', details: data }, res.status)
        const list = (data?.responseData?.data ?? data?.responseData ?? []) as unknown[]
        const agents = (Array.isArray(list) ? list : []).map((row) => {
          const r = row as Record<string, unknown>
          const a = (r.Agent ?? r) as Record<string, unknown>
          return {
            id: Number(a.id),
            name: String(a.fullname ?? `${a.firstname ?? ''} ${a.lastname ?? ''}`.trim() ?? a.email ?? a.id),
            email: a.email ? String(a.email) : null,
            availability: a.availability_status ? String(a.availability_status) : (a.status ? String(a.status) : null),
          }
        }).filter((a) => Number.isFinite(a.id))
        if (action === 'test') return json({ ok: true, agent_count: agents.length, agents: agents.slice(0, 5) })
        return json({ ok: true, agents })
      }

      const res = await fetch(`${CORE}/numbers/index.json?limit=200`, { headers: { Authorization: auth } })
      const data = await res.json().catch(() => null)
      if (!res.ok) return json({ error: 'CloudTalk numbers request failed', details: data }, res.status)
      const list = (data?.responseData?.data ?? []) as unknown[]
      const numbers = (Array.isArray(list) ? list : []).map((row) => {
        const r = row as Record<string, unknown>
        const n = (r.Number ?? r) as Record<string, unknown>
        const e164 = String(n.e164 ?? n.number ?? n.caller_id_e164 ?? '').trim()
        return {
          id: n.id != null ? Number(n.id) : null,
          e164: e164.startsWith('+') ? e164 : e164 ? `+${e164.replace(/[^0-9]/g, '')}` : '',
          name: n.internal_name ? String(n.internal_name) : null,
        }
      }).filter((n) => n.e164)
      return json({ ok: true, numbers })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Failed' }, 500)
  }
})
