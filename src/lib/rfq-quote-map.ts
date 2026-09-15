export type CartSpec = {
  id: string
  kind: 'device' | 'addon'
  label: string
  qty: number
  brand?: string
  device_model?: string
  processor?: string | null
  ram?: string | null
  storage?: string | null
  parent_id?: string
}

export type MappedAlternative = {
  brand: string
  device_model: string
  processor: string | null
  ram: string | null
  storage: string | null
}

export type MappedLine = {
  id: string
  unit_price: number | null
  mrp_price: number | null
  confidence: 'high' | 'low'
  alternative?: MappedAlternative | null
}

export type MappedExtra = {
  extra_type: 'applecare' | 'warranty' | 'accessory' | 'other'
  label: string
  qty: number
  unit_price: number
  mrp_price: number | null
  confidence: 'high' | 'low'
}

export type ParseQuotationResult = {
  currency: string | null
  quoted_price: number | null
  mrp_price: number | null
  shipping_fee: number | null
  tax_fee: number | null
  other_fees: number | null
  lead_time_days: number | null
  quote_valid_until: string | null
  notes: string | null
  line_items: MappedLine[]
  extras: MappedExtra[]
  source: 'claude' | 'heuristic'
}

export function money(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) return Math.round(raw * 100) / 100
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/[^\d.,-]/g, '').trim()
  if (!cleaned) return null
  let n: number
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',')
    const lastDot = cleaned.lastIndexOf('.')
    n = lastComma > lastDot
      ? parseFloat(cleaned.replace(/\./g, '').replace(',', '.'))
      : parseFloat(cleaned.replace(/,/g, ''))
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',')
    n = parts[parts.length - 1].length === 3
      ? parseFloat(cleaned.replace(/,/g, ''))
      : parseFloat(cleaned.replace(',', '.'))
  } else {
    n = parseFloat(cleaned)
  }
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export function addonId(line: { id?: string }, addon: { id?: string }, index: number): string {
  if (addon.id) return String(addon.id)
  return `${line.id || 'line'}::addon::${index}`
}

export function cartSpecsFromRfqLines(raw: unknown): CartSpec[] {
  const lines = Array.isArray(raw) ? raw : []
  const specs: CartSpec[] = []
  for (const line of lines) {
    const L = line as Record<string, unknown>
    const id = String(L.id || '')
    if (!id) continue
    const brand = String(L.brand || '').trim()
    const device_model = String(L.device_model || '').trim()
    const processor = L.processor != null ? String(L.processor).trim() : ''
    const ram = L.ram != null ? String(L.ram).trim() : ''
    const storage = L.storage != null ? String(L.storage).trim() : ''
    const label = [brand, device_model, processor, ram, storage].filter(Boolean).join(' ') || id
    specs.push({
      id,
      kind: 'device',
      label,
      qty: Number(L.quantity) || 1,
      brand,
      device_model,
      processor: processor || null,
      ram: ram || null,
      storage: storage || null,
    })
    const addons = Array.isArray(L.addons) ? L.addons : []
    addons.forEach((addon, i) => {
      const a = addon as Record<string, unknown>
      if (!(String(a.type || a.model || '').trim())) return
      const alabel = [a.type, a.model].filter((x) => String(x || '').trim()).join(' — ') || 'Add-on'
      specs.push({
        id: addonId(L, a, i),
        kind: 'addon',
        label: alabel,
        qty: Number(a.qty) || 1,
        parent_id: id,
      })
    })
  }
  return specs
}

function tokenize(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(/\s+/).filter((t) => t.length > 1)
}

function score(hay: string, needle: string): number {
  const h = tokenize(hay)
  const n = tokenize(needle)
  if (!n.length || !h.length) return 0
  let hit = 0
  for (const t of n) if (h.includes(t)) hit++
  return hit / n.length
}

function detectCurrency(text: string): string | null {
  const u = text.toUpperCase()
  const codes = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY', 'PHP', 'MYR', 'IDR', 'THB', 'VND', 'BRL', 'MXN', 'ZAR', 'SAR']
  for (const c of codes) {
    if (new RegExp(`\\b${c}\\b`).test(u)) return c
  }
  if (/₹|Rs\.?|INR/i.test(text)) return 'INR'
  if (/€/.test(text)) return 'EUR'
  if (/£/.test(text)) return 'GBP'
  if (/\$/.test(text)) return 'USD'
  return null
}

function labeledMoney(text: string, labels: RegExp): number | null {
  const m = text.match(labels)
  if (!m) return null
  const slice = text.slice(m.index || 0, (m.index || 0) + 80)
  const num = slice.match(/[\d][\d,.]{0,14}/)
  return num ? money(num[0]) : null
}

