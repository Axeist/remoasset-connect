import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-auth-token',
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

  try {
    const body = await req.json().catch(() => ({}))

    // Accept token from Authorization header or body fallback
    const authHeader = req.headers.get('Authorization') ??
      (body.__auth_token ? `Bearer ${body.__auth_token}` : null)

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    // Validate caller using user-scoped client (correct edge function pattern)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
      })
    }

    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    const { data: permRow } = await supabaseAdmin
      .from('role_permissions')
      .select('enabled')
      .eq('role', callerRole?.role)
      .eq('permission', 'app.full_edit')
      .maybeSingle()

    const isLeadership = !!permRow?.enabled
    if (!isLeadership) {
      return new Response(JSON.stringify({ error: 'Admin role required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
      })
    }

    const { data: deletePerm } = await supabaseAdmin
      .from('role_permissions')
      .select('enabled')
      .eq('role', callerRole?.role)
      .eq('permission', 'users.delete')
      .maybeSingle()
    const canDeleteUsers = !!deletePerm?.enabled

    const { action, target_user_id, new_password, ban } = body

    if (!action) {
      return new Response(JSON.stringify({ error: 'action is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    if (action === 'list_users') {
      const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 500 })
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
        })
      }
      const userList = users.map((u) => ({
        id: u.id, email: u.email, banned_until: u.banned_until,
        created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
      }))
      return new Response(JSON.stringify({ success: true, users: userList }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      })
    }

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    if (target_user_id === user.id && (action === 'delete_user' || action === 'toggle_ban')) {
      return new Response(JSON.stringify({ error: 'You cannot modify your own account here' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    switch (action) {
      case 'reset_password': {
        if (!new_password || new_password.length < 6) {
          return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }
        const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, { password: new_password })
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }
        return new Response(JSON.stringify({ success: true, message: 'Password updated' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        })
      }

      case 'toggle_ban': {
        const banDuration = ban ? '876000h' : 'none'
        const { error } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, { ban_duration: banDuration })
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }
        return new Response(JSON.stringify({ success: true, message: ban ? 'User restricted' : 'User unrestricted' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        })
      }

      case 'delete_user': {
        if (!canDeleteUsers) {
          return new Response(JSON.stringify({ error: 'Only Super Admin can delete users' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403,
          })
        }
        const transferTo = body.transfer_to_user_id as string | undefined
        if (!transferTo) {
          return new Response(JSON.stringify({ error: 'transfer_to_user_id is required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }
        if (transferTo === target_user_id) {
          return new Response(JSON.stringify({ error: 'Cannot transfer leads to the user being deleted' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }
        const { data: recipientRole } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', transferTo)
          .single()
        if (recipientRole?.role !== 'super_admin') {
          return new Response(JSON.stringify({ error: 'Leads must be transferred to a Super Admin' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }

        const { data: ownedLeads, error: leadsErr } = await supabaseAdmin
          .from('leads')
          .select('id')
          .eq('owner_id', target_user_id)
        if (leadsErr) {
          return new Response(JSON.stringify({ error: leadsErr.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }
        const leadIds = (ownedLeads ?? []).map((l: { id: string }) => l.id)
        if (leadIds.length > 0) {
          const { error: transferUpdateErr } = await supabaseAdmin
            .from('leads')
            .update({ owner_id: transferTo })
            .eq('owner_id', target_user_id)
          if (transferUpdateErr) {
            return new Response(JSON.stringify({ error: transferUpdateErr.message }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
            })
          }
          const transferRows = leadIds.map((lead_id: string) => ({
            lead_id,
            from_user_id: target_user_id,
            to_user_id: transferTo,
            transferred_by: user.id,
            notes: 'User deleted — leads transferred to Super Admin',
          }))
          await supabaseAdmin.from('lead_transfers').insert(transferRows)
          await supabaseAdmin.from('notifications').insert({
            user_id: transferTo,
            title: 'Leads transferred to you',
            message: `${leadIds.length} lead${leadIds.length === 1 ? '' : 's'} were transferred because a user was deleted.`,
            type: 'lead',
          })
        }

        await supabaseAdmin.from('user_roles').delete().eq('user_id', target_user_id)
        await supabaseAdmin.from('profiles').delete().eq('user_id', target_user_id)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(target_user_id)
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }
        return new Response(JSON.stringify({
          success: true,
          message: 'User deleted',
          transferred_leads: leadIds.length,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        })
      }

      case 'send_reset_email': {
        const { data: targetUser, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(target_user_id)
        if (fetchErr || !targetUser?.user?.email) {
          return new Response(JSON.stringify({ error: 'Could not find user email' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }
        const { error } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery', email: targetUser.user.email,
        })
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
          })
        }
        return new Response(JSON.stringify({ success: true, message: `Reset email sent to ${targetUser.user.email}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
        })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
        })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
