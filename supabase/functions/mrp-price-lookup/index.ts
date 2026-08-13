/**
 * mrp-price-lookup
 *
 * Uses Serper Shopping + Search (localized by country) then Claude to
 * match listings to the requested device specs and return a public
 * price range with source-site links.
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
}

const CURRENCY_BY_GL: Record<string, string> = {
  in: 'INR', us: 'USD', gb: 'GBP', ae: 'AED', sg: 'SGD', au: 'AUD', ca: 'CAD',
  de: 'EUR', fr: 'EUR', nl: 'EUR', jp: 'JPY', kr: 'KRW', ph: 'PHP', my: 'MYR',
  id: 'IDR', th: 'THB', vn: 'VND', br: 'BRL', mx: 'MXN', za: 'ZAR', sa: 'SAR',
}

type PriceType = 'mrp' | 'msrp' | 'list' | 'street' | 'unknown'

interface PriceHit {
  retailer: string
  title: string
  url: string
  currency: string
  price: number
  price_type: PriceType
  notes?: string
}

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL]
  return {
    input_cost_usd: (inputTokens / 1_000_000) * pricing.input,
    output_cost_usd: (outputTokens / 1_000_000) * pricing.output,
    total_cost_usd: (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output,
  }
}

function parseMoney(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/[^\d.,]/g, '').trim()
  if (!cleaned) return null
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    if (lastComma > lastDot) {
      const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
      return Number.isFinite(n) && n > 0 ? n : null
    }
    const n = parseFloat(cleaned.replace(/,/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',')
    const last = parts[parts.length - 1]
    if (last.length === 2 && parts.length === 2) {
      const n = parseFloat(cleaned.replace(',', '.'))
      return Number.isFinite(n) && n > 0 ? n : null
    }
    const n = parseFloat(cleaned.replace(/,/g, ''))
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const n = parseFloat(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

function detectCurrency(text: string, fallback: string): string {
  if (/₹|INR|Rs\.?/i.test(text)) return 'INR'
  if (/\$|USD/.test(text) && !/A\$|C\$|S\$/.test(text)) return 'USD'
  if (/£|GBP/.test(text)) return 'GBP'
  if (/€|EUR/.test(text)) return 'EUR'
  if (/AED|د\.إ/.test(text)) return 'AED'
  if (/S\$|SGD/.test(text)) return 'SGD'
  if (/A\$|AUD/.test(text)) return 'AUD'
  if (/C\$|CAD/.test(text)) return 'CAD'
  if (/¥|JPY/.test(text)) return 'JPY'
  return fallback
}

function buildQuery(brand: string, model: string, specs: Record<string, string>): string {
  const parts = [brand, model]
  for (const key of ['processor', 'display_size', 'ram', 'storage', 'gpu', 'os', 'spec_description']) {
    const v = specs[key]?.trim()
    if (v) parts.push(v)
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function listPriceQuery(base: string, countryCode: string): string {
  if (countryCode === 'in') return `${base} MRP OR "maximum retail price" OR "list price"`
  return `${base} MSRP OR "list price" OR MRP`
}

async function serperPost(path: 'shopping' | 'search', body: Record<string, unknown>): Promise<any> {
  const apiKey = Deno.env.get('SERPER_API_KEY')
  if (!apiKey) throw new Error('SERPER_API_KEY not configured')
  const res = await fetch(`https://google.serper.dev/${path}`, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Serper ${path} error ${res.status}: ${text}`)
  }
  return res.json()
}

function shoppingToHits(items: any[], fallbackCurrency: string): PriceHit[] {
  const hits: PriceHit[] = []
  for (const item of items || []) {
    const price = parseMoney(item.price)
    if (price == null) continue
    const title = String(item.title || '').trim()
    const url = String(item.link || item.url || '').trim()
    if (!title || !url) continue
    hits.push({
      retailer: String(item.source || item.merchant || 'Retailer').trim() || 'Retailer',
      title,
      url,
      currency: detectCurrency(String(item.price || ''), fallbackCurrency),
      price,
      price_type: 'street',
      notes: item.delivery ? String(item.delivery) : undefined,
    })
  }
  return hits
}

function organicHints(items: any[]): string {
  return (items || [])
    .slice(0, 12)
    .map((r: any) => `- ${r.title}\n  URL: ${r.link}\n  Snippet: ${r.snippet || ''}`)
    .join('\n')
}

async function refineWithClaude(opts: {
  query: string
  country: string
  countryCode: string
  category: string
  specs: Record<string, string>
  shoppingHits: PriceHit[]
  organicText: string
  fallbackCurrency: string
}): Promise<{ hits: PriceHit[]; confidence: number; token_usage: any }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return {
      hits: opts.shoppingHits,
      confidence: opts.shoppingHits.length ? 5 : 1,
      token_usage: {
        model: DEFAULT_MODEL,
        input_tokens: 0,
        output_tokens: 0,
        input_cost_usd: 0,
        output_cost_usd: 0,
        total_cost_usd: 0,
      },
    }
  }

  const anthropic = new Anthropic({ apiKey })
  const specLines = Object.entries(opts.specs)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n') || '(none provided)'

  const shoppingText = opts.shoppingHits
    .map((h, i) => `${i + 1}. ${h.retailer} | ${h.title} | ${h.currency} ${h.price} | ${h.url}`)
    .join('\n')

  const message = await anthropic.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    temperature: 0,
    system: `You normalize public IT-asset prices for RemoAsset procurement. Keep only listings that match the requested brand, model, and specs. Drop refurbished/used/renewed unless the query asks for them. Drop wrong RAM, storage, chip, or screen size. Prefer official retailers and major marketplaces. Return JSON only.`,
    messages: [{
      role: 'user',
      content: `Device: ${opts.query}
Category: ${opts.category}
Country: ${opts.country} (${opts.countryCode})
Requested specs:
${specLines}

SHOPPING LISTINGS:
${shoppingText || '(none)'}

WEB SNIPPETS (may mention MRP / list price):
${opts.organicText || '(none)'}

Return ONLY this JSON object:
{
  "confidence": 1-10,
  "results": [
    {
      "retailer": "Amazon.in",
      "title": "product title",
      "url": "https://...",
      "currency": "${opts.fallbackCurrency}",
      "price": 72990,
      "price_type": "mrp" | "msrp" | "list" | "street" | "unknown",
      "notes": "optional short match note"
    }
  ]
}

Rules:
- price is a number in the listing currency (no symbols)
- Use price_type "mrp" when the source states MRP / maximum retail price
- Use "msrp" or "list" for manufacturer/list price
- Use "street" for current selling / offer price
- Include url for every row so ops can open the site
- If a snippet has MRP and a different street price, you may emit two rows for the same URL
- Max 15 results. Sort cheapest first.`,
    }],
  })

  const cost = calculateCost(DEFAULT_MODEL, message.usage.input_tokens, message.usage.output_tokens)
  const token_usage = {
    model: DEFAULT_MODEL,
    input_tokens: message.usage.input_tokens,
    output_tokens: message.usage.output_tokens,
    ...cost,
  }

  const text = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { hits: opts.shoppingHits, confidence: opts.shoppingHits.length ? 5 : 1, token_usage }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    const results: PriceHit[] = []
    for (const row of parsed.results || []) {
      const price = parseMoney(row.price)
      const url = String(row.url || '').trim()
      const title = String(row.title || '').trim()
      if (price == null || !url || !title) continue
      const priceType = ['mrp', 'msrp', 'list', 'street', 'unknown'].includes(row.price_type)
        ? row.price_type
        : 'unknown'
      results.push({
        retailer: String(row.retailer || 'Retailer').trim() || 'Retailer',
        title,
        url,
        currency: String(row.currency || opts.fallbackCurrency).toUpperCase(),
        price,
        price_type: priceType,
        notes: row.notes ? String(row.notes) : undefined,
      })
    }
    const confidence = Number(parsed.confidence)
    return {
      hits: results.length ? results : opts.shoppingHits,
      confidence: Number.isFinite(confidence) ? Math.min(10, Math.max(1, confidence)) : (results.length ? 6 : 3),
      token_usage,
    }
  } catch {
    return { hits: opts.shoppingHits, confidence: opts.shoppingHits.length ? 5 : 1, token_usage }
  }
}

function summarize(hits: PriceHit[], fallbackCurrency: string, confidence: number) {
  if (hits.length === 0) {
    return {
      currency: fallbackCurrency,
      range_from: null,
      range_to: null,
      listing_count: 0,
      confidence,
    }
  }
  const prices = hits.map((h) => h.price)
  const listish = hits.filter((h) => h.price_type === 'mrp' || h.price_type === 'msrp' || h.price_type === 'list')
  const rangeFrom = Math.min(...prices)
  const rangeTo = listish.length ? Math.max(...listish.map((h) => h.price), ...prices) : Math.max(...prices)
  const currency = hits[0]?.currency || fallbackCurrency
  return {
    currency,
    range_from: rangeFrom,
    range_to: rangeTo,
    listing_count: hits.length,
    confidence,
  }
}

function sortHits(hits: PriceHit[]): PriceHit[] {
  return [...hits].sort((a, b) => a.price - b.price)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const brand = String(body.brand || '').trim()
    const model = String(body.model || '').trim()
    const country = String(body.country || '').trim()
    const countryCode = String(body.country_code || '').trim().toLowerCase()
    const category = String(body.category || 'other')
    const specs = (body.specs && typeof body.specs === 'object') ? body.specs as Record<string, string> : {}

    if (!brand || !model || !country || !countryCode) {
      return new Response(
        JSON.stringify({ error: 'brand, model, country, and country_code are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const query = buildQuery(brand, model, specs)
    const fallbackCurrency = CURRENCY_BY_GL[countryCode] || 'USD'
    const hl = countryCode === 'in' ? 'en' : 'en'
    const searchQueriesUsed: string[] = []

    const shoppingQuery = query
    searchQueriesUsed.push(`shopping: ${shoppingQuery}`)
    const shoppingData = await serperPost('shopping', {
      q: shoppingQuery,
      gl: countryCode,
      hl,
      num: 20,
    })

    await new Promise((r) => setTimeout(r, 400))

    const webQuery = listPriceQuery(query, countryCode)
    searchQueriesUsed.push(`search: ${webQuery}`)
    let organic: any[] = []
    try {
      const searchData = await serperPost('search', {
        q: webQuery,
        gl: countryCode,
        hl,
        num: 10,
      })
      organic = searchData.organic || []
    } catch (err) {
      console.error('Serper search failed:', err)
    }

    const shoppingHits = shoppingToHits(shoppingData.shopping || [], fallbackCurrency)
    const { hits, confidence, token_usage } = await refineWithClaude({
      query,
      country,
      countryCode,
      category,
      specs,
      shoppingHits,
      organicText: organicHints(organic),
      fallbackCurrency,
    })

    const results = sortHits(hits)
    const summary = summarize(results, fallbackCurrency, confidence)

    return new Response(
      JSON.stringify({
        summary,
        results,
        search_queries_used: searchQueriesUsed,
        token_usage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (err) {
    console.error('mrp-price-lookup error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})
