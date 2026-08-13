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

type LeadRow = Record<string, unknown> & {
  hq_country_id?: string | null
  country_ids?: string[] | null
}

/** Attach `country` / `countryId` / `countries` names resolved from `hq_country_id` and `country_ids`. */
async function enrichLeadsWithCountries(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  leads: LeadRow | LeadRow[] | null
): Promise<LeadRow | LeadRow[] | null> {
  if (!leads) return leads
  const list = Array.isArray(leads) ? leads : [leads]
  if (list.length === 0) return leads

  const ids = new Set<string>()
  for (const lead of list) {
    if (lead.hq_country_id) ids.add(lead.hq_country_id)
    for (const cid of lead.country_ids ?? []) {
      if (cid) ids.add(cid)
    }
  }

  const nameById: Record<string, string> = {}
  if (ids.size > 0) {
    const { data: countries } = await supabase
      .from('countries')
      .select('id, name')
      .in('id', [...ids])
    for (const c of countries ?? []) {
      nameById[c.id] = c.name
    }
  }

  const enriched = list.map((lead) => {
    const hqId = lead.hq_country_id ?? null
    const servedIds = Array.isArray(lead.country_ids) ? lead.country_ids : []
    return {
      ...lead,
      countryId: hqId,
      country: hqId ? nameById[hqId] ?? null : null,
      countries: servedIds.map((cid) => nameById[cid]).filter(Boolean),
    }
  })

  return Array.isArray(leads) ? enriched : enriched[0]
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
        if (id === 'bulk') {
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const leadIds = body.lead_ids ?? []
            const updates: Record<string, unknown> = {}
            if (body.status_id !== undefined) updates.status_id = body.status_id
            if (body.owner_id !== undefined) updates.owner_id = body.owner_id
            if (body.country_ids !== undefined) updates.country_ids = body.country_ids
            if (!Array.isArray(leadIds) || leadIds.length === 0 || Object.keys(updates).length === 0)
              return err('Body must include lead_ids (array) and at least one of status_id, owner_id, country_ids', 400)
            const { data, error } = await supabaseAdmin.from('leads').update(updates).in('id', leadIds).select()
            if (error) return err(error.message, 400)
            const enriched = await enrichLeadsWithCountries(supabaseAdmin, data ?? [])
            return json({ updated: Array.isArray(enriched) ? enriched.length : 0, leads: enriched ?? [] })
          }
          break
        }
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('leads').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(await enrichLeadsWithCountries(supabaseAdmin, data))
          }
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('leads').update(body).eq('id', id).select().single()
            if (error) return err(error.message, 400)
            return json(await enrichLeadsWithCountries(supabaseAdmin, data))
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
            // Accept singular country_id (common in automations) and plural country_ids.
            const countryIds = [
              ...url.searchParams.getAll('country_id'),
              ...url.searchParams.getAll('country_ids'),
            ]
              .flatMap((v) => v.split(','))
              .map((v) => v.trim())
              .filter(Boolean)
            const search = url.searchParams.get('search') || url.searchParams.get('q') || ''
            let q = supabaseAdmin.from('leads').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).range(offset, offset + limit - 1)
            if (statusId) q = q.eq('status_id', statusId)
            if (ownerId) q = q.eq('owner_id', ownerId)
            if (countryIds.length) {
              // Match headquarters country OR countries-served array (many leads only set hq_country_id).
              const hqIn = `hq_country_id.in.(${countryIds.join(',')})`
              const servedOv = `country_ids.ov.{${countryIds.join(',')}}`
              q = q.or(`${hqIn},${servedOv}`)
            }
            if (search.trim()) {
              const term = `%${search.trim().replace(/%/g, '')}%`
              q = q.or(`company_name.ilike.${term},contact_name.ilike.${term},email.ilike.${term}`)
            }
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            const enriched = await enrichLeadsWithCountries(supabaseAdmin, data ?? [])
            return json({ data: enriched ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('leads').insert(body).select().single()
            if (error) return err(error.message, 400)
            return json(await enrichLeadsWithCountries(supabaseAdmin, data), 201)
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

      case 'documents': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('lead_documents').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
          if (req.method === 'DELETE') {
            const { error } = await supabaseAdmin.from('lead_documents').delete().eq('id', id)
            if (error) return err(error.message, 400)
            return json({ success: true })
          }
        } else {
          if (req.method === 'GET') {
            const leadId = url.searchParams.get('lead_id')
            if (!leadId) return err('lead_id query param is required', 400)
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const { data, error, count } = await supabaseAdmin.from('lead_documents').select('*', { count: 'exact' }).eq('lead_id', leadId).order('uploaded_at', { ascending: false }).range(offset, offset + limit - 1)
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { lead_id, document_type, file_path, file_name, file_size, custom_name, uploaded_by } = body
            if (!lead_id || !document_type || !file_path || !file_name || !uploaded_by) return err('lead_id, document_type, file_path, file_name, uploaded_by (user_id) are required', 400)
            const validTypes = ['nda', 'pricing', 'custom', 'quotation']
            if (!validTypes.includes(document_type)) return err('document_type must be nda, pricing, custom, or quotation', 400)
            const insertPayload: Record<string, unknown> = { lead_id, document_type, file_path, file_name, uploaded_by }
            if (file_size != null) insertPayload.file_size = file_size
            if (custom_name != null) insertPayload.custom_name = custom_name
            const { data, error } = await supabaseAdmin.from('lead_documents').insert(insertPayload).select().single()
            if (error) return err(error.message, 400)
            return json(data, 201)
          }
        }
        break
      }

      case 'notifications': {
        if (req.method === 'GET') {
          const userId = url.searchParams.get('user_id')
          if (!userId) return err('user_id query param is required', 400)
          const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
          const offset = Number(url.searchParams.get('offset')) || 0
          const { data, error, count } = await supabaseAdmin.from('notifications').select('*', { count: 'exact' }).eq('user_id', userId).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
          if (error) return err(error.message, 400)
          return json({ data: data ?? [], total: count ?? 0 })
        }
        if (req.method === 'POST') {
          const body = await req.json().catch(() => ({}))
          const { user_id, title, message, type, metadata } = body
          if (!user_id || !title || !message) return err('user_id, title, message are required', 400)
          const insertPayload = { user_id, title, message, type: type || 'info', metadata: metadata ?? null }
          const { data, error } = await supabaseAdmin.from('notifications').insert(insertPayload).select().single()
          if (error) return err(error.message, 400)
          return json(data, 201)
        }
        break
      }

      case 'team': {
        if (req.method === 'GET') {
          const { data: roles, error: rolesErr } = await supabaseAdmin.from('user_roles').select('user_id, role')
          if (rolesErr) return err(rolesErr.message, 400)
          const userIds = (roles ?? []).map((r: { user_id: string }) => r.user_id)
          if (userIds.length === 0) return json([])
          const { data: profiles, error: profErr } = await supabaseAdmin.from('profiles').select('user_id, full_name').in('user_id', userIds)
          if (profErr) return err(profErr.message, 400)
          const profileMap = (profiles ?? []).reduce((acc: Record<string, string>, p: { user_id: string; full_name: string | null }) => { acc[p.user_id] = p.full_name ?? ''; return acc }, {})
          const team = (roles ?? []).map((r: { user_id: string; role: string }) => ({ user_id: r.user_id, role: r.role, full_name: profileMap[r.user_id] ?? null }))
          return json(team)
        }
        break
      }

      case 'clients': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('clients').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('clients').update(body).eq('id', id).select().single()
            if (error) return err(error.message, 400)
            return json(data)
          }
          if (req.method === 'DELETE') {
            const { error } = await supabaseAdmin.from('clients').delete().eq('id', id)
            if (error) return err(error.message, 400)
            return json({ success: true })
          }
        } else {
          if (req.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const search = url.searchParams.get('search') || url.searchParams.get('q') || ''
            let q = supabaseAdmin.from('clients').select('*', { count: 'exact' }).order('name').range(offset, offset + limit - 1)
            if (search.trim()) {
              const term = `%${search.trim().replace(/%/g, '')}%`
              q = q.or(`name.ilike.${term},contact_name.ilike.${term},contact_email.ilike.${term}`)
            }
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('clients').insert(body).select().single()
            if (error) return err(error.message, 400)
            return json(data, 201)
          }
        }
        break
      }

      case 'client_requests': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('client_requests').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('client_requests').update(body).eq('id', id).select().single()
            if (error) return err(error.message, 400)
            return json(data)
          }
          if (req.method === 'DELETE') {
            const { error } = await supabaseAdmin.from('client_requests').delete().eq('id', id)
            if (error) return err(error.message, 400)
            return json({ success: true })
          }
        } else {
          if (req.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const clientId = url.searchParams.get('client_id') || undefined
            const status = url.searchParams.get('status') || undefined
            let q = supabaseAdmin.from('client_requests').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
            if (clientId) q = q.eq('client_id', clientId)
            if (status) q = q.eq('status', status)
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('client_requests').insert(body).select().single()
            if (error) return err(error.message, 400)
            return json(data, 201)
          }
        }
        break
      }

      case 'device_pricing': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('vendor_device_pricing').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('vendor_device_pricing').update(body).eq('id', id).select().single()
            if (error) return err(error.message, 400)
            return json(data)
          }
          if (req.method === 'DELETE') {
            const { error } = await supabaseAdmin.from('vendor_device_pricing').delete().eq('id', id)
            if (error) return err(error.message, 400)
            return json({ success: true })
          }
        } else {
          if (req.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const vendorId = url.searchParams.get('vendor_id') || undefined
            const countryId = url.searchParams.get('country_id') || undefined
            const brand = url.searchParams.get('brand') || undefined
            let q = supabaseAdmin.from('vendor_device_pricing').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).range(offset, offset + limit - 1)
            if (vendorId) q = q.eq('vendor_id', vendorId)
            if (countryId) q = q.eq('country_id', countryId)
            if (brand) q = q.ilike('brand', `%${brand.replace(/%/g, '')}%`)
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('vendor_device_pricing').insert(body).select().single()
            if (error) return err(error.message, 400)
            return json(data, 201)
          }
        }
        break
      }

      case 'warehouse_pricing': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('warehouse_vendor_pricing').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
          if (req.method === 'PATCH') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('warehouse_vendor_pricing').update(body).eq('id', id).select().single()
            if (error) return err(error.message, 400)
            return json(data)
          }
          if (req.method === 'DELETE') {
            const { error } = await supabaseAdmin.from('warehouse_vendor_pricing').delete().eq('id', id)
            if (error) return err(error.message, 400)
            return json({ success: true })
          }
        } else {
          if (req.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const vendorId = url.searchParams.get('vendor_id') || undefined
            const countryId = url.searchParams.get('country_id') || undefined
            let q = supabaseAdmin.from('warehouse_vendor_pricing').select('*', { count: 'exact' }).order('updated_at', { ascending: false }).range(offset, offset + limit - 1)
            if (vendorId) q = q.eq('vendor_id', vendorId)
            if (countryId) q = q.eq('country_id', countryId)
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { data, error } = await supabaseAdmin.from('warehouse_vendor_pricing').insert(body).select().single()
            if (error) return err(error.message, 400)
            return json(data, 201)
          }
        }
        break
      }

      case 'lead_transfers': {
        if (id) {
          if (req.method === 'GET') {
            const { data, error } = await supabaseAdmin.from('lead_transfers').select('*').eq('id', id).single()
            if (error || !data) return err(error?.message ?? 'Not found', 404)
            return json(data)
          }
        } else {
          if (req.method === 'GET') {
            const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 100)
            const offset = Number(url.searchParams.get('offset')) || 0
            const leadId = url.searchParams.get('lead_id') || undefined
            let q = supabaseAdmin.from('lead_transfers').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
            if (leadId) q = q.eq('lead_id', leadId)
            const { data, error, count } = await q
            if (error) return err(error.message, 400)
            return json({ data: data ?? [], total: count ?? 0 })
          }
          if (req.method === 'POST') {
            const body = await req.json().catch(() => ({}))
            const { lead_id, from_user_id, to_user_id, transferred_by, notes } = body
            if (!lead_id || !to_user_id || !transferred_by) {
              return err('lead_id, to_user_id, and transferred_by are required', 400)
            }
            const { data: lead, error: leadErr } = await supabaseAdmin.from('leads').select('owner_id, company_name').eq('id', lead_id).single()
            if (leadErr || !lead) return err('Lead not found', 404)
            const { data: transfer, error: transferErr } = await supabaseAdmin.from('lead_transfers').insert({
              lead_id,
              from_user_id: from_user_id ?? lead.owner_id,
              to_user_id,
              transferred_by,
              notes: notes ?? null,
            }).select().single()
            if (transferErr) return err(transferErr.message, 400)
            await supabaseAdmin.from('leads').update({ owner_id: to_user_id }).eq('id', lead_id)
            await supabaseAdmin.from('lead_activities').insert({
              lead_id,
              user_id: transferred_by,
              activity_type: 'transfer',
              description: notes ? `Lead transferred — ${notes}` : 'Lead transferred to new owner',
            })
            return json(transfer, 201)
          }
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
              leads: { list: 'GET /leads', create: 'POST /leads', get: 'GET /leads/:id', update: 'PATCH /leads/:id', delete: 'DELETE /leads/:id', bulk_update: 'PATCH /leads/bulk (body: lead_ids, status_id|owner_id|country_ids)', search: 'GET /leads?search= or q=', filters: 'status_id, owner_id, country_id, country_ids (matches hq_country_id or country_ids)' },
              tasks: { list: 'GET /tasks', create: 'POST /tasks', get: 'GET /tasks/:id', update: 'PATCH /tasks/:id', delete: 'DELETE /tasks/:id' },
              follow_ups: { list: 'GET /follow_ups', create: 'POST /follow_ups', get: 'GET /follow_ups/:id', update: 'PATCH /follow_ups/:id', delete: 'DELETE /follow_ups/:id' },
              activities: { list: 'GET /activities', create: 'POST /activities', get: 'GET /activities/:id', update: 'PATCH /activities/:id', delete: 'DELETE /activities/:id' },
              documents: { list: 'GET /documents?lead_id=', get: 'GET /documents/:id', create: 'POST /documents', delete: 'DELETE /documents/:id' },
              notifications: { list: 'GET /notifications?user_id=', create: 'POST /notifications' },
              team: 'GET /team (user_id, role, full_name for assignee/owner dropdowns)',
              statuses: 'GET /statuses',
              countries: 'GET /countries',
              profiles: 'GET /profiles',
              clients: { list: 'GET /clients', create: 'POST /clients', get: 'GET /clients/:id', update: 'PATCH /clients/:id', delete: 'DELETE /clients/:id', search: 'GET /clients?search= or q=' },
              client_requests: { list: 'GET /client_requests', create: 'POST /client_requests', get: 'GET /client_requests/:id', update: 'PATCH /client_requests/:id', delete: 'DELETE /client_requests/:id', filters: 'client_id, status' },
              device_pricing: { list: 'GET /device_pricing', create: 'POST /device_pricing', get: 'GET /device_pricing/:id', update: 'PATCH /device_pricing/:id', delete: 'DELETE /device_pricing/:id', filters: 'vendor_id, country_id, brand' },
              warehouse_pricing: { list: 'GET /warehouse_pricing', create: 'POST /warehouse_pricing', get: 'GET /warehouse_pricing/:id', update: 'PATCH /warehouse_pricing/:id', delete: 'DELETE /warehouse_pricing/:id', filters: 'vendor_id, country_id' },
              lead_transfers: { list: 'GET /lead_transfers', create: 'POST /lead_transfers (transfers owner + logs activity)', get: 'GET /lead_transfers/:id', filters: 'lead_id' },
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