function leadTime(text: string): number | null {
  const m = text.match(/lead\s*time[^0-9]{0,20}(\d{1,3})/i)
    || text.match(/(\d{1,3})\s*(business\s*)?days/i)
    || text.match(/delivery[^0-9]{0,24}(\d{1,3})/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 0 && n < 400 ? n : null
}

function validUntil(text: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const dmy = text.match(/\bvalid(?:ity| until| till)?[^0-9]{0,16}(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})\b/i)
  if (dmy) {
    const dd = dmy[1].padStart(2, '0')
    const mm = dmy[2].padStart(2, '0')
    return `${dmy[3]}-${mm}-${dd}`
  }
  return null
}

export function extraTypeFromLabel(label: string): MappedExtra['extra_type'] {
  const t = label.toLowerCase()
  if (t.includes('applecare') || t.includes('apple care')) return 'applecare'
  if (t.includes('warranty') || t.includes('guarantee')) return 'warranty'
  if (t.includes('case') || t.includes('sleeve') || t.includes('charger') || t.includes('adapter') || t.includes('dock')) {
    return 'accessory'
  }
  return 'other'
}

function tableRows(excerpt: string): string[] {
  return excerpt
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.includes('|') && /\d/.test(l) && !/^\|?\s*:?-+:?\s*\|/.test(l))
}

function looksLikePriceCell(cell: string): boolean {
  return /^[\s₹$€£Rs.]*[\d][\d,]*(\.\d+)?\s*$/i.test(cell.trim())
}

function priceNums(cells: string[]): number[] {
  const nums = cells.filter(looksLikePriceCell).map(money).filter((n): n is number => n != null && n > 0)
  const prices = nums.filter((n) => n >= 50)
  return prices.length ? prices : nums
}

export function heuristicMap(excerpt: string, cart: CartSpec[]): ParseQuotationResult {
  const rows = tableRows(excerpt)
  const haystack = excerpt
  const used = new Set<number>()
  const line_items: MappedLine[] = []

  for (const spec of cart) {
    const needle = spec.label
    let best = -1
    let bestScore = 0.34
    rows.forEach((row, i) => {
      if (used.has(i)) return
      const s = score(row, needle)
      if (s > bestScore) {
        bestScore = s
        best = i
      }
    })
    if (best < 0) {
      line_items.push({ id: spec.id, unit_price: null, mrp_price: null, confidence: 'low' })
      continue
    }
    used.add(best)
    const cells = rows[best].split('|').map((c) => c.trim()).filter(Boolean)
    const nums = priceNums(cells)
    const unit = nums.length ? nums[0] : null
    const mrp = nums.length > 1 ? nums[nums.length - 1] : null
    const unitPrice = unit != null && mrp != null && mrp < unit ? mrp : unit
    const listPrice = unit != null && mrp != null && mrp > (unitPrice || 0) ? mrp : (mrp === unitPrice ? null : mrp)
    line_items.push({
      id: spec.id,
      unit_price: unitPrice,
      mrp_price: listPrice && listPrice !== unitPrice ? listPrice : null,
      confidence: bestScore >= 0.6 ? 'high' : 'low',
    })
  }

  const extras: MappedExtra[] = []
  rows.forEach((row, i) => {
    if (used.has(i)) return
    const low = row.toLowerCase()
    if (!/(applecare|warranty|shipping|tax|freight|accessory|case|charger)/.test(low)) return
    if (/(subtotal|total|grand|amount due)/.test(low)) return
    const cells = row.split('|').map((c) => c.trim()).filter(Boolean)
    const nums = priceNums(cells)
    if (!nums.length) return
    const label = cells.find((c) => /[a-zA-Z]{3,}/.test(c)) || 'Extra'
    extras.push({
      extra_type: extraTypeFromLabel(label),
      label,
      qty: 1,
      unit_price: nums[0],
      mrp_price: nums.length > 1 ? nums[nums.length - 1] : null,
      confidence: 'low',
    })
  })

  return {
    currency: detectCurrency(haystack),
    quoted_price: labeledMoney(haystack, /(?:quoted|offer|our price|unit price)/i),
    mrp_price: labeledMoney(haystack, /(?:\bmrp\b|list price|msrp)/i),
    shipping_fee: labeledMoney(haystack, /(?:shipping|freight|delivery fee)/i),
    tax_fee: labeledMoney(haystack, /(?:\btax\b|\bgst\b|\bvat\b)/i),
    other_fees: null,
    lead_time_days: leadTime(haystack),
    quote_valid_until: validUntil(haystack),
    notes: null,
    line_items,
    extras: extras.slice(0, 8),
    source: 'heuristic',
  }
}

