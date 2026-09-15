import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.3'
import {
  asMapped,
  cartSpecsFromRfqLines,
  crudePdfText,
  extractJson,
  heuristicMap,
  looksLikePdf,
  MAP_SYSTEM,
  mapUserPrompt,
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
    system: MAP_SYSTEM,
    messages: [{
      role: 'user',
      content: mapUserPrompt(body, cartJson),
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
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
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const anthropic = new Anthropic({ apiKey })
  const cartJson = JSON.stringify(cart, null, 2)
  const work = anthropic.messages.create({
    model: MODEL,
    max_tokens: 1600,
    temperature: 0,
    system: MAP_SYSTEM,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: bytesToBase64(bytes) } },
        { type: 'text', text: mapUserPrompt('(see quotation image)', cartJson) },
      ],
    }],
  })
  const raced = await Promise.race([
    work,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Claude timed out')), CLAUDE_TIMEOUT_MS)),
  ])
  const text = raced.content.map((b) => b.type === 'text' ? b.text : '').join('')
  return asMapped(extractJson(text), cart)
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
  if (!excerpt && looksLikePdf(bytes, opts.fileName, opts.contentType)) {
    excerpt = crudePdfText(bytes)
  }
  if (excerpt.length >= 40) {
    try {
      return await mapWithClaude(excerpt, cart)
    } catch (err) {
      console.error('quote map claude failed', err)
      return heuristicMap(excerpt, cart)
    }
  }
  const media = imageMediaType(opts.contentType, opts.fileName)
  if (media) {
    return await mapWithClaudeImage(bytes, media, cart)
  }
  throw new Error('Could not read text from this file. Use a PDF with selectable text, or a clear photo of the quote.')
}

export { cartSpecsFromRfqLines, heuristicMap }
