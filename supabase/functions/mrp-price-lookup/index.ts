/**
 * mrp-price-lookup
 *
 * Uses Serper Shopping + Search (localized by country) then Claude to
 * match listings to the requested device specs and return a public
 * price range with source-site links.
 */

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3'
import {
  classifyRetailerHit,
  isOffMarketListing,
  marketplaceRetailersForCountry,
  officialStoreForBrand,
  retailerNameFromUrl,
  searchSitesForCountry,
} from './retailers.ts'

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
  co: 'COP',
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
  match_quality?: 'exact' | 'near'
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
    if (last.length === 3) {
      const n = parseFloat(cleaned.replace(/,/g, ''))
      return Number.isFinite(n) && n > 0 ? n : null
    }
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

const GOOGLE_DOMAINS: Record<string, string> = {
  in: 'google.co.in', gb: 'google.co.uk', ae: 'google.ae', sg: 'google.com.sg',
  au: 'google.com.au', ca: 'google.ca', de: 'google.de', fr: 'google.fr',
  nl: 'google.nl', jp: 'google.co.jp', kr: 'google.co.kr', ph: 'google.com.ph',
  my: 'google.com.my', id: 'google.co.id', th: 'google.co.th', vn: 'google.com.vn',
  br: 'google.com.br', mx: 'google.com.mx', za: 'google.co.za', sa: 'google.com.sa',
  co: 'google.com.co',
}

function googleDomain(countryCode: string): string {
  return GOOGLE_DOMAINS[countryCode] || 'google.com'
}

