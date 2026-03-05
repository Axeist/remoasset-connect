/**
 * vendor-discovery-cron
 *
 * Daily orchestrator triggered by GitHub Actions.
 * Reads settings from app_settings, loops through enabled regions,
 * discovers vendors, creates leads, and sends outreach emails.
 * Processes vendors in small batches to stay within edge fn timeout.
 *
 * Called by: GitHub Actions (.github/workflows/vendor-discovery-cron.yml)
 * Method: POST (no body required)
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

async function callFunction(fnName: string, body: any): Promise<any> {
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

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = initSupabase()
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // Create a job record
  const { data: job, error: jobError } = await supabase
    .from('vendor_discovery_jobs')
    .insert({
      status: 'running',
      triggered_by: 'cron',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (jobError || !job) {
    console.error('Failed to create job record:', jobError)
  }

  const jobId = job?.id

  try {
    // Load settings
    const { data: settings, error: settingsError } = await supabase
      .from('app_settings')
      .select(`
        ai_enabled, ai_model, ai_max_tokens, ai_temperature,
        vendor_cron_enabled, vendor_cron_regions, vendor_cron_types,
        vendor_email_enabled, vendor_email_from_name, vendor_email_from_address,
        vendor_email_reply_to, vendor_email_subject_template, vendor_email_tone,
        agni_agent_user_id, vendor_default_status_id,
        vendor_dedup_enabled, vendor_dedup_window_days,
        slack_notify_vendor_discovered, slack_notify_vendor_email_sent,
        slack_notify_cron_summary
      `)
      .limit(1)
      .single()

    if (settingsError || !settings) {
      throw new Error('Failed to load app_settings')
    }

    if (!settings.ai_enabled) {
      await supabase.from('vendor_discovery_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: 'AI disabled in settings',
      }).eq('id', jobId)
      return new Response(
        JSON.stringify({ ok: false, reason: 'AI disabled in settings' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (!settings.vendor_cron_enabled) {
      await supabase.from('vendor_discovery_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: 'Vendor cron disabled in settings',
      }).eq('id', jobId)
      return new Response(
        JSON.stringify({ ok: false, reason: 'Vendor cron disabled in settings' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const regions: Array<{ region: string; enabled: boolean; count: number }> =
      settings.vendor_cron_regions || []
    const vendorTypes: Array<{ type: string; enabled: boolean }> =
      settings.vendor_cron_types || []

    const enabledRegions = regions.filter((r) => r.enabled)
    const enabledTypes = vendorTypes.filter((t) => t.enabled).map((t) => t.type)

    if (enabledRegions.length === 0 || enabledTypes.length === 0) {
      await supabase.from('vendor_discovery_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        error_message: 'No enabled regions or vendor types',
      }).eq('id', jobId)
      return new Response(
        JSON.stringify({ ok: false, reason: 'No enabled regions or vendor types' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const emailSettings = {
      from_name: settings.vendor_email_from_name,
      from_address: settings.vendor_email_from_address,
      reply_to: settings.vendor_email_reply_to,
      cc: settings.vendor_email_cc || 'ranjith@remoasset.com',
      subject_template: settings.vendor_email_subject_template,
      tone: settings.vendor_email_tone,
      ai_model: settings.ai_model,
      ai_max_tokens: settings.ai_max_tokens,
      ai_temperature: settings.ai_temperature,
    }

    const leadSettings = {
      agni_agent_user_id: settings.agni_agent_user_id,
      default_status_id: settings.vendor_default_status_id,
      dedup_enabled: settings.vendor_dedup_enabled,
      dedup_window_days: settings.vendor_dedup_window_days,
      slack_notify_vendor_discovered: settings.slack_notify_vendor_discovered,
      slack_notify_vendor_email_sent: settings.slack_notify_vendor_email_sent,
    }

    let totalCreated = 0
    let totalSkipped = 0
    let totalEmailed = 0
    const regionSummary: string[] = []

    for (const regionConfig of enabledRegions) {
      let regionCreated = 0
      let regionSkipped = 0

      try {
        // Discover vendors for this region
        const discoveryResult = await callFunction('vendor-discovery', {
          region: regionConfig.region,
          vendor_types: enabledTypes,
          count: regionConfig.count,
          ai_model: settings.ai_model,
          ai_max_tokens: settings.ai_max_tokens,
          ai_temperature: settings.ai_temperature,
        })

        const vendors: any[] = discoveryResult.vendors || []

        // Process each vendor
        for (const vendor of vendors) {
          vendor.region = regionConfig.region

          let emailResult: any = { success: false, skipped: true, reason: 'Email sending disabled' }

          // Send outreach email if enabled and email available
          if (settings.vendor_email_enabled && vendor.contact_email) {
            try {
              emailResult = await callFunction('vendor-outreach-email', {
                vendor,
                settings: emailSettings,
              })
            } catch (emailErr) {
              emailResult = { success: false, error: String(emailErr) }
            }
            // Throttle Resend (max 2 req/sec)
            await sleep(600)
          }

          // Create lead
          try {
            const leadResult = await callFunction('create-vendor-lead', {
              vendor,
              email_result: emailResult,
              settings: leadSettings,
              token_usage_discovery: discoveryResult.token_usage || null,
              token_usage_email: emailResult?.token_usage || null,
              job_id: jobId,
            })

            if (leadResult.skipped) {
              regionSkipped++
              totalSkipped++
            } else {
              regionCreated++
              totalCreated++
              if (emailResult?.success) totalEmailed++
            }
          } catch (leadErr) {
            console.error(`Failed to create lead for ${vendor.company_name}:`, leadErr)
          }

          // Small delay between vendors to avoid overwhelming the DB
          await sleep(200)
        }
      } catch (regionErr) {
        console.error(`Failed to process region ${regionConfig.region}:`, regionErr)
      }

      regionSummary.push(`${regionConfig.region}: ${regionCreated} created, ${regionSkipped} skipped`)
    }

    // Update job record
    await supabase.from('vendor_discovery_jobs').update({
      status: 'completed',
      total_created: totalCreated,
      total_skipped: totalSkipped,
      total_emailed: totalEmailed,
      completed_at: new Date().toISOString(),
    }).eq('id', jobId)

    // Update last run time in settings
    await supabase.from('app_settings').update({
      vendor_cron_last_run: new Date().toISOString(),
      vendor_cron_last_run_count: totalCreated,
    })

    // Slack summary
    if (settings.slack_notify_cron_summary) {
      const summaryText = [
        `🤖 *Vendor Agent Daily Run Complete*`,
        `✅ ${totalCreated} leads created | 📧 ${totalEmailed} emails sent | ⏭️ ${totalSkipped} skipped (dedup)`,
        regionSummary.join(' • '),
      ].join('\n')

      try {
        const { data: slackSettings } = await supabase
          .from('app_settings')
          .select('slack_enabled, slack_webhook_url')
          .limit(1)
          .single()

        if (slackSettings?.slack_enabled && slackSettings?.slack_webhook_url) {
          await fetch(slackSettings.slack_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              blocks: [{
                type: 'section',
                text: { type: 'mrkdwn', text: summaryText },
              }, { type: 'divider' }],
            }),
          })
        }
      } catch {
        // Non-critical
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        total_created: totalCreated,
        total_skipped: totalSkipped,
        total_emailed: totalEmailed,
        region_summary: regionSummary,
        job_id: jobId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('vendor-discovery-cron error:', err)

    if (jobId) {
      await supabase.from('vendor_discovery_jobs').update({
        status: 'failed',
        error_message: String(err),
        completed_at: new Date().toISOString(),
      }).eq('id', jobId)
    }

    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
