/**
 * vendor-discovery
 *
 * Uses Serper.dev (Google Search) to find real vendor companies,
 * then passes results to Claude (Haiku) to extract structured data.
 * Only vendors with a confirmed contact email are returned.
 * For any vendor missing an email, a second targeted contact-page
 * search is performed before discarding them.
 *
 * Input:
 *   region: string           — e.g. "APAC", "US", "EU"
 *   vendor_types: string[]   — e.g. ["refurbished", "rental"]
 *   count: number            — how many vendors to find
 *   context?: string         — extra instructions from chat
 *   ai_model?: string        — override Claude model
 *   ai_max_tokens?: number
 *   ai_temperature?: number
 *
 * Output:
 *   { vendors: VendorResult[], search_queries_used: string[] }
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface VendorResult {
  company_name: string
  website: string | null
  contact_name: string | null
  contact_email: string        // mandatory — never null in output
  phone: string | null
  country: string
  vendor_type: 'refurbished' | 'new_device' | 'rental' | 'warehouse'
  description: string
  certifications: string[]
  specialties: string[]
  linkedin_url: string | null
  address: string | null
  employee_count: string | null
  founded_year: string | null
  confidence_score: number     // 1–10
  source_url: string | null
}

const REGION_COUNTRIES: Record<string, string[]> = {
  APAC: ['Australia', 'Japan', 'Singapore', 'India', 'South Korea', 'Thailand', 'Malaysia', 'Indonesia', 'Philippines', 'Vietnam', 'Taiwan', 'Hong Kong', 'New Zealand'],
  US: ['United States', 'Canada'],
  EU: ['Germany', 'United Kingdom', 'France', 'Netherlands', 'Sweden', 'Denmark', 'Spain', 'Italy', 'Poland', 'Belgium', 'Austria', 'Switzerland', 'Finland', 'Norway'],
  LATAM: ['Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru'],
  MEA: ['UAE', 'Saudi Arabia', 'South Africa', 'Kenya', 'Egypt', 'Israel', 'Turkey'],
}

const VENDOR_TYPE_QUERIES: Record<string, string[]> = {
  refurbished: [
    'certified refurbished laptop wholesale supplier B2B',
    'IT asset refurbishing company enterprise reseller',
    'refurbished MacBook Dell HP Lenovo bulk supplier',
  ],
  new_device: [
    'IT hardware distributor new devices enterprise B2B',
    'laptop wholesale distributor corporate procurement',
    'Dell HP Lenovo authorized reseller distributor',
  ],
  rental: [
    'laptop rental company corporate IT equipment leasing',
    'device rental B2B IT equipment hire business',
    'computer rental fleet management enterprise',
  ],
  warehouse: [
    'IT asset warehouse storage logistics provider',
    'IT equipment warehousing fulfillment B2B',
    'tech hardware storage distribution center enterprise',
  ],
}

async function searchSerper(query: string, country: string, num = 5): Promise<any[]> {
  const apiKey = Deno.env.get('SERPER_API_KEY')
  if (!apiKey) throw new Error('SERPER_API_KEY not configured')

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: `${query} ${country}`,
      num,
      gl: 'us',
      hl: 'en',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Serper API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.organic || []
}

// Cost per million tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001':  { input: 0.80,  output: 4.00  },
  'claude-3-5-sonnet-20241022': { input: 3.00,  output: 15.00 },
  'claude-3-opus-20240229':     { input: 15.00, output: 75.00 },
}

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-haiku-4-5-20251001']
  return {
    input_cost_usd:  (inputTokens  / 1_000_000) * pricing.input,
    output_cost_usd: (outputTokens / 1_000_000) * pricing.output,
    total_cost_usd:  (inputTokens  / 1_000_000) * pricing.input +
                     (outputTokens / 1_000_000) * pricing.output,
  }
}

async function extractVendorsWithClaude(
  searchResults: Array<{ query: string; country: string; results: any[] }>,
  vendorType: string,
  targetCount: number,
  model: string,
  maxTokens: number,
  temperature: number,
  extraContext?: string,
): Promise<{ vendors: VendorResult[]; token_usage: any }> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })

  const searchSummary = searchResults
    .map((sr) =>
      `Query: "${sr.query}" (${sr.country})\nResults:\n` +
      sr.results
        .map((r: any) => `  - ${r.title}\n    URL: ${r.link}\n    Snippet: ${r.snippet || ''}`)
        .join('\n')
    )
    .join('\n\n')

  const systemPrompt = `You are a vendor research specialist for RemoAsset, a global IT asset lifecycle management platform operating in 35+ countries. RemoAsset helps companies manage device procurement, provisioning, tracking, and recovery for remote workforces.

Your task is to extract real, legitimate B2B vendor companies from search results. Focus on:
- Companies that supply ${vendorType === 'refurbished' ? 'certified refurbished IT devices (laptops, phones, tablets, servers)' : vendorType === 'new_device' ? 'new IT hardware devices for enterprise/B2B procurement' : vendorType === 'rental' ? 'IT device rental and leasing for businesses' : 'IT equipment warehousing, storage, and logistics'}
- B2B-focused businesses (not consumer retail)
- Companies that could partner with RemoAsset for device sourcing${extraContext ? '\n\nAdditional context: ' + extraContext : ''}`

  const userPrompt = `Based on these search results, extract up to ${targetCount} real vendor companies.

SEARCH RESULTS:
${searchSummary}

Return a JSON array of vendor objects. Each object must have exactly these fields:
{
  "company_name": "string (official company name)",
  "website": "string or null (full URL with https://)",
  "contact_name": "string or null (decision maker name if found — Sales Director, Procurement Manager, etc.)",
  "contact_email": "string or null — extract from snippets/URLs if visible. Common patterns: info@, sales@, procurement@, contact@, hello@ plus the domain. If you can confidently infer the domain email format from the website, use it. NEVER fabricate a random email — only use emails actually visible in results or reliably inferable from the company domain.",
  "phone": "string or null — try to extract at least one business phone or mobile number when visible (main line, sales, support). Include country code if shown. Do NOT fabricate numbers.",
  "country": "string (country name)",
  "vendor_type": "${vendorType}",
  "description": "string (2-3 sentences: what they do, their scale, and why they are a good fit for RemoAsset)",
  "certifications": ["array of known certs like R2, ISO 9001, e-Stewards, ITAD, etc. Only if mentioned in results"],
  "specialties": ["array: device types/brands they specialize in"],
  "linkedin_url": "string or null (LinkedIn company page URL if found)",
  "address": "string or null (city/country or full address if found)",
  "employee_count": "string or null (e.g. '50-200', '500+' if mentioned)",
  "founded_year": "string or null (if mentioned)",
  "confidence_score": number (1-10, how confident you are this is a real, relevant B2B vendor),
  "source_url": "string (the search result URL where this company was found)"
}

CRITICAL RULES:
- contact_email is the MOST important field. Make every effort to find or infer it.
  * Check snippet text for any email address
  * If website is known (e.g. acme.com), common B2B contact emails are: sales@acme.com, info@acme.com, procurement@acme.com
  * Only use domain-inferred emails for companies you are CONFIDENT are real businesses
- phone: Try to extract at least one phone/mobile when present in snippets (e.g. "Call us", "Tel:", "Contact:", main number, sales number). Prefer numbers that look like business lines. Never invent digits.
- Only include companies with confidence_score >= 6
- Do not include consumer retailers (Amazon, Best Buy, Flipkart retail, etc.)
- Return ONLY the JSON array, no other text.`

  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })

  const content = message.content[0]
  if (content.type !== 'text') return { vendors: [], token_usage: zeroUsage(model) }

  const text = content.text.trim()
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return { vendors: [], token_usage: zeroUsage(model) }

  try {
    const vendors: VendorResult[] = JSON.parse(jsonMatch[0])
    const cost = calculateCost(model, message.usage.input_tokens, message.usage.output_tokens)
    return {
      vendors: vendors.filter((v) => v.confidence_score >= 6 && v.company_name),
      token_usage: {
        model,
        input_tokens:    message.usage.input_tokens,
        output_tokens:   message.usage.output_tokens,
        ...cost,
      },
    }
  } catch {
    return { vendors: [], token_usage: zeroUsage(model) }
  }
}

/**
 * Second-pass: for vendors still missing an email, search their company
 * name + "contact email" and run a targeted Claude extraction.
 */