function familyQuery(brand: string, model: string, specs: Record<string, string>): string {
  const parts = [brand, model]
  const chip = specs.processor?.trim()
  if (chip) parts.push(chip)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function coreQuery(brand: string, model: string, specs: Record<string, string>): string {
  const parts = [familyQuery(brand, model, specs)]
  for (const key of ['ram', 'storage']) {
    const v = specs[key]?.trim()
    if (v) parts.push(v)
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function normalizeChip(text: string): string | null {
  const m = text.match(/\b(m[1-5])(?:\s*(pro|max|ultra))?\b/i)
    || text.match(/\b(core ultra)\s*([579])\b/i)
    || text.match(/\b(i[3579])(?:-\d+)?\b/i)
    || text.match(/\b(ryzen)\s*([579])\b/i)
  if (!m) return null
  return m.slice(1).filter(Boolean).join(' ').toLowerCase()
}

function ramGb(text: string): number | null {
  const m = text.match(/\b(8|12|16|18|24|32|36|48|64)\s*gb\b/i)
  return m ? Number(m[1]) : null
}

function storageToken(text: string): string | null {
  const tb = text.match(/\b([1-8])\s*tb\b/i)
  if (tb) return `${tb[1]}tb`
  const gb = text.match(/\b(128|256|512)\s*gb\b/i)
  return gb ? `${gb[1]}gb` : null
}

function isRefurbished(text: string): boolean {
  return /refurb|renewed|used|pre-?owned|open[\s-]?box|certified pre/i.test(text)
}

function screenInch(text: string): number | null {
  const m = text.match(/\b(13|14|15|16)(?:\.\d)?\s*(?:-?inch|"|''|″)\b/i)
    || text.match(/\b(13|14|15|16)-inch\b/i)
  return m ? Number(m[1]) : null
}

function specMatch(hit: PriceHit, specs: Record<string, string>, brand: string, model: string): 'exact' | 'near' | 'reject' {
  const hay = `${hit.title} ${hit.notes || ''}`.toLowerCase()
  if (isRefurbished(hay)) return 'reject'
  const brandTok = brand.toLowerCase()
  if (brandTok && !hay.includes(brandTok) && !hit.url.toLowerCase().includes(brandTok.replace(/\s+/g, ''))) {
    if (!/apple|macbook|imac|mac mini|mac studio/i.test(hay) && brandTok === 'apple') return 'reject'
    if (brandTok !== 'apple' && !hay.includes(brandTok)) return 'reject'
  }

  const wantChip = normalizeChip(`${specs.processor || ''} ${model}`)
  const gotChip = normalizeChip(hay)
  if (wantChip && gotChip && wantChip.split(' ')[0] !== gotChip.split(' ')[0]) return 'reject'

  const wantScreen = screenInch(`${specs.display_size || ''} ${model}`)
  const gotScreen = screenInch(hay)
  if (wantScreen && gotScreen && wantScreen !== gotScreen) return 'reject'

  const wantRam = ramGb(specs.ram || '')
  const gotRam = ramGb(hay)
  const ramDiffers = !!(wantRam && gotRam && wantRam !== gotRam)
  const ramMissingCto = !!(wantRam && wantRam >= 32 && !gotRam)

  const wantStore = storageToken(specs.storage || '')
  const gotStore = storageToken(hay)
  const storeDiffers = !!(wantStore && gotStore && wantStore !== gotStore)

  if (ramDiffers || storeDiffers || ramMissingCto) return 'near'
  return 'exact'
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function filterReliableHits(
  hits: PriceHit[],
  specs: Record<string, string>,
  brand: string,
  model: string,
  countryCode: string,
  expectedCurrency: string,
): PriceHit[] {
  const local = hits.filter((h) => !isOffMarketListing(h, countryCode, expectedCurrency))
  const tagged = local
    .map((h) => {
      const match = specMatch(h, specs, brand, model)
      if (match === 'reject') return null
      const nearNote = 'Nearby config — RAM or storage differs from the request'
      const notes = match === 'near'
        ? (h.notes?.includes('Nearby config') ? h.notes : [h.notes, nearNote].filter(Boolean).join(' · '))
        : h.notes
      return { ...h, match_quality: match, notes }
    })
    .filter((h): h is PriceHit => h != null)
  const pool = tagged.length
    ? tagged
    : local.filter((h) => !isRefurbished(`${h.title} ${h.notes || ''}`))
  const mid = median(pool.map((h) => h.price))
  if (!mid) return pool
  return pool.filter((h) => h.price >= mid * 0.2 && h.price <= mid * 4)
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

function isMajorHit(hit: PriceHit, countryCode: string): boolean {
  return classifyRetailerHit(hit, countryCode) !== 'other'
}

function organicToHits(items: any[], fallbackCurrency: string, countryCode: string): PriceHit[] {
  const hits: PriceHit[] = []
  for (const item of items || []) {
    const title = String(item.title || '').trim()
    const url = String(item.link || item.url || '').trim()
    const snippet = String(item.snippet || item.price || '')
    const price = parseMoney(item.price) ?? parseMoney(snippet.match(/(?:₹|Rs\.?|INR|\$|USD|£|€)\s*[\d,.]+/i)?.[0])
    if (!title || !url || price == null) continue
    hits.push({
      retailer: retailerNameFromUrl(url, String(item.source || 'Retailer'), countryCode),
      title,
      url,
      currency: fallbackCurrency,
      price,
      price_type: /mrp|msrp|list price/i.test(snippet) ? 'list' : 'street',
    })
  }
  return hits
}

function dedupeHits(hits: PriceHit[]): PriceHit[] {
  const seen = new Set<string>()
  const out: PriceHit[] = []
  for (const hit of hits) {
    const host = (() => {
      try { return new URL(hit.url).hostname.replace(/^www\./, '') } catch { return hit.url }
    })()
    const titleKey = hit.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)
    const key = host.includes('google.')
      ? `${hit.retailer.toLowerCase()}|${hit.price}|${titleKey}`
      : hit.url.replace(/[?#].*$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(hit)
  }
  return out
}

function mergeKeepCoverage(refined: PriceHit[], raw: PriceHit[]): PriceHit[] {
  return dedupeHits([...refined, ...raw])
}

async function serperPost(path: 'shopping' | 'search', body: Record<string, unknown>): Promise<any> {
  const apiKey = Deno.env.get('SERPER_API_KEY')
  if (!apiKey) throw new Error('SERPER_API_KEY not configured')
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 12_000)
  try {
    const res = await fetch(`https://google.serper.dev/${path}`, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Serper ${path} error ${res.status}: ${text}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

function shoppingPrice(item: any): number | null {
  return parseMoney(item.price)
    ?? parseMoney(item.extracted_price)
    ?? parseMoney(item.priceStr)
    ?? parseMoney(item.oldPrice)
}

function shoppingToHits(items: any[], fallbackCurrency: string, countryCode: string): PriceHit[] {
  const hits: PriceHit[] = []
  for (const item of items || []) {
    const price = shoppingPrice(item)
    if (price == null) continue
    const title = String(item.title || '').trim()
    const source = String(item.source || item.merchant || item.seller || 'Retailer').trim() || 'Retailer'
    const url = String(item.link || item.url || item.productLink || '').trim()
      || `https://www.google.com/search?q=${encodeURIComponent(`${source} ${title}`)}`
    if (!title) continue
    hits.push({
      retailer: retailerNameFromUrl(url, source, countryCode),
      title,
      url,
      currency: fallbackCurrency,
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
    max_tokens: 4096,
    temperature: 0,
    system: `You label public IT-asset prices for RemoAsset procurement. You do not shrink the list. Keep every shopping row. Mark exact vs nearby (same model, different RAM/storage). Set price_type. You may add MRP/list rows from snippets. Never invent a store that is not in the shopping list or snippets. Return JSON only.`,
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
      "match_quality": "exact" | "near",
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
- Return every shopping listing. Label match_quality exact when chip/size/RAM/storage match, near when only RAM or storage differs
- Do not invent retailers
- Max 50 results. Sort cheapest first.`,
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
        match_quality: row.match_quality === 'near' ? 'near' : 'exact',
      })
    }
    const confidence = Number(parsed.confidence)
    return {
      hits: mergeKeepCoverage(opts.shoppingHits, results),
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
      range_basis: 'exact' as const,
    }
  }
  const exact = hits.filter((h) => h.match_quality !== 'near')
  const floorHits = exact.length ? exact : hits
  const listish = floorHits.filter((h) => h.price_type === 'mrp' || h.price_type === 'msrp' || h.price_type === 'list')
  const rangeFrom = Math.min(...floorHits.map((h) => h.price))
  const rangeTo = listish.length
    ? Math.max(...listish.map((h) => h.price))
    : Math.max(...floorHits.map((h) => h.price))
  const currency = floorHits[0]?.currency || fallbackCurrency
  const confidenceBoost = hits.length >= 8 ? 2 : hits.length >= 3 ? 1 : 0
  return {
    currency,
    range_from: rangeFrom,
    range_to: rangeTo,
    listing_count: hits.length,
    confidence: Math.min(10, confidence + confidenceBoost),
    range_basis: exact.length ? 'exact' as const : 'nearby' as const,
  }
}

function sortHits(hits: PriceHit[]): PriceHit[] {
  return [...hits].sort((a, b) => {
    if (a.match_quality === 'near' && b.match_quality !== 'near') return 1
    if (a.match_quality !== 'near' && b.match_quality === 'near') return -1
    return a.price - b.price
  })
}

async function runSerperBatches(
  tasks: { label: string; run: () => Promise<any> }[],
  batchSize = 3,
): Promise<{ label: string; value: any | null }[]> {
  const out: { label: string; value: any | null }[] = []
  for (let i = 0; i < tasks.length; i += batchSize) {
    const chunk = tasks.slice(i, i + batchSize)
    const settled = await Promise.allSettled(chunk.map((t) => t.run()))
    settled.forEach((item, idx) => {
      if (item.status === 'fulfilled') {
        out.push({ label: chunk[idx].label, value: item.value })
      } else {
        console.error(`Serper ${chunk[idx].label} failed:`, item.reason)
        out.push({ label: chunk[idx].label, value: null })
      }
    })
    if (i + batchSize < tasks.length) {
      await new Promise((r) => setTimeout(r, 280))
    }
  }
  return out
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

    const query = coreQuery(brand, model, specs)
    const broadQuery = familyQuery(brand, model, specs)
    const fallbackCurrency = CURRENCY_BY_GL[countryCode] || 'USD'
    const hl = 'en'
    const domain = googleDomain(countryCode)
    const searchQueriesUsed: string[] = []
    const serperBase = { gl: countryCode, hl, google_domain: domain }

    const marketplaceSites = marketplaceRetailersForCountry(countryCode)
    const allSites = searchSitesForCountry(countryCode)
    const official = officialStoreForBrand(brand)
    const siteOr = allSites.map((s) => `site:${s.host}`).join(' OR ')
    const retailerOr = marketplaceSites.map((s) => `"${s.name}"`).join(' OR ')

    const familyQ = broadQuery
    const namesQ = `${broadQuery} (${retailerOr})`
    const webQuery = `${listPriceQuery(broadQuery, countryCode)} (${siteOr})`
    const officialQ = official ? `${broadQuery} site:${official.hosts[0]}` : null

    const tasks: { label: string; run: () => Promise<any> }[] = [
      { label: `shopping: ${familyQ}`, run: () => serperPost('shopping', { q: familyQ, ...serperBase, num: 40 }) },
      { label: `shopping: ${namesQ}`, run: () => serperPost('shopping', { q: namesQ, ...serperBase, num: 30 }) },
    ]
    if (officialQ) {
      tasks.push({ label: `shopping: ${officialQ}`, run: () => serperPost('shopping', { q: officialQ, ...serperBase, num: 8 }) })
    }
    tasks.push({ label: `search: ${webQuery}`, run: () => serperPost('search', { q: webQuery, ...serperBase, num: 15 }) })

    for (const t of tasks) searchQueriesUsed.push(t.label)

    const settled = await runSerperBatches(tasks, 4)
    const shoppingBags: any[] = []
    let organic: any[] = []
    for (const item of settled) {
      if (!item.value) continue
      shoppingBags.push(...(item.value.shopping || []))
      if (item.label.startsWith('search:')) organic = item.value.organic || []
    }

    const shoppingHits = filterReliableHits(
      dedupeHits([
        ...shoppingToHits(shoppingBags, fallbackCurrency, countryCode),
        ...organicToHits(organic, fallbackCurrency, countryCode),
      ]),
      specs,
      brand,
      model,
      countryCode,
      fallbackCurrency,
    )

    const emptyUsage = {
      model: DEFAULT_MODEL,
      input_tokens: 0,
      output_tokens: 0,
      input_cost_usd: 0,
      output_cost_usd: 0,
      total_cost_usd: 0,
    }
    let refined: { hits: PriceHit[]; confidence: number; token_usage: any } = {
      hits: shoppingHits,
      confidence: shoppingHits.length >= 8 ? 7 : shoppingHits.length >= 3 ? 5 : 3,
      token_usage: emptyUsage,
    }
    if (shoppingHits.length < 3) {
      try {
        refined = await refineWithClaude({
          query,
          country,
          countryCode,
          category,
          specs,
          shoppingHits,
          organicText: organicHints(organic),
          fallbackCurrency,
        })
      } catch (err) {
        console.error('Claude refine failed:', err)
      }
    }
    const hits = mergeKeepCoverage(shoppingHits, refined.hits)
    const results = sortHits(filterReliableHits(hits, specs, brand, model, countryCode, fallbackCurrency))
    const summary = summarize(results, fallbackCurrency, refined.confidence)

    return new Response(
      JSON.stringify({
        summary,
        results,
        search_queries_used: searchQueriesUsed,
        token_usage: refined.token_usage,
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
