import {
  asMapped,
  cartSpecsFromRfqLines,
  crudePdfText,
  extractJson,
  heuristicMap,
  pdfExtractIsUsable,
  looksLikePdf,
  MAP_SYSTEM,
  mapUserPrompt,
  type ParseQuotationResult,
} from './quote-map.ts'

const DOCLING_TIMEOUT_MS = 35_000
const CLAUDE_TIMEOUT_MS = 25_000
const EXTRACT_CAP = 8000
const MODEL = 'claude-haiku-4-5-20251001'

function decodeFileBytes(fileBase64: string): Uint8Array {
  const raw = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64
  return Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
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

async function claudeMessages(
  content: unknown,
  cart: ReturnType<typeof cartSpecsFromRfqLines>,
  model = MODEL,
): Promise<ParseQuotationResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1600,
      temperature: 0,
      system: MAP_SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  }, CLAUDE_TIMEOUT_MS)
  if (!res.ok) {
    const errText = await res.text()
    if (model === MODEL && Array.isArray(content)) {
      console.error('quote map haiku failed, retrying sonnet', errText.slice(0, 200))
      return claudeMessages(content, cart, 'claude-sonnet-4-5-20250929')
    }
    throw new Error(`Claude map failed (${res.status}): ${errText.slice(0, 280)}`)
  }
  const payload = await res.json() as { content?: { type: string; text?: string }[] }
  const text = (payload.content || []).map((b) => (b.type === 'text' ? b.text || '' : '')).join('')
  const mapped = asMapped(extractJson(text), cart)
  const priced = mapped.line_items.some((l) => l.unit_price != null && l.unit_price > 0)
    || (mapped.quoted_price != null && mapped.quoted_price > 0)
  if (!priced && model === MODEL && Array.isArray(content)) {
    console.error('quote map haiku returned no prices, retrying sonnet')
    return claudeMessages(content, cart, 'claude-sonnet-4-5-20250929')
  }
  return mapped
}

async function mapWithClaude(excerpt: string, cart: ReturnType<typeof cartSpecsFromRfqLines>): Promise<ParseQuotationResult> {
  const cartJson = JSON.stringify(cart, null, 2)
  return claudeMessages(mapUserPrompt(excerpt.slice(0, EXTRACT_CAP), cartJson), cart)
}

async function mapWithClaudePdf(bytes: Uint8Array, cart: ReturnType<typeof cartSpecsFromRfqLines>): Promise<ParseQuotationResult> {
  const cartJson = JSON.stringify(cart, null, 2)
  return claudeMessages(
    [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytesToBase64(bytes) } },
      { type: 'text', text: mapUserPrompt('(see quotation PDF)', cartJson) },
    ],
    cart,
  )
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

function imageMediaType(contentType: string, fileName: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null {
  const mime = contentType.toLowerCase()
  const name = fileName.toLowerCase()
  if (mime.includes('png') || name.endsWith('.png')) return 'image/png'
  if (mime.includes('webp') || name.endsWith('.webp')) return 'image/webp'
  if (mime.includes('gif') || name.endsWith('.gif')) return 'image/gif'
  if (mime.includes('jpeg') || mime.includes('jpg') || name.endsWith('.jpg') || name.endsWith('.jpeg') || mime.startsWith('image/')) {
    return 'image/jpeg'
  }
  return null
}

async function mapWithClaudeImage(
  bytes: Uint8Array,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
  cart: ReturnType<typeof cartSpecsFromRfqLines>,
): Promise<ParseQuotationResult> {
  const cartJson = JSON.stringify(cart, null, 2)
  return claudeMessages(
    [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: bytesToBase64(bytes) } },
      { type: 'text', text: mapUserPrompt('(see quotation image)', cartJson) },
    ],
    cart,
  )
}

export async function parseQuotationFromFile(opts: {
  fileBase64: string
  fileName: string
  contentType: string
  rfqLines: unknown
}): Promise<ParseQuotationResult> {
  const bytes = decodeFileBytes(opts.fileBase64)
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('File exceeds 10MB')
  const cart = cartSpecsFromRfqLines(opts.rfqLines)
  let excerpt = ''
  if (Deno.env.get('QUOTE_OCR_URL')) {
    try {
      excerpt = (await convertWithDocling(bytes, opts.fileName, opts.contentType)).excerpt
    } catch (err) {
      console.error('docling convert failed', err)
    }
  }
  const pdf = looksLikePdf(bytes, opts.fileName, opts.contentType)
  if (!excerpt && pdf) excerpt = crudePdfText(bytes)
  const usable = pdfExtractIsUsable(excerpt)
  if (usable) {
    try {
      return await mapWithClaude(excerpt, cart)
    } catch (err) {
      console.error('quote map claude failed', err)
      if (pdf) return await mapWithClaudePdf(bytes, cart)
      return heuristicMap(excerpt, cart)
    }
  }
  if (pdf) {
    return await mapWithClaudePdf(bytes, cart)
  }
  const media = imageMediaType(opts.contentType, opts.fileName)
  if (media) {
    return await mapWithClaudeImage(bytes, media, cart)
  }
  throw new Error('Could not read text from this file. Use a PDF with selectable text, or a clear photo of the quote.')
}

export { cartSpecsFromRfqLines, heuristicMap }
