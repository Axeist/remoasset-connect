import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers': 'content-disposition, content-type, content-length',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  )

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) return json({ error: 'Unauthorized' }, 401)

  const url = new URL(req.url)
  let callId = url.searchParams.get('call_id') ?? url.searchParams.get('callId')
  let download = url.searchParams.get('download') === '1'
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({})) as { call_id?: string; callId?: string; download?: boolean }
    callId = callId || body.call_id || body.callId || null
    download = download || Boolean(body.download)
  }
  if (!callId) return json({ error: 'call_id required' }, 400)

  const auth = basicAuth()
  if (!auth) return json({ error: 'CloudTalk API keys are not configured' }, 500)

  const rec = await fetch(`${CORE}/calls/recording/${encodeURIComponent(callId)}.json`, {
    headers: { Authorization: auth, Accept: 'audio/wav, application/octet-stream, application/json' },
  })
  const ct = rec.headers.get('content-type') ?? ''
  if (ct.includes('json')) {
    const err = await rec.json().catch(() => null)
    return json({ error: 'Recording is not available yet', detail: err }, rec.status === 200 ? 404 : rec.status)
  }
  const buf = await rec.arrayBuffer()
  if (!rec.ok || buf.byteLength < 100) {
    return json({ error: 'Recording is not available yet' }, rec.ok ? 404 : rec.status)
  }

  const filename = `cloudtalk-${callId}.wav`
  return new Response(buf, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'audio/wav',
      'Content-Length': String(buf.byteLength),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${filename}"`,
      'Cache-Control': 'private, max-age=120',
    },
  })
})