async function enrichEmailsWithClaude(
  vendors: VendorResult[],
  model: string,
  maxTokens: number,
): Promise<{ vendors: VendorResult[]; extra_token_usage: any }> {
  const needsEmail = vendors.filter((v) => !v.contact_email)
  if (needsEmail.length === 0) return { vendors, extra_token_usage: zeroUsage(model) }

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })
  const enriched = [...vendors]
  const totalUsage = zeroUsage(model)

  for (const vendor of needsEmail) {
    // Search for contact page
    let contactResults: any[] = []
    try {
      contactResults = await searchSerper(
        `"${vendor.company_name}" contact email B2B sales`,
        vendor.country,
        3,
      )
      await new Promise((r) => setTimeout(r, 550))
    } catch {
      continue
    }

    if (contactResults.length === 0) continue

    const snippet = contactResults
      .map((r: any) => `${r.title} | ${r.snippet || ''} | ${r.link}`)
      .join('\n')

    const message = await anthropic.messages.create({
      model,
      max_tokens: 256,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Extract the business contact email for "${vendor.company_name}" (website: ${vendor.website || 'unknown'}) from these search snippets.

${snippet}

Rules:
- Return ONLY a JSON object: {"email": "found@email.com"} or {"email": null}
- If you see a real email address in the text, return it
- If the website domain is clear and it's a known business, you may infer sales@ or info@ prefix
- NEVER fabricate emails for unknown companies
- Return null if you cannot find or reliably infer an email`,
      }],
    })

    const cost = calculateCost(model, message.usage.input_tokens, message.usage.output_tokens)
    totalUsage.input_tokens    += message.usage.input_tokens
    totalUsage.output_tokens   += message.usage.output_tokens
    totalUsage.input_cost_usd  += cost.input_cost_usd
    totalUsage.output_cost_usd += cost.output_cost_usd
    totalUsage.total_cost_usd  += cost.total_cost_usd

    try {
      const txt = message.content[0].type === 'text' ? message.content[0].text : ''
      const m = txt.match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0])
        if (parsed.email && isValidEmail(parsed.email)) {
          const idx = enriched.findIndex((v) => v.company_name === vendor.company_name)
          if (idx !== -1) enriched[idx] = { ...enriched[idx], contact_email: parsed.email }
        }
      }
    } catch { /* skip */ }
  }

  return { vendors: enriched, extra_token_usage: totalUsage }
}

/**
 * Optional pass: for vendors that have email but no phone, search for contact phone.
 */
async function enrichPhonesWithClaude(
  vendors: VendorResult[],
  model: string,
  maxTokens: number,
): Promise<{ vendors: VendorResult[]; extra_token_usage: any }> {
  const needsPhone = vendors.filter((v) => v.contact_email && !v.phone)
  if (needsPhone.length === 0) return { vendors, extra_token_usage: zeroUsage(model) }

  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '' })
  const enriched = [...vendors]
  const totalUsage = zeroUsage(model)

  for (const vendor of needsPhone) {
    let contactResults: any[] = []
    try {
      contactResults = await searchSerper(
        `"${vendor.company_name}" contact phone number ${vendor.country}`,
        vendor.country,
        3,
      )
      await new Promise((r) => setTimeout(r, 550))
    } catch {
      continue
    }
    if (contactResults.length === 0) continue

    const snippet = contactResults
      .map((r: any) => `${r.title} | ${r.snippet || ''} | ${r.link}`)
      .join('\n')

    const message = await anthropic.messages.create({
      model,
      max_tokens: 180,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Extract one business phone or mobile number for "${vendor.company_name}" from these snippets.\n\n${snippet}\n\nReturn ONLY JSON: {"phone": "+1 234 567 8900"} or {"phone": null}. Use digits only or E.164; never fabricate.`,
      }],
    })

    const cost = calculateCost(model, message.usage.input_tokens, message.usage.output_tokens)
    totalUsage.input_tokens += message.usage.input_tokens
    totalUsage.output_tokens += message.usage.output_tokens
    totalUsage.input_cost_usd += cost.input_cost_usd
    totalUsage.output_cost_usd += cost.output_cost_usd
    totalUsage.total_cost_usd += cost.total_cost_usd

    try {
      const txt = message.content[0].type === 'text' ? message.content[0].text : ''
      const m = txt.match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0])
        if (parsed.phone && /[\d+\s\-()]{7,}/.test(String(parsed.phone))) {
          const idx = enriched.findIndex((v) => v.company_name === vendor.company_name)
          if (idx !== -1) enriched[idx] = { ...enriched[idx], phone: String(parsed.phone).trim() }
        }
      }
    } catch { /* skip */ }
  }

  return { vendors: enriched, extra_token_usage: totalUsage }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function zeroUsage(model: string) {
  return { model, input_tokens: 0, output_tokens: 0, input_cost_usd: 0, output_cost_usd: 0, total_cost_usd: 0 }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      region,
      vendor_types,
      count = 10,
      context,
      ai_model = 'claude-haiku-4-5-20251001',
      ai_max_tokens = 4096,
      ai_temperature = 0.7,
    } = await req.json()

    if (!region || !vendor_types || !Array.isArray(vendor_types) || vendor_types.length === 0) {
      return new Response(
        JSON.stringify({ error: 'region and vendor_types[] are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const countries = REGION_COUNTRIES[region] || [region]
    const allVendors: VendorResult[] = []
    const searchQueriesUsed: string[] = []
    const countPerType = Math.ceil(count / vendor_types.length)
    const totalTokenUsage = { ...zeroUsage(ai_model), api_calls: 0 }

    for (const vendorType of vendor_types) {
      const queries = VENDOR_TYPE_QUERIES[vendorType] || [`${vendorType} supplier B2B enterprise`]
      const searchResults: Array<{ query: string; country: string; results: any[] }> = []

      // Pick 2 representative countries per region for search diversity
      const sampleCountries = countries.slice(0, 2)

      for (const country of sampleCountries) {
        for (const query of queries.slice(0, 2)) {
          const fullQuery = `${query} ${country}`
          searchQueriesUsed.push(fullQuery)
          try {
            const results = await searchSerper(query, country)
            searchResults.push({ query, country, results })
          } catch (err) {
            console.error(`Search failed for "${fullQuery}":`, err)
          }
          // Respect Serper rate limit
          await new Promise((r) => setTimeout(r, 550))
        }
      }

      if (searchResults.length > 0) {
        const { vendors, token_usage } = await extractVendorsWithClaude(
          searchResults,
          vendorType,
          countPerType,
          ai_model,
          ai_max_tokens,
          ai_temperature,
          context,
        )
        allVendors.push(...vendors)
        totalTokenUsage.input_tokens    += token_usage.input_tokens
        totalTokenUsage.output_tokens   += token_usage.output_tokens
        totalTokenUsage.input_cost_usd  += token_usage.input_cost_usd
        totalTokenUsage.output_cost_usd += token_usage.output_cost_usd
        totalTokenUsage.total_cost_usd  += token_usage.total_cost_usd
        totalTokenUsage.api_calls       += 1
      }
    }

    // Deduplicate by company name within this batch
    const seen = new Set<string>()
    const deduped = allVendors.filter((v) => {
      const key = v.company_name.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    // Second pass: enrich any vendors still missing email via targeted search
    const { vendors: enrichedVendors, extra_token_usage } = await enrichEmailsWithClaude(
      deduped,
      ai_model,
      512,
    )
    totalTokenUsage.input_tokens    += extra_token_usage.input_tokens
    totalTokenUsage.output_tokens   += extra_token_usage.output_tokens
    totalTokenUsage.input_cost_usd  += extra_token_usage.input_cost_usd
    totalTokenUsage.output_cost_usd += extra_token_usage.output_cost_usd
    totalTokenUsage.total_cost_usd  += extra_token_usage.total_cost_usd

    // Third pass: try to get at least one phone for vendors that have email but no phone
    const { vendors: withPhones, extra_token_usage: phoneUsage } = await enrichPhonesWithClaude(
      enrichedVendors,
      ai_model,
      256,
    )
    totalTokenUsage.input_tokens    += phoneUsage.input_tokens
    totalTokenUsage.output_tokens   += phoneUsage.output_tokens
    totalTokenUsage.input_cost_usd  += phoneUsage.input_cost_usd
    totalTokenUsage.output_cost_usd += phoneUsage.output_cost_usd
    totalTokenUsage.total_cost_usd  += phoneUsage.total_cost_usd

    // Final filter: only include vendors with a valid email
    const withEmail = withPhones.filter((v) => v.contact_email && isValidEmail(v.contact_email))
    const withoutEmail = withPhones.filter((v) => !v.contact_email || !isValidEmail(v.contact_email))

    console.log(`vendor-discovery: ${withEmail.length} vendors with email, ${withoutEmail.length} discarded (no email found)`)

    return new Response(
      JSON.stringify({
        vendors: withEmail,
        discarded_no_email: withoutEmail.length,
        search_queries_used: searchQueriesUsed,
        token_usage: totalTokenUsage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (err) {
    console.error('vendor-discovery error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
