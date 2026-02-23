import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  )

  try {
    const authHeader = req.headers.get('Authorization')!
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const { data: callerRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (callerRole?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin role required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const { action, target_user_id, new_password, ban } = await req.json()

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'action is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // List users action doesn't need target_user_id
    if (action === 'list_users') {
      const { data: { users }, error: listErr } = await supabaseClient.auth.admin.listUsers({ perPage: 500 })
      if (listErr) {
        return new Response(
          JSON.stringify({ error: listErr.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
      const userList = users.map((u) => ({
        id: u.id,
        email: u.email,
        banned_until: u.banned_until,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }))
      return new Response(
        JSON.stringify({ success: true, users: userList }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: 'target_user_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Prevent admins from modifying their own account via this endpoint
    if (target_user_id === user.id && (action === 'delete_user' || action === 'toggle_ban')) {
      return new Response(
        JSON.stringify({ error: 'You cannot modify your own account here' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    switch (action) {
      case 'reset_password': {
        if (!new_password || new_password.length < 6) {
          return new Response(
            JSON.stringify({ error: 'Password must be at least 6 characters' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        const { error } = await supabaseClient.auth.admin.updateUserById(target_user_id, {
          password: new_password,
        })
        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        return new Response(
          JSON.stringify({ success: true, message: 'Password updated' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'toggle_ban': {
        const banDuration = ban ? '876000h' : 'none'
        const { error } = await supabaseClient.auth.admin.updateUserById(target_user_id, {
          ban_duration: banDuration,
        })
        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        return new Response(
          JSON.stringify({ success: true, message: ban ? 'User restricted' : 'User unrestricted' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'delete_user': {
        // Remove user role and profile first, then delete auth user
        await supabaseClient.from('user_roles').delete().eq('user_id', target_user_id)
        await supabaseClient.from('profiles').delete().eq('user_id', target_user_id)

        const { error } = await supabaseClient.auth.admin.deleteUser(target_user_id)
        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        return new Response(
          JSON.stringify({ success: true, message: 'User deleted' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      case 'send_reset_email': {
        // Fetch target user email
        const { data: targetUser, error: fetchErr } = await supabaseClient.auth.admin.getUserById(target_user_id)
        if (fetchErr || !targetUser?.user?.email) {
          return new Response(
            JSON.stringify({ error: 'Could not find user email' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        // Note: resetPasswordForEmail uses ANON key internally, so we generate a magic link instead
        const { error } = await supabaseClient.auth.admin.generateLink({
          type: 'recovery',
          email: targetUser.user.email,
        })
        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          )
        }
        return new Response(
          JSON.stringify({ success: true, message: `Reset email sent to ${targetUser.user.email}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