export function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fence ? fence[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('No JSON object')
  return JSON.parse(raw.slice(start, end + 1))
}

export function asMapped(raw: unknown, cart: CartSpec[]): ParseQuotationResult {
  const o = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {}
  const byId = new Map<string, MappedLine>()
  const rows = Array.isArray(o.line_items) ? o.line_items : []
  for (const row of rows) {
    const r = row as Record<string, unknown>
    const id = String(r.id || '')
    if (!id) continue
    let alt: MappedAlternative | null = null
    if (r.alternative && typeof r.alternative === 'object') {
      const a = r.alternative as Record<string, unknown>
      const brand = String(a.brand || '').trim()
      const device_model = String(a.device_model || '').trim()
      if (brand || device_model) {
        alt = {
          brand,
          device_model,
          processor: a.processor != null && String(a.processor).trim() ? String(a.processor).trim() : null,
          ram: a.ram != null && String(a.ram).trim() ? String(a.ram).trim() : null,
          storage: a.storage != null && String(a.storage).trim() ? String(a.storage).trim() : null,
        }
      }
    }
    byId.set(id, {
      id,
      unit_price: money(r.unit_price),
      mrp_price: money(r.mrp_price),
      confidence: r.confidence === 'high' ? 'high' : 'low',
      alternative: alt,
    })
  }
  const line_items = cart.map((c) => byId.get(c.id) || {
    id: c.id,
    unit_price: null,
    mrp_price: null,
    confidence: 'low' as const,
  })
  const extras: MappedExtra[] = []
  if (Array.isArray(o.extras)) {
    for (const row of o.extras) {
      const r = row as Record<string, unknown>
      const label = String(r.label || '').trim()
      const unit = money(r.unit_price)
      if (!label || unit == null) continue
      const t = String(r.extra_type || '').toLowerCase()
      extras.push({
        extra_type: (['applecare', 'warranty', 'accessory', 'other'] as const).includes(t as MappedExtra['extra_type'])
          ? t as MappedExtra['extra_type']
          : extraTypeFromLabel(label),
        label,
        qty: Math.max(1, Number(r.qty) || 1),
        unit_price: unit,
        mrp_price: money(r.mrp_price),
        confidence: r.confidence === 'high' ? 'high' : 'low',
      })
    }
  }
  const until = o.quote_valid_until != null ? String(o.quote_valid_until).slice(0, 10) : null
  return {
    currency: o.currency ? String(o.currency).toUpperCase().slice(0, 3) : null,
    quoted_price: money(o.quoted_price),
    mrp_price: money(o.mrp_price),
    shipping_fee: money(o.shipping_fee),
    tax_fee: money(o.tax_fee),
    other_fees: money(o.other_fees),
    lead_time_days: (() => {
      if (o.lead_time_days == null || o.lead_time_days === '') return null
      const n = Number(o.lead_time_days)
      return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
    })(),
    quote_valid_until: until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : null,
    notes: o.notes != null && String(o.notes).trim() ? String(o.notes).trim().slice(0, 2000) : null,
    line_items,
    extras: extras.slice(0, 12),
    source: 'claude',
  }
}

export function crudePdfText(bytes: Uint8Array): string {
  let latin1 = ''
  const max = Math.min(bytes.length, 4_000_000)
  for (let i = 0; i < max; i++) latin1 += String.fromCharCode(bytes[i])
  const chunks: string[] = []
  const re = /\(((?:\\.|[^\\)]){2,})\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(latin1))) {
    const inner = m[1]
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\(\d{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    if (/[A-Za-z0-9]/.test(inner)) chunks.push(inner)
  }
  return chunks.join(' ').replace(/\s+/g, ' ').trim()
}

export function looksLikePdf(bytes: Uint8Array, fileName: string, contentType: string): boolean {
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return true
  const name = fileName.toLowerCase()
  const mime = contentType.toLowerCase()
  return name.endsWith('.pdf') || mime.includes('pdf')
}

export function sniffImageMedia(
  bytes: Uint8Array,
  fileName: string,
  contentType: string,
): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (
    bytes.length >= 12
    && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
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

export const MAP_SYSTEM =
  'You map a vendor quotation extract onto an RFQ cart. Prefer unit price over line totals. Treat MRP/list/MSRP as mrp_price and the offered/quoted rate as unit_price. Never invent prices that are not in the extract. Return JSON only.'

export function mapUserPrompt(excerpt: string, cartJson: string): string {
  return `RFQ CART (use these ids exactly):\n${cartJson}\n\nQUOTATION EXTRACT:\n${excerpt}\n\nReturn ONLY this JSON:\n{
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
- Dates ISO YYYY-MM-DD. Currency ISO code.`
}
