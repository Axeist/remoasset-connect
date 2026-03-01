import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = req.headers.get('Authorization')?.replace('Bearer ', '')?.trim()
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header. Use: Authorization: Bearer <your_api_key>' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    )
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )

  const keyHash = await hashKey(apiKey)
  const { data: keyRow, error: keyErr } = await supabaseAdmin
    .from('api_keys')
    .select('id')
    .eq('key_hash', keyHash)
    .single()
  if (keyErr || !keyRow) {
    return new Response(
      JSON.stringify({ error: 'Invalid API key' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    )
  }
  await supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(() => {})

  const url = new URL(req.url)
  const match = url.pathname.match(/\/api\/?(.*)$/)
  const pathAfterApi = match ? match[1] : ''
  const pathParts = pathAfterApi.split('/').filter(Boolean)
  const resource = pathParts[0] ?? ''
  const id = pathParts[1] ?? null
  const baseUrl = `${url.origin}/functions/v1/api`

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

  const err = (message: string, status: number) =>
    json({ error: message }, status)

  try {
    switch (resource) {
      case 'leads': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('leads').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('leads').update(body).eq('id', id).select().single()
            if (error) return err(error.message, 400)
            return json(data)
          }
          if (req.method === 'DELETE') {
            const { error } = await supabaseAdmin.from('leads').delete().eq('id', id)
            if (error) return err(error.message, 400)
            return json({ success: true })
          }
        } else {
          if (req.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const statusId = url.searchParams.get('status_id') || undefined
            const ownerId = url.searchParams.get('owner_id') || undefined
            let q = supabaseAdmin.from('leads').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).range(offset, offset + limit - 1)
            if (statusId) q = q.eq('status_id', statusId)
            if (ownerId) q = q.eq('owner_id', ownerId)
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('leads').insert(body).select().single()
            if (error) return err(error.message, 400)
            return json(data, 201)
          }
        }
        break
      }

      case 'tasks': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('tasks').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('tasks').update(body).eq('id', id).select().single()
            if (error) return err(error.message, 400)
            return json(data)
          }
          if (req.method === 'DELETE') {
            const { error } = await supabaseAdmin.from('tasks').delete().eq('id', id)
            if (error) return err(error.message, 400)
            return json({ success: true })
          }
        } else {
          if (req.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const assigneeId = url.searchParams.get('assignee_id') || undefined
            const leadId = url.searchParams.get('lead_id') || undefined
            const isCompleted = url.searchParams.get('is_completed')
            let q = supabaseAdmin.from('tasks').select('*', { count: 'exact' }).order('due_date', { ascending: true, nullsFirst: false }).range(offset, offset + limit - 1)
            if (assigneeId) q = q.eq('assignee_id', assigneeId)
            if (leadId) q = q.eq('lead_id', leadId)
            if (isCompleted !== undefined && isCompleted !== '') q = q.eq('is_completed', isCompleted === 'true')
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('tasks').insert(body).select().single()
            if (error) return err(error.message, 400)
            return json(data, 201)
          }
        }
        break
      }

      case 'follow_ups': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('follow_ups').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('follow_ups').update(body).eq('id', id).select().single()
            if (error) return err(error.message, 400)
            return json(data)
          }
          if (req.method === 'DELETE') {
            const { error } = await supabaseAdmin.from('follow_ups').delete().eq('id', id)
            if (error) return err(error.message, 400)
            return json({ success: true })
          }
        } else {
          if (req.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const leadId = url.searchParams.get('lead_id') || undefined
            const userId = url.searchParams.get('user_id') || undefined
            let q = supabaseAdmin.from('follow_ups').select('*', { count: 'exact' }).order('scheduled_at', { ascending: true }).range(offset, offset + limit - 1)
            if (leadId) q = q.eq('lead_id', leadId)
            if (userId) q = q.eq('user_id', userId)
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('follow_ups').insert(body).select().single()
            if (error) return err(error.message, 400)
            return json(data, 201)
          }
        }
        break
      }

      case 'activities': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('lead_activities').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('lead_activities').update(body).eq('id', id).select().single()
            if (error) return err(error.message, 400)
            return json(data)
          }
          if (req.method === 'DELETE') {
            const { error } = await supabaseAdmin.from('lead_activities').delete().eq('id', id)
            if (error) return err(error.message, 400)
            return json({ success: true })
          }
        } else {
          if (req.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const leadId = url.searchParams.get('lead_id') || undefined
            let q = supabaseAdmin.from('lead_activities').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
            if (leadId) q = q.eq('lead_id', leadId)
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('lead_activities').insert(body).select().single()
            if (error) return err(error.message, 400)
            return json(data, 201)
          }
        }
        break
      }

      case 'statuses': {
        if (req.method === 'GET') {
          const { data, error } = await supabaseAdmin.from('lead_statuses').select('*').order('sort_order')
          if (error) return err(error.message, 400)
          return json(data ?? [])
        }
        break
      }

      case 'countries': {
        if (req.method === 'GET') {
          const { data, error } = await supabaseAdmin.from('countries').select('*').order('name')
          if (error) return err(error.message, 400)
          return json(data ?? [])
        }
        break
      }

      case 'profiles': {
        if (req.method === 'GET') {
          const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
          const { data, error } = await supabaseAdmin.from('profiles').select('user_id, full_name, designation, phone').limit(limit)
          if (error) return err(error.message, 400)
          return json(data ?? [])
        }
        break
      }

      case '': {
        if (req.method === 'GET') {
          return json({
            name: 'RemoAsset Connect API',
            version: '1.0',
            base_url: baseUrl,
            auth: 'Authorization: Bearer <your_api_key>',
            endpoints: {
              leads: { list: 'GET /leads', create: 'POST /leads', get: 'GET /leads/:id', update: 'PATCH /leads/:id', delete: 'DELETE /leads/:id' },
              tasks: { list: 'GET /tasks', create: 'POST /tasks', get: 'GET /tasks/:id', update: 'PATCH /tasks/:id', delete: 'DELETE /tasks/:id' },
              follow_ups: { list: 'GET /follow_ups', create: 'POST /follow_ups', get: 'GET /follow_ups/:id', update: 'PATCH /follow_ups/:id', delete: 'DELETE /follow_ups/:id' },
              activities: { list: 'GET /activities', create: 'POST /activities', get: 'GET /activities/:id', update: 'PATCH /activities/:id', delete: 'DELETE /activities/:id' },
              statuses: 'GET /statuses',
              countries: 'GET /countries',
              profiles: 'GET /profiles',
            },
          })
        }
        break
      }

      default:
        return err(`Unknown resource: ${resource}. Use GET ${baseUrl} for API info.`, 404)
    }

    return err('Method not allowed', 405)
  } catch (e) {
    return json({ error: e?.message ?? 'Internal server error' }, 500)
  }
})
