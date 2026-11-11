import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

function inviteHtml(opts: { name: string | null; link: string; inviter: string }) {
  const hello = opts.name ? `Hi ${esc(opts.name)},` : 'Hi,'
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f1ee;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#2a2225">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #eadfd8">
<tr><td style="background:#1d1618;padding:24px 28px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:12px"><img src="https://connect.remoasset.in/brand-mark.png" width="38" height="38" alt="" style="display:block"></td>
<td><div style="font-size:22px;font-weight:700;color:#ffffff;line-height:1">Connect</div><div style="font-size:12px;color:#b9aeb1;margin-top:4px">by <b style="color:#e8e0e2">Remoasset</b></div></td>
</tr></table></td></tr>
<tr><td style="padding:32px 28px 8px">
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25">You're invited to join Connect</h1>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#4a4044">${hello}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4a4044"><b>${esc(opts.inviter)}</b> invited you to RemoAsset's workspace for leads, pipeline, RFQs and follow-ups. Set a password to get started.</p>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#ea6e35;border-radius:12px">
<a href="${opts.link}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">Accept invitation</a>
</td></tr></table>
<p style="margin:24px 0 6px;font-size:13px;line-height:1.5;color:#7a6e71">Button not working? Copy this link into your browser:</p>
<p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;color:#7a6e71"><a href="${opts.link}" style="color:#b4491a">${opts.link}</a></p>
</td></tr>
<tr><td style="padding:16px 28px 28px;border-top:1px solid #f0e7e1;font-size:12px;line-height:1.5;color:#9a8f92">This invitation is personal and can be used once. If you weren't expecting it, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`
}

async function sendInviteEmail(opts: { to: string; name: string | null; link: string; inviter: string; replyTo?: string }): Promise<string> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY not configured')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Connect by RemoAsset <invites@remoasset.in>',
      to: [opts.to],
      reply_to: opts.replyTo,
      subject: "You're invited to Connect by RemoAsset",
      html: inviteHtml({ name: opts.name, link: opts.link, inviter: opts.inviter }),
      text: `${opts.inviter} invited you to Connect by RemoAsset. Accept your invitation: ${opts.link}`,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { message?: string })?.message || `Email service error ${res.status}`)
  return (json as { id?: string }).id ?? ''
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

    const lowerEmail = trimmedEmail.toLowerCase()
    const APP_URL = 'https://connect.remoasset.in'

    // Look up an existing account by email (single indexed query; falls back to the admin list if the helper is missing)
    let existing: { id: string; last_sign_in_at: string | null } | null = null
    const lookup = await supabaseClient.rpc('auth_user_lookup', { _email: lowerEmail })
    if (!lookup.error) {
      existing = (lookup.data as { id: string; last_sign_in_at: string | null }[] | null)?.[0] ?? null
    } else {
      const { data: { users: existingUsers } } = await supabaseClient.auth.admin.listUsers({ perPage: 1000 })
      const hit = existingUsers?.find((u) => u.email?.toLowerCase() === lowerEmail)
      existing = hit ? { id: hit.id, last_sign_in_at: hit.last_sign_in_at ?? null } : null
    }

    if (existing?.last_sign_in_at) {
      return new Response(
        JSON.stringify({ error: 'This user has already accepted their invite and is active.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    if (existing) {
      // Pending (never signed in): replace the old invite
      await Promise.all([
        supabaseClient.from('user_roles').delete().eq('user_id', existing.id),
        supabaseClient.from('profiles').delete().eq('user_id', existing.id),
      ])
      await supabaseClient.auth.admin.deleteUser(existing.id)
    }

    // Invite-only: the email must be on the allow-list before the account exists.
    await supabaseClient.from('invited_emails').upsert({ email: lowerEmail, invited_by: user.id }, { onConflict: 'email' })

    // Create the invited account and get a one-time token. We send the email ourselves (fast, branded, and not
    // subject to the auth mailer's rate limits), and the link only uses the token when the person acts on it,
    // so mail scanners that pre-open links cannot use it up.
    const { data: linkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
      type: 'invite',
      email: trimmedEmail,
      options: {
        data: { pending_role: assignedRole, ...(trimmedName ? { full_name: trimmedName } : {}) },
        redirectTo: `${APP_URL}/reset-password?invite=true`,
      },
    })
    if (linkError || !linkData?.user) {
      console.error('generateLink error:', JSON.stringify(linkError))
      return new Response(
        JSON.stringify({ error: linkError?.message || 'Could not create the invitation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    const tokenHash = linkData.properties?.hashed_token
    const inviteUrl = `${APP_URL}/reset-password?invite=true&token_hash=${encodeURIComponent(tokenHash ?? '')}&type=invite`
    const newUserId = linkData.user.id

    const inviterName = (user.user_metadata?.full_name as string | undefined) || user.email || 'Your administrator'
    const [, , emailResult] = await Promise.all([
      supabaseClient.from('user_roles').update({ role: assignedRole }).eq('user_id', newUserId),
      supabaseClient.from('profiles').upsert({ user_id: newUserId, full_name: trimmedName }, { onConflict: 'user_id' }),
      sendInviteEmail({ to: trimmedEmail, name: trimmedName, link: inviteUrl, inviter: inviterName, replyTo: user.email ?? undefined })
        .then((id) => ({ ok: true as const, id }))
        .catch((e: Error) => ({ ok: false as const, error: e.message })),
    ])

    if (!emailResult.ok) {
      console.error('invite email failed:', emailResult.error)
      return new Response(
        JSON.stringify({
          success: true,
          email_sent: false,
          message: `Account created for ${trimmedEmail}, but the email could not be sent (${emailResult.error}). Share the invite link below instead.`,
          invite_link: inviteUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, email_sent: true, message: `Invite sent to ${trimmedEmail}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
