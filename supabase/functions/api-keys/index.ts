import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-auth-token',
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashKey(key: string): Promise<string> {
  const enc = new TextEncoder().encode(key)
  const hash = await crypto.subtle.digest('SHA-256', enc)
  return toHex(hash)
}

function generateApiKey(): { raw: string; prefix: string } {
  const part1 = crypto.randomUUID().replace(/-/g, '')
  const part2 = crypto.randomUUID().replace(/-/g, '')
  const raw = `ra_${part1}${part2}`
  return { raw, prefix: raw.slice(0, 10) + '…' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )

  const authHeader = req.headers.get('Authorization')
  const fallbackToken = req.headers.get('X-Auth-Token')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : (fallbackToken ?? '')
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    )
  }
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    )
  }

  const { data: roleRow } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .single()
  if (roleRow?.role !== 'admin') {
    return new Response(
      JSON.stringify({ error: 'Admin role required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
    )
  }

  try {
    const url = new URL(req.url)
    const match = url.pathname.match(/\/api-keys\/?(.*)$/)
    const path = (match ? match[1] : '') || '/'

    if (req.method === 'POST' && (path === '/' || path === '')) {
      const body = await req.json().catch(() => ({}))
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) {
        return new Response(
          JSON.stringify({ error: 'name is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      const { raw, prefix } = generateApiKey()
      const key_hash = await hashKey(raw)
      const { data: inserted, error } = await supabaseAdmin
        .from('api_keys')
        .insert({ name, key_prefix: prefix, key_hash, created_by: user.id })
        .select('id, key_prefix, created_at')
        .single()
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      return new Response(
        JSON.stringify({
          id: inserted.id,
          name,
          key_prefix: inserted.key_prefix,
          api_key: raw,
          created_at: inserted.created_at,
          message: 'Copy the api_key now; it will not be shown again.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (req.method === 'GET' && (path === '/' || path === '')) {
      const { data: keys, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, name, key_prefix, created_at, last_used_at')
        .order('created_at', { ascending: false })
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      return new Response(
        JSON.stringify({ keys: keys ?? [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (req.method === 'DELETE') {
      const id = path.replace(/^\//, '') || (await req.json().catch(() => ({}))).id
      if (!id) {
        return new Response(
          JSON.stringify({ error: 'id is required' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      const { error } = await supabaseAdmin.from('api_keys').delete().eq('id', id)
      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      return new Response(
        JSON.stringify({ success: true, message: 'API key revoked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e?.message ?? 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
