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
        detectSessionInUrl: false
      }
    }
  )

  try {
    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization')!
    
    // Get the user from the auth header
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Check if caller is admin
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

    // Parse request body
    const { email, password, full_name, role } = await req.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create new user with admin privileges
    const { data: newUserData, error: createError } = await supabaseClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name || ''
      }
    })

    if (createError || !newUserData.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || 'Failed to create user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const newUserId = newUserData.user.id
    const userRole = role === 'admin' ? 'admin' : 'employee'

    // Insert or update user role
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .upsert(
        { user_id: newUserId, role: userRole },
        { onConflict: 'user_id' }
      )

    if (roleError) {
      return new Response(
        JSON.stringify({ error: 'User created but role assignment failed: ' + roleError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Create profile
    await supabaseClient
      .from('profiles')
      .upsert(
        { user_id: newUserId, full_name: full_name || null },
        { onConflict: 'user_id' }
      )

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
