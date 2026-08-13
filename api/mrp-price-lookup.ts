import { createClient } from '@supabase/supabase-js';
import {
  classifyRetailerHit,
  isOffMarketListing,
  marketplaceNamesForCountry,
  marketplaceRetailersForCountry,
  officialStoreForBrand,
  retailerNameFromUrl,
  searchSitesForCountry,
} from '../src/lib/reputable-retailers';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.00 },
  'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
};

const CURRENCY_BY_GL: Record<string, string> = {
  in: 'INR', us: 'USD', gb: 'GBP', ae: 'AED', sg: 'SGD', au: 'AUD', ca: 'CAD',
  de: 'EUR', fr: 'EUR', nl: 'EUR', jp: 'JPY', kr: 'KRW', ph: 'PHP', my: 'MYR',
  id: 'IDR', th: 'THB', vn: 'VND', br: 'BRL', mx: 'MXN', za: 'ZAR', sa: 'SAR',
  co: 'COP',
};

type PriceType = 'mrp' | 'msrp' | 'list' | 'street' | 'unknown';

interface PriceHit {
  retailer: string;
  title: string;
  url: string;
  currency: string;
  price: number;
  price_type: PriceType;
  notes?: string;
  match_quality?: 'exact' | 'near';
}

function json(res: { status: (n: number) => { json: (b: unknown) => void } }, status: number, body: unknown) {
  return res.status(status).json(body);
}

function calculateCost(model: string, inputTokens: number, outputTokens: number) {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL];
  return {
    input_cost_usd: (inputTokens / 1_000_000) * pricing.input,
    output_cost_usd: (outputTokens / 1_000_000) * pricing.output,
    total_cost_usd: (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output,
  };
}

