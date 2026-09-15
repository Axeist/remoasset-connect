import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3'
import {
  asMapped,
  cartSpecsFromRfqLines,
  extractJson,
  heuristicMap,
  type ParseQuotationResult,
} from './quote-map.ts'

const DOCLING_TIMEOUT_MS = 35_000
const CLAUDE_TIMEOUT_MS = 12_000
const EXTRACT_CAP = 8000
const MODEL = 'claude-haiku-4-5-20251001'

function decodeFileBytes(fileBase64: string): Uint8Array {
  const raw = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64
  return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

async function mapWithClaude(excerpt: string, cart: ReturnType<typeof cartSpecsFromRfqLines>): Promise<ParseQuotationResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const anthropic = new Anthropic({ apiKey })
  const cartJson = JSON.stringify(cart, null, 2)
  const body = excerpt.slice(0, EXTRACT_CAP)

  const work = anthropic.messages.create({
    model: MODEL,
    max_tokens: 1600,
    temperature: 0,
    system:
      'You map a vendor quotation extract onto an RFQ cart. Prefer unit price over line totals. Treat MRP/list/MSRP as mrp_price and the offered/quoted rate as unit_price. Never invent prices that are not in the extract. Return JSON only.',
    messages: [{
      role: 'user',
      content: `RFQ CART (use these ids exactly):\n${cartJson}\n\nQUOTATION EXTRACT:\n${body}\n\nReturn ONLY this JSON:\n{
  "currency": "USD",
  "quoted_price": null,
  "mrp_price": null,
  "shipping_fee": 0,
  "tax_fee": 0,
  "other_fees": 0,
  "lead_time_days": null,
  "quote_valid_until": "YYYY-MM-DD or null",
  "notes": null,
  "line_items": [
    { "id": "cart-id", "unit_price": 0, "mrp_price": null, "confidence": "high", "alternative": null }
  ],
  "extras": [
    { "extra_type": "warranty", "label": "", "qty": 1, "unit_price": 0, "mrp_price": null, "confidence": "low" }
  ]
}

Rules:
- Every cart id should appear in line_items. Use null prices when unknown.
- If the quoted device differs from the cart spec, set alternative { brand, device_model, processor, ram, storage }.
- Unmatched billed rows (AppleCare, warranty, accessories) go in extras, not as cart lines.
- quoted_price/mrp_price at top level only for RFQs with an empty cart (lump-sum quotes).
- Dates ISO YYYY-MM-DD. Currency ISO code.`,
    }],
  })

  const raced = await Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Claude timed out')), CLAUDE_TIMEOUT_MS)),
  ])
  const text = raced.content.map((b) => b.type === 'text' ? b.text : '').join('')
  return asMapped(extractJson(text), cart)
}

export async function convertWithDocling(bytes: Uint8Array, fileName: string, contentType: string): Promise<{ excerpt: string }> {
  const url = (Deno.env.get('QUOTE_OCR_URL') || '').replace(/\/$/, '')
  const secret = Deno.env.get('QUOTE_OCR_SECRET') || ''
  if (!url) throw new Error('OCR not configured')

  const form = new FormData()
  const blob = new Blob([bytes], { type: contentType || 'application/pdf' })
  form.append('file', blob, fileName || 'quote.pdf')

  const res = await fetchWithTimeout(`${url}/convert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'X-Quote-Ocr-Secret': secret,
    },
    body: form,
  }, DOCLING_TIMEOUT_MS)

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OCR failed (${res.status}): ${errText.slice(0, 240)}`)
  }
  const data = await res.json() as { excerpt?: string; markdown?: string; tables?: string[] }
  const tables = Array.isArray(data.tables) ? data.tables.join('\n\n') : ''
  const excerpt = String(data.excerpt || [tables && `TABLES:\n${tables}`, data.markdown].filter(Boolean).join('\n\n')).trim()
  if (!excerpt) throw new Error('OCR returned no text')
  return { excerpt: excerpt.slice(0, 12000) }
}

export async function parseQuotationFromFile(opts: {
  fileBase64: string
  fileName: string
  contentType: string
  rfqLines: unknown
}): Promise<ParseQuotationResult> {
  const bytes = decodeFileBytes(opts.fileBase64)
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('File exceeds 10MB')
  const { excerpt } = await convertWithDocling(bytes, opts.fileName, opts.contentType)
  const cart = cartSpecsFromRfqLines(opts.rfqLines)
  try {
    return await mapWithClaude(excerpt, cart)
  } catch (err) {
    console.error('quote map claude failed', err)
    return heuristicMap(excerpt, cart)
  }
}

export { cartSpecsFromRfqLines, heuristicMap }
