/**
 * vendor-discovery
 *
 * Uses Serper.dev (Google Search) to find real vendor companies,
 * then passes results to Claude (Haiku) to extract structured data.
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
  contact_email: string | null
  phone: string | null
  country: string
  vendor_type: 'refurbished' | 'new_device' | 'rental' | 'warehouse'
  description: string
  certifications: string[]
  specialties: string[]
  confidence_score: number  // 1–10
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

async function searchSerper(query: string, country: string): Promise<any[]> {
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
      num: 5,
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
  'claude-3-5-haiku-20241022':  { input: 0.80,  output: 4.00  },
  'claude-3-5-sonnet-20241022': { input: 3.00,  output: 15.00 },
  'claude-3-opus-20240229':     { input: 15.00, output: 75.00 },
}

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-3-5-haiku-20241022']
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

  const userPrompt = `Based on these search results, extract up to ${targetCount} real vendor companies. Only include companies you are highly confident are legitimate B2B vendors.

SEARCH RESULTS:
${searchSummary}

Return a JSON array of vendor objects. Each object must have exactly these fields:
{
  "company_name": "string (official company name)",
  "website": "string or null (full URL with https://)",
  "contact_name": "string or null (if found in results)",
  "contact_email": "string or null (if found in results, otherwise null - do NOT make up emails)",
  "phone": "string or null (if found in results)",
  "country": "string (country name)",
  "vendor_type": "${vendorType}",
  "description": "string (1-2 sentences: what they do and why good fit for RemoAsset)",
  "certifications": ["array of known certs like R2, ISO 9001, e-Stewards, ITAD, etc. Only if mentioned in results"],
  "specialties": ["array: device types/brands they specialize in"],
  "confidence_score": number (1-10, how confident you are this is a real, relevant B2B vendor),
  "source_url": "string (the search result URL where this company was found)"
}

CRITICAL RULES:
- NEVER fabricate contact emails or phone numbers. Set them to null if not found in results.
- Only include companies with confidence_score >= 6
- Do not include consumer retailers (Amazon, Best Buy, etc.)
- Return ONLY the JSON array, no other text.`

  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })

  const content = message.content[0]
  if (content.type !== 'text') return []

  const text = content.text.trim()
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) return []

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
    return { vendors: [], token_usage: { model, input_tokens: 0, output_tokens: 0, input_cost_usd: 0, output_cost_usd: 0, total_cost_usd: 0 } }
  }
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
      ai_model = 'claude-3-5-haiku-20241022',
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
    const totalTokenUsage = { input_tokens: 0, output_tokens: 0, input_cost_usd: 0, output_cost_usd: 0, total_cost_usd: 0, model: ai_model, api_calls: 0 }

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
          // Respect Serper rate limit (2 req/sec)
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

    return new Response(
      JSON.stringify({ vendors: deduped, search_queries_used: searchQueriesUsed, token_usage: totalTokenUsage }),
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
