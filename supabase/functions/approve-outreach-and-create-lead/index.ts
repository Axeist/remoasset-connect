/**
 * approve-outreach-and-create-lead
 *
 * Sends an approved (possibly edited) outreach draft via Resend and creates the vendor lead.
 * Used from the Vendor Agent chat when the user approves one or more drafts.
 *
 * Input:
 *   vendor: VendorResult (company_name, contact_email, phone, country, vendor_type, etc.)
 *   prepared_draft: { subject, body_html, body_text }
 *
 * Output:
 *   { success, lead_id?, error?, skip_reason? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callFunction(fnName: string, body: unknown): Promise<any> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${fnName} failed (${res.status}): ${text}`)
  }
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { vendor, prepared_draft } = await req.json()

    if (!vendor?.company_name || !prepared_draft?.subject || !prepared_draft?.body_html || !prepared_draft?.body_text) {
      return new Response(
        JSON.stringify({ success: false, error: 'vendor and prepared_draft (subject, body_html, body_text) are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!vendor.contact_email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Vendor has no contact email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
    )

    const { data: settings } = await supabase
      .from('app_settings')
      .select(`
        vendor_email_from_name, vendor_email_from_address, vendor_email_reply_to, vendor_email_cc,
        agni_agent_user_id, vendor_default_status_id,
        vendor_dedup_enabled, vendor_dedup_window_days,
        slack_notify_vendor_discovered, slack_notify_vendor_email_sent
      `)
      .limit(1)
      .single()

    const emailSettings = {
      from_name: settings?.vendor_email_from_name || 'RemoAsset Procurement',
      from_address: settings?.vendor_email_from_address || 'outreach@remoasset.in',
      reply_to: settings?.vendor_email_reply_to,
      cc: settings?.vendor_email_cc || 'ranjith@remoasset.com',
    }

    const leadSettings = {
      agni_agent_user_id: settings?.agni_agent_user_id,
      default_status_id: settings?.vendor_default_status_id,
      dedup_enabled: settings?.vendor_dedup_enabled ?? true,
      dedup_window_days: settings?.vendor_dedup_window_days ?? 90,
      slack_notify_vendor_discovered: settings?.slack_notify_vendor_discovered ?? true,
      slack_notify_vendor_email_sent: settings?.slack_notify_vendor_email_sent ?? true,
    }

    const emailResult = await callFunction('vendor-outreach-email', {
      vendor,
      settings: emailSettings,
      prepared_draft,
    })

    if (!emailResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: emailResult.error || 'Email send failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const leadResult = await callFunction('create-vendor-lead', {
      vendor,
      email_result: { success: true, message_id: emailResult.message_id, subject: prepared_draft.subject },
      settings: leadSettings,
      token_usage_discovery: null,
      token_usage_email: null,
    })

    if (leadResult.skipped) {
      return new Response(
        JSON.stringify({ success: true, email_sent: true, skipped_lead: true, skip_reason: leadResult.skip_reason }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    return new Response(
      JSON.stringify({ success: true, lead_id: leadResult.lead_id, email_sent: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('approve-outreach-and-create-lead error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