function parseMoney(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[^\d.,]/g, '').trim();
  if (!cleaned) return null;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      const n = parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    const n = parseFloat(cleaned.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',');
    const last = parts[parts.length - 1];
    if (last.length === 2 && parts.length === 2) {
      const n = parseFloat(cleaned.replace(',', '.'));
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    const n = parseFloat(cleaned.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectCurrency(text: string, fallback: string): string {
  if (/₹|INR|Rs\.?/i.test(text)) return 'INR';
  if (/\$|USD/.test(text) && !/A\$|C\$|S\$/.test(text)) return 'USD';
  if (/£|GBP/.test(text)) return 'GBP';
  if (/€|EUR/.test(text)) return 'EUR';
  if (/AED|د\.إ/.test(text)) return 'AED';
  if (/S\$|SGD/.test(text)) return 'SGD';
  if (/A\$|AUD/.test(text)) return 'AUD';
  if (/C\$|CAD/.test(text)) return 'CAD';
  if (/¥|JPY/.test(text)) return 'JPY';
  return fallback;
}

function familyQuery(brand: string, model: string, specs: Record<string, string>): string {
  const parts = [brand, model];
  if (specs.processor?.trim()) parts.push(specs.processor.trim());
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function buildQuery(brand: string, model: string, specs: Record<string, string>): string {
  const parts = [familyQuery(brand, model, specs)];
  for (const key of ['ram', 'storage']) {
    const v = specs[key]?.trim();
    if (v) parts.push(v);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function listPriceQuery(base: string, countryCode: string): string {
  if (countryCode === 'in') return `${base} MRP OR "maximum retail price" OR "list price"`;
  return `${base} MSRP OR "list price" OR MRP`;
}

const ACCESSORY_NEG = ' -case -cover -sleeve -skin -pouch -bag -stand -hub -charger -accessory';

function looksLikeComputer(text: string): boolean {
  const ram = /\b(8|12|16|18|24|32|36|48|64)\s*gb\b/i.test(text);
  const storage = /\b(128|256|512)\s*gb\b|\b[1-8]\s*tb\b/i.test(text);
  return ram && storage;
}

function isAccessoryListing(text: string): boolean {
  if (/\b((hard|soft)\s*shell(\s*case)?|hardshell|protective\s*case|clear\s*case|laptop\s*(case|sleeve|bag|cover|stand)|keyboard\s*cover|screen\s*protector|tempered\s*glass|folio\s*case)\b/i.test(text)) {
    return true;
  }
  if (/\b(case|cases|cover|sleeve|skin|pouch|bag|backpack|folio|sticker|decal|dongle)\b.{0,48}\b(for|compatible)\b/i.test(text)) {
    return true;
  }
  if (/\b(for|compatible with)\b.{0,56}\b(macbook|imac|ipad|iphone|laptop|thinkpad|xps|surface)\b/i.test(text)) {
    return true;
  }
  if (looksLikeComputer(text)) return false;
  return /\b(case|cases|cover|sleeve|skin|pouch|bag|backpack|folio|protector|keyboard cover|laptop stand|stand for|riser|usb[-\s]?c hub|dongle|sticker|decal|accessories?)\b/i.test(text);
}

function minDevicePrice(currency: string, category: string): number {
  if (category !== 'laptop' && category !== 'desktop_server') return 0;
  if (currency === 'INR') return 25_000;
  if (currency === 'JPY') return 40_000;
  if (currency === 'KRW') return 400_000;
  if (currency === 'VND') return 8_000_000;
  if (currency === 'IDR') return 4_000_000;
  if (currency === 'COP') return 1_500_000;
  if (currency === 'PHP') return 15_000;
  return 200;
}

function isMajorHit(hit: PriceHit, countryCode: string): boolean {
  return classifyRetailerHit(hit, countryCode) !== 'other';
}

function organicToHits(items: any[], fallbackCurrency: string, countryCode: string): PriceHit[] {
  const hits: PriceHit[] = [];
  for (const item of items || []) {
    const title = String(item.title || '').trim();
    const url = String(item.link || item.url || '').trim();
    const snippet = String(item.snippet || item.price || '');
    const price = parseMoney(item.price) ?? parseMoney(snippet.match(/(?:₹|Rs\.?|INR|\$|USD|£|€)\s*[\d,.]+/i)?.[0]);
    if (!title || !url || price == null) continue;
    hits.push({
      retailer: retailerNameFromUrl(url, String(item.source || 'Retailer'), countryCode),
      title,
      url,
      currency: fallbackCurrency,
      price,
      price_type: /mrp|msrp|list price/i.test(snippet) ? 'list' : 'street',
    });
  }
  return hits;
}

function dedupeHits(hits: PriceHit[]): PriceHit[] {
  const seen = new Set<string>();
  const out: PriceHit[] = [];
  for (const hit of hits) {
    const key = hit.url.replace(/[?#].*$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

function mergeKeepCoverage(refined: PriceHit[], raw: PriceHit[]): PriceHit[] {
  return dedupeHits([...refined, ...raw]);
}

async function serperPost(path: 'shopping' | 'search', body: Record<string, unknown>) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) throw new Error('SERPER_API_KEY not configured');
  const res = await fetch(`https://google.serper.dev/${path}`, {
    method: 'POST',
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Serper ${path} error ${res.status}: ${await res.text()}`);
  return res.json();
}

function shoppingToHits(items: any[], fallbackCurrency: string, countryCode: string): PriceHit[] {
  const hits: PriceHit[] = [];
  for (const item of items || []) {
    const price = parseMoney(item.price);
    if (price == null) continue;
    const title = String(item.title || '').trim();
    const url = String(item.link || item.url || '').trim();
    if (!title || !url) continue;
    hits.push({
      retailer: retailerNameFromUrl(url, String(item.source || item.merchant || 'Retailer').trim() || 'Retailer', countryCode),
      title,
      url,
      currency: fallbackCurrency,
      price,
      price_type: 'street',
      notes: item.delivery ? String(item.delivery) : undefined,
    });
  }
  return hits;
}

function organicHints(items: any[]): string {
  return (items || [])
    .slice(0, 12)
    .map((r: any) => `- ${r.title}\n  URL: ${r.link}\n  Snippet: ${r.snippet || ''}`)
    .join('\n');
}

async function refineWithClaude(opts: {
  query: string;
  country: string;
  countryCode: string;
  category: string;
  specs: Record<string, string>;
  shoppingHits: PriceHit[];
  organicText: string;
  fallbackCurrency: string;
}) {
  const emptyUsage = {
    model: DEFAULT_MODEL,
    input_tokens: 0,
    output_tokens: 0,
    input_cost_usd: 0,
    output_cost_usd: 0,
    total_cost_usd: 0,
  };
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { hits: opts.shoppingHits, confidence: opts.shoppingHits.length ? 5 : 1, token_usage: emptyUsage };
  }

  const specLines = Object.entries(opts.specs)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n') || '(none provided)';
  const shoppingText = opts.shoppingHits
    .map((h, i) => `${i + 1}. ${h.retailer} | ${h.title} | ${h.currency} ${h.price} | ${h.url}`)
    .join('\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      temperature: 0,
      system: 'You normalize public IT-asset prices for RemoAsset procurement. Keep listings that match the requested brand and model as the computer itself. Drop cases, sleeves, covers, bags, stands, hubs, chargers sold separately, and any accessory. Drop refurbished/used/renewed unless asked. Prefer the country\'s reputed national retailers and official brand stores. Return JSON only.',
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
- NEVER drop these ${opts.country} retailers just to reduce the list: ${marketplaceNamesForCountry(opts.countryCode).join(', ')}, plus official brand stores (Apple, Dell, Lenovo, HP, Microsoft, Samsung)
- Max 25 results. Sort cheapest first.`,
      }],
    }),
  });

  if (!res.ok) {
    console.error('Anthropic error', await res.text());
    return { hits: opts.shoppingHits, confidence: opts.shoppingHits.length ? 5 : 1, token_usage: emptyUsage };
  }

  const message = await res.json() as {
    usage?: { input_tokens: number; output_tokens: number };
    content?: Array<{ type: string; text?: string }>;
  };
  const inputTokens = message.usage?.input_tokens ?? 0;
  const outputTokens = message.usage?.output_tokens ?? 0;
  const token_usage = {
    model: DEFAULT_MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    ...calculateCost(DEFAULT_MODEL, inputTokens, outputTokens),
  };
  const text = message.content?.[0]?.type === 'text' ? (message.content[0].text || '').trim() : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { hits: opts.shoppingHits, confidence: opts.shoppingHits.length ? 5 : 1, token_usage };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const results: PriceHit[] = [];
    for (const row of parsed.results || []) {
      const price = parseMoney(row.price);
      const url = String(row.url || '').trim();
      const title = String(row.title || '').trim();
      if (price == null || !url || !title) continue;
      const priceType = ['mrp', 'msrp', 'list', 'street', 'unknown'].includes(row.price_type)
        ? row.price_type
        : 'unknown';
      results.push({
        retailer: String(row.retailer || 'Retailer').trim() || 'Retailer',
        title,
        url,
        currency: String(row.currency || opts.fallbackCurrency).toUpperCase(),
        price,
        price_type: priceType,
        notes: row.notes ? String(row.notes) : undefined,
      });
    }
    const confidence = Number(parsed.confidence);
    return {
      hits: mergeKeepCoverage(opts.shoppingHits, results),
      confidence: Number.isFinite(confidence) ? Math.min(10, Math.max(1, confidence)) : (results.length ? 6 : 3),
      token_usage,
    };
  } catch {
    return { hits: opts.shoppingHits, confidence: opts.shoppingHits.length ? 5 : 1, token_usage };
  }
}

function summarize(hits: PriceHit[], fallbackCurrency: string, confidence: number) {
  if (hits.length === 0) {
    return { currency: fallbackCurrency, range_from: null, range_to: null, listing_count: 0, confidence, range_basis: 'exact' as const };
  }
  const exact = hits.filter((h) => h.match_quality !== 'near');
  const floorHits = exact.length ? exact : hits;
  const listish = floorHits.filter((h) => h.price_type === 'mrp' || h.price_type === 'msrp' || h.price_type === 'list');
  return {
    currency: floorHits[0]?.currency || fallbackCurrency,
    range_from: Math.min(...floorHits.map((h) => h.price)),
    range_to: listish.length ? Math.max(...listish.map((h) => h.price)) : Math.max(...floorHits.map((h) => h.price)),
    listing_count: hits.length,
    confidence,
    range_basis: exact.length ? 'exact' as const : 'nearby' as const,
  };
}

export default async function handler(req: { method?: string; headers: Record<string, string | undefined>; body?: any }, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });

  try {
    const auth = req.headers.authorization || req.headers.Authorization || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !anonKey) return json(res, 500, { error: 'Supabase env not configured' });
    if (!token) return json(res, 401, { error: 'Not signed in' });

    const supabase = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json(res, 401, { error: 'Not signed in — refresh the page and try again.' });

    const body = req.body || {};
    const brand = String(body.brand || '').trim();
    const model = String(body.model || '').trim();
    const country = String(body.country || '').trim();
    const countryCode = String(body.country_code || '').trim().toLowerCase();
    const category = String(body.category || 'other');
    const specs = (body.specs && typeof body.specs === 'object') ? body.specs as Record<string, string> : {};

    if (!brand || !model || !country || !countryCode) {
      return json(res, 400, { error: 'brand, model, country, and country_code are required' });
    }

    const query = buildQuery(brand, model, specs);
    const broadQuery = familyQuery(brand, model, specs);
    const fallbackCurrency = CURRENCY_BY_GL[countryCode] || 'USD';
    const marketplaceSites = marketplaceRetailersForCountry(countryCode);
    const allSites = searchSitesForCountry(countryCode);
    const official = officialStoreForBrand(brand);
    const siteOr = allSites.map((s) => `site:${s.host}`).join(' OR ');
    const retailerOr = marketplaceSites.map((s) => `"${s.name}"`).join(' OR ');
    const namesQ = `${broadQuery} (${retailerOr})${ACCESSORY_NEG}`;
    const webQuery = `${listPriceQuery(broadQuery, countryCode)} (${siteOr}) -case -sleeve -cover`;
    const officialQ = official ? `${broadQuery} site:${official.hosts[0]}` : null;
    const familyQ = `${broadQuery}${ACCESSORY_NEG}`;
    const searchQueriesUsed: string[] = [`shopping: ${familyQ}`];
    if (query !== broadQuery) searchQueriesUsed.push(`shopping: ${query}${ACCESSORY_NEG}`);
    searchQueriesUsed.push(`shopping: ${namesQ}`);
    if (officialQ) searchQueriesUsed.push(`shopping: ${officialQ}`);
    searchQueriesUsed.push(`search: ${webQuery}`);

    const shoppingBags: any[] = [];
    let organic: any[] = [];
    const calls: { q: string; path: 'shopping' | 'search' }[] = [
      { path: 'shopping', q: familyQ },
    ];
    if (query !== broadQuery) calls.push({ path: 'shopping', q: `${query}${ACCESSORY_NEG}` });
    calls.push({ path: 'shopping', q: namesQ });
    if (officialQ) calls.push({ path: 'shopping', q: officialQ });
    calls.push({ path: 'search', q: webQuery });

    for (let i = 0; i < calls.length; i += 3) {
      const chunk = calls.slice(i, i + 3);
      const settled = await Promise.allSettled(
        chunk.map((c) => serperPost(c.path, { q: c.q, gl: countryCode, hl: 'en', num: c.path === 'search' ? 20 : 40 })),
      );
      settled.forEach((item, idx) => {
        if (item.status !== 'fulfilled') {
          console.error('Serper call failed:', item.reason);
          return;
        }
        shoppingBags.push(...(item.value.shopping || []));
        if (chunk[idx].path === 'search') organic = item.value.organic || [];
      });
      if (i + 3 < calls.length) await new Promise((r) => setTimeout(r, 280));
    }

    const floor = minDevicePrice(fallbackCurrency, category);
    const shoppingHits = dedupeHits([
      ...shoppingToHits(shoppingBags, fallbackCurrency, countryCode),
      ...organicToHits(organic, fallbackCurrency, countryCode),
    ]).filter((h) =>
      !isOffMarketListing(h, countryCode, fallbackCurrency) &&
      !isAccessoryListing(`${h.title} ${h.retailer}`) &&
      h.price >= floor
    );
    const { hits, confidence, token_usage } = await refineWithClaude({
      query,
      country,
      countryCode,
      category,
      specs,
      shoppingHits,
      organicText: organicHints(organic),
      fallbackCurrency,
    });

    const results = mergeKeepCoverage(shoppingHits, hits)
      .filter((h) => !isAccessoryListing(`${h.title} ${h.retailer}`) && h.price >= floor)
      .sort((a, b) => a.price - b.price);
    return json(res, 200, {
      summary: summarize(results, fallbackCurrency, confidence),
      results,
      search_queries_used: searchQueriesUsed,
      token_usage,
    });
  } catch (err) {
    console.error('mrp-price-lookup error:', err);
    return json(res, 500, { error: String(err) });
  }
}
