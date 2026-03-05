/**
 * create-vendor-lead
 *
 * Creates a lead in Supabase for a discovered vendor, logs the activity,
 * handles deduplication, and fires Slack notifications.
 *
 * Input:
 *   vendor: VendorResult
 *   email_result: { success, message_id?, subject?, body_preview?, skipped?, reason?, error? }
 *   settings: {
 *     agni_agent_user_id, default_status_id,
 *     dedup_enabled, dedup_window_days,
 *     slack_notify_vendor_discovered, slack_notify_vendor_email_sent
 *   }
 *
 * Output:
 *   { lead_id, skipped, skip_reason? }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function initSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
  )
}

async function resolveCountryId(supabase: any, countryName: string): Promise<string | null> {
  if (!countryName) return null

  const { data } = await supabase
    .from('countries')
    .select('id, name')
    .ilike('name', `%${countryName}%`)
    .limit(1)
    .single()

  return data?.id || null
}

async function isDuplicate(
  supabase: any,
  companyName: string,
  email: string | null,
  windowDays: number,
): Promise<boolean> {
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - windowDays)

  // Check by company name
  const { data: nameMatch } = await supabase
    .from('vendor_discovery_log')
    .select('id')
    .ilike('company_name', companyName)
    .gte('created_at', windowStart.toISOString())
    .limit(1)

  if (nameMatch && nameMatch.length > 0) return true

  // Check by email
  if (email) {
    const { data: emailMatch } = await supabase
      .from('vendor_discovery_log')
      .select('id')
      .ilike('email', email)
      .gte('created_at', windowStart.toISOString())
      .limit(1)

    if (emailMatch && emailMatch.length > 0) return true
  }

  // Also check existing leads table
  const { data: leadMatch } = await supabase
    .from('leads')
    .select('id')
    .ilike('company_name', companyName)
    .limit(1)

  if (leadMatch && leadMatch.length > 0) return true

  return false
}

async function fireSlackNotify(supabaseUrl: string, serviceRoleKey: string, event: string, payload: any) {
  try {
    await fetch(`${supabaseUrl}/functions/v1/slack-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ event, payload }),
    })
  } catch {
    // Non-critical — don't fail if Slack is down
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { vendor, email_result, settings, token_usage_discovery, token_usage_email, region, vendor_type, job_id } = await req.json()

    if (!vendor || !vendor.company_name) {
      return new Response(
        JSON.stringify({ error: 'vendor object with company_name is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const {
      agni_agent_user_id,
      default_status_id,
      dedup_enabled = true,
      dedup_window_days = 90,
      slack_notify_vendor_discovered = true,
      slack_notify_vendor_email_sent = true,
    } = settings || {}

    const supabase = initSupabase()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    // Deduplication check
    if (dedup_enabled) {
      const dup = await isDuplicate(
        supabase,
        vendor.company_name,
        vendor.contact_email,
        dedup_window_days,
      )
      if (dup) {
        // Log as skipped
        await supabase.from('vendor_discovery_log').insert({
          company_name: vendor.company_name,
          website: vendor.website,
          email: vendor.contact_email,
          region: vendor.region || null,
          vendor_type: vendor.vendor_type,
          skipped_dedup: true,
          email_sent: false,
        })
        return new Response(
          JSON.stringify({ skipped: true, skip_reason: 'duplicate within dedup window' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }
    }

    // Resolve country
    const countryId = await resolveCountryId(supabase, vendor.country)

    // Get default status if not provided
    let statusId = default_status_id
    if (!statusId) {
      const { data: firstStatus } = await supabase
        .from('lead_statuses')
        .select('id')
        .order('sort_order', { ascending: true })
        .limit(1)
        .single()
      statusId = firstStatus?.id || null
    }

    // Create the lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        company_name: vendor.company_name,
        website: vendor.website || null,
        email: vendor.contact_email || null,
        phone: vendor.phone || null,
        contact_name: vendor.contact_name || null,
        country_id: countryId,
        status_id: statusId,
        owner_id: agni_agent_user_id || null,
        vendor_types: [vendor.vendor_type],
        notes: [
          `AI-discovered vendor via RemoAsset Vendor Agent.`,
          vendor.description ? `Description: ${vendor.description}` : '',
          vendor.certifications?.length ? `Certifications: ${vendor.certifications.join(', ')}` : '',
          vendor.specialties?.length ? `Specialties: ${vendor.specialties.join(', ')}` : '',
          vendor.source_url ? `Source: ${vendor.source_url}` : '',
        ].filter(Boolean).join('\n'),
        lead_score: 0,
      })
      .select('id, company_name, lead_score')
      .single()

    if (leadError || !lead) {
      throw new Error(`Failed to create lead: ${leadError?.message}`)
    }

    // Build activity description
    const emailStatus = email_result?.success
      ? `Outreach email sent to ${vendor.contact_email}.`
      : email_result?.skipped
      ? `No contact email available — email not sent.`
      : `Email send failed: ${email_result?.error || 'unknown error'}`

    const activityDescription = [
      `🤖 AI-discovered vendor (${vendor.vendor_type.replace('_', ' ')}) via Vendor Agent.`,
      `Region: ${vendor.region || vendor.country}`,
      emailStatus,
      email_result?.subject ? `Subject: "${email_result.subject}"` : '',
    ].filter(Boolean).join('\n')

    const attachments: any[] = []
    if (vendor.source_url) {
      attachments.push({ type: 'url', url: vendor.source_url, name: 'Source' })
    }
    if (vendor.website) {
      attachments.push({ type: 'url', url: vendor.website, name: 'Company Website' })
    }

    // Log activity
    const { error: activityError } = await supabase
      .from('lead_activities')
      .insert({
        lead_id: lead.id,
        user_id: agni_agent_user_id || null,
        activity_type: email_result?.success ? 'email' : 'note',
        description: activityDescription,
        attachments: attachments.length > 0 ? attachments : null,
      })

    if (activityError) {
      console.error('Activity log error:', activityError.message)
    }

    // Log to vendor_discovery_log
    await supabase.from('vendor_discovery_log').insert({
      company_name: vendor.company_name,
      website: vendor.website,
      email: vendor.contact_email,
      region: vendor.region || null,
      vendor_type: vendor.vendor_type,
      lead_id: lead.id,
      email_sent: email_result?.success === true,
      skipped_dedup: false,
    })

    // Log token usage to ai_token_usage
    const usageRows = []
    if (token_usage_discovery?.input_tokens) {
      usageRows.push({
        fn_name:         'vendor-discovery',
        model:           token_usage_discovery.model || settings?.ai_model || 'claude-3-5-haiku-20241022',
        input_tokens:    token_usage_discovery.input_tokens,
        output_tokens:   token_usage_discovery.output_tokens,
        input_cost_usd:  token_usage_discovery.input_cost_usd  || 0,
        output_cost_usd: token_usage_discovery.output_cost_usd || 0,
        triggered_by:    settings?.triggered_by || 'cron',
        region:          vendor.region || null,
        vendor_type:     vendor.vendor_type || null,
        job_id:          job_id || null,
      })
    }
    if (token_usage_email?.input_tokens && email_result?.success) {
      usageRows.push({
        fn_name:         'vendor-outreach-email',
        model:           token_usage_email.model || settings?.ai_model || 'claude-3-5-haiku-20241022',
        input_tokens:    token_usage_email.input_tokens,
        output_tokens:   token_usage_email.output_tokens,
        input_cost_usd:  token_usage_email.input_cost_usd  || 0,
        output_cost_usd: token_usage_email.output_cost_usd || 0,
        triggered_by:    settings?.triggered_by || 'cron',
        region:          vendor.region || null,
        vendor_type:     vendor.vendor_type || null,
        job_id:          job_id || null,
      })
    }
    if (usageRows.length > 0) {
      await supabase.from('ai_token_usage').insert(usageRows)
    }

    // Slack: lead created
    if (slack_notify_vendor_discovered) {
      await fireSlackNotify(supabaseUrl, serviceRoleKey, 'lead_created', {
        company_name: lead.company_name,
        contact_name: vendor.contact_name || null,
        status: 'New',
        owner: 'Agni (AI Agent)',
        country: vendor.country || null,
        lead_score: 0,
        lead_id: lead.id,
      })
    }

    // Slack: activity logged
    if (slack_notify_vendor_email_sent && email_result?.success) {
      await fireSlackNotify(supabaseUrl, serviceRoleKey, 'activity_logged', {
        company_name: lead.company_name,
        activity_type: 'email',
        description: activityDescription,
        logged_by: 'Agni (AI Agent)',
        lead_id: lead.id,
      })
    }

    return new Response(
      JSON.stringify({ lead_id: lead.id, skipped: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('create-vendor-lead error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
