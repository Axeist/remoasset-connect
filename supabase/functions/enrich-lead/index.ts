/**
 * enrich-lead
 *
 * Uses AI (Claude) to enrich a lead's profile based on the company name and website.
 * Attempts to discover: LinkedIn URL, company description, industry, headcount range,
 * and primary location if not already present.
 *
 * Called by: LeadDetail page ("Enrich" button)
 * Method: POST { lead_id, company_name, website }
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnrichResult {
  description?: string | null
  industry?: string | null
  headcount?: string | null
  updated: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
    )

    const body = await req.json().catch(() => ({}))
    const { lead_id, company_name, website } = body as {
      lead_id?: string
      company_name?: string
      website?: string
    }

    if (!lead_id || !company_name) {
      return new Response(
        JSON.stringify({ error: 'lead_id and company_name are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Fetch existing lead to avoid overwriting already-populated fields
    const { data: existing, error: fetchErr } = await supabase
      .from('leads')
      .select('notes')
      .eq('id', lead_id)
      .single()

    if (fetchErr) {
      return new Response(
        JSON.stringify({ error: fetchErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Check AI settings
    const { data: settings } = await supabase
      .from('app_settings')
      .select('ai_enabled, ai_model, ai_max_tokens')
      .limit(1)
      .single()

    if (!settings?.ai_enabled) {
      return new Response(
        JSON.stringify({ error: 'AI is disabled in settings. Enable it in Admin → Integrations → AI Settings.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const anthropic = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    })

    const prompt = `You are a B2B research assistant. Given the company name and website below, provide enrichment data.

Company: ${company_name}
Website: ${website ?? 'Not provided'}

Return a JSON object with ONLY these fields (omit any you are not confident about):
{
  "linkedin_url": "https://linkedin.com/company/...",
  "description": "One or two sentence company description",
  "industry": "e.g. IT Hardware, Electronics Retail, etc.",
  "headcount": "e.g. 50-200 employees"
}

Rules:
- Only include a linkedin_url if you are highly confident it is correct
- Keep description concise and factual
- For headcount, use ranges (10-50, 50-200, 200-1000, 1000+)
- Return ONLY valid JSON, no markdown, no explanation`

    const response = await anthropic.messages.create({
      model: settings.ai_model ?? 'claude-3-haiku-20240307',
      max_tokens: Math.min(settings.ai_max_tokens ?? 512, 512),
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    let enriched: EnrichResult = { updated: [] }
    try {
      const parsed = JSON.parse(rawText.replace(/^```json\n?|\n?```$/g, '').trim())
      const extras: string[] = []
      if (parsed.linkedin_url) extras.push(`LinkedIn: ${parsed.linkedin_url}`)
      if (parsed.description) extras.push(`Description: ${parsed.description}`)
      if (parsed.industry) extras.push(`Industry: ${parsed.industry}`)
      if (parsed.headcount) extras.push(`Headcount: ${parsed.headcount}`)
      if (extras.length > 0) {
        const enrichNote = `[AI Enrichment]\n${extras.join('\n')}`
        enriched.description = enrichNote
        enriched.updated = extras.map((e) => e.split(':')[0].trim())
      }
    } catch {
      return new Response(
        JSON.stringify({ error: 'AI returned unparseable data. Try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    if (enriched.updated.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No new data found to enrich. The lead may already be up to date.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Build the update payload — append to existing notes
    const updatePayload: Record<string, unknown> = {}
    if (enriched.description) {
      const existingNotes = (existing as any).notes ?? ''
      const separator = existingNotes ? '\n\n' : ''
      updatePayload.notes = `${existingNotes}${separator}${enriched.description}`
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateErr } = await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', lead_id)

      if (updateErr) {
        return new Response(
          JSON.stringify({ error: updateErr.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        )
      }

      // Log activity
      const authHeader = req.headers.get('Authorization') ?? ''
      const token = authHeader.replace('Bearer ', '').trim()
      let userId: string | null = null
      if (token) {
        const { data: { user } } = await supabase.auth.getUser(token)
        userId = user?.id ?? null
      }

      if (userId) {
        await supabase.from('lead_activities').insert({
          lead_id,
          user_id: userId,
          activity_type: 'note',
          description: enriched.description ?? `AI enrichment: updated ${enriched.updated.join(', ')}`,
        })
      }
    }

    return new Response(
      JSON.stringify({
        message: `Enriched: ${enriched.updated.join(', ')}`,
        updated: enriched.updated,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
