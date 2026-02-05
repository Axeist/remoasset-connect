// Supabase Edge Function: create-user
// Only admins can call this. Creates a new user with email/password and assigns role.
import { createClient } from 'supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .maybeSingle();

    if (roleRow?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin only' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { email, password, full_name, role } = body as { email?: string; password?: string; full_name?: string; role?: string };

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'email and password required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newRole = role === 'admin' ? 'admin' : 'employee';

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || '' },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if role row exists, if not insert, otherwise update
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', newUser.user.id)
      .maybeSingle();

    let roleError;
    if (existingRole) {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', newUser.user.id);
      roleError = error;
    } else {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: newUser.user.id, role: newRole });
      roleError = error;
    }

    if (roleError) {
      return new Response(
        JSON.stringify({ error: 'User created but role assignment failed: ' + roleError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Also create profile entry
    await supabase
      .from('profiles')
      .upsert({ 
        user_id: newUser.user.id, 
        full_name: full_name || null 
      }, { 
        onConflict: 'user_id' 
      });

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
