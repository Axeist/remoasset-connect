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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

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

    const { data: invitePerm } = await supabaseClient
      .from('role_permissions')
      .select('enabled')
      .eq('role', callerRole?.role)
      .eq('permission', 'users.invite')
      .maybeSingle()

    if (!invitePerm?.enabled) {
      return new Response(
        JSON.stringify({ error: 'Admin role required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const { email, role, full_name } = await req.json()

    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const assignable = ['procurement_specialist', 'csm', 'developer', 'admin']
    const requested = role === 'employee' ? 'procurement_specialist' : role
    let assignedRole = assignable.includes(requested) ? requested : 'procurement_specialist'
    if (requested === 'super_admin') {
      if (callerRole?.role !== 'super_admin') {
        return new Response(
          JSON.stringify({ error: 'Only Super Admin can assign Super Admin' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        )
      }
      assignedRole = 'super_admin'
    }
    const trimmedEmail = email.trim()
    const trimmedName: string | null = typeof full_name === 'string' && full_name.trim() ? full_name.trim() : null

    // Check if user already exists (pending invite resend case)
    const { data: { users: existingUsers } } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 })
    const existingUser = existingUsers?.find((u) => u.email === trimmedEmail)

    // If a pending user exists (never signed in), delete them first so we can re-invite
    if (existingUser && !existingUser.last_sign_in_at) {
      await supabaseClient.from('user_roles').delete().eq('user_id', existingUser.id)
      await supabaseClient.from('profiles').delete().eq('user_id', existingUser.id)
      await supabaseClient.auth.admin.deleteUser(existingUser.id)
    } else if (existingUser && existingUser.last_sign_in_at) {
      // User already accepted — don't re-invite
      return new Response(
        JSON.stringify({ error: 'This user has already accepted their invite and is active.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // inviteUserByEmail sends the actual email via configured SMTP (Resend)
    const { data: inviteData, error: inviteError } = await supabaseClient.auth.admin.inviteUserByEmail(
      trimmedEmail,
      {
        data: { pending_role: assignedRole },
        redirectTo: 'https://connect.remoasset.in/reset-password?invite=true',
      }
    )

    if (inviteError) {
      console.error('inviteUserByEmail error:', JSON.stringify(inviteError))
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const newUserId = inviteData.user?.id
    if (newUserId) {
      await supabaseClient
        .from('user_roles')
        .update({ role: assignedRole })
        .eq('user_id', newUserId)

      await supabaseClient
        .from('profiles')
        .upsert({ user_id: newUserId, full_name: trimmedName }, { onConflict: 'user_id' })
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invite sent to ${trimmedEmail}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
