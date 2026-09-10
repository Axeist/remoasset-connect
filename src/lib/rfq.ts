import { CLOSED_STATUS_PATTERNS } from '@/types/rfq';
import type { VendorType } from '@/lib/vendorTypes';
import { discountVsMrp } from '@/lib/mrp-insights';

export type MatchableVendor = {
  id: string;
  company_name: string;
  email: string | null;
  country_ids: string[];
  hq_country_id?: string | null;
  vendor_types?: string[] | null;
  status_name?: string | null;
};

export function isClosedStatusName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  if (lower === 'won' || lower === 'closed' || lower === 'closed won' || lower === 'closed-won') return true;
  return lower.startsWith('closed won');
}

export function vendorHasAnyType(vendor: MatchableVendor, types: string[]): boolean {
  if (!types.length) return false;
  const vt = vendor.vendor_types ?? [];
  return types.some((t) => vt.includes(t));
}

export function vendorOperatesInCountry(vendor: MatchableVendor, countryId: string): boolean {
  if (!countryId) return false;
  if (vendor.hq_country_id === countryId) return true;
  return (vendor.country_ids ?? []).includes(countryId);
}

/** Closed + country + overlapping vendor types + email present */
export function matchRfqVendors(
  vendors: MatchableVendor[],
  countryId: string,
  targetTypes: string[],
): MatchableVendor[] {
  return vendors
    .filter((v) => isClosedStatusName(v.status_name))
    .filter((v) => vendorOperatesInCountry(v, countryId))
    .filter((v) => vendorHasAnyType(v, targetTypes))
    .filter((v) => !!(v.email && v.email.includes('@')))
    .sort((a, b) => a.company_name.localeCompare(b.company_name));
}

export function defaultVendorTypesForRfqType(
  rfqType: 'fulfillment' | 'retrieval_redeployment' | 'itad',
): VendorType[] {
  if (rfqType === 'fulfillment') return ['new_device'];
  if (rfqType === 'retrieval_redeployment') return ['warehouse', 'itad'];
  return ['itad'];
}

export function computeBidPricing(input: {
  quotedPrice: number;
  mrpPrice: number | null;
  shippingFee?: number;
  taxFee?: number;
  otherFees?: number;
}) {
  const shipping = input.shippingFee ?? 0;
  const tax = input.taxFee ?? 0;
  const other = input.otherFees ?? 0;
  const totalLanded = input.quotedPrice + shipping + tax + other;
  const disc =
    input.mrpPrice != null && input.mrpPrice > 0
      ? discountVsMrp(input.mrpPrice, input.quotedPrice)
      : null;
  return {
    discount_pct: disc ? Math.round(disc.pctOffMrp * 100) / 100 : null,
    discount_amount: disc ? Math.round(disc.savingsUsd * 100) / 100 : null,
    total_landed: Math.round(totalLanded * 100) / 100,
  };
}

export function isRfqSealed(rfq: {
  sealed_until: string | null;
  unsealed_at: string | null;
  deadline: string;
}): boolean {
  if (rfq.unsealed_at) return false;
  const until = rfq.sealed_until ?? rfq.deadline;
  return new Date(until).getTime() > Date.now();
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  if (ms < 0) return new Date(iso).toLocaleString();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatCountdown(deadlineIso: string): string {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (ms <= 0) return '0h';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days >= 2) return `${days}d`;
  if (hours >= 1) return `${hours}h`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}m`;
}

export function campaignRollups(recipients: { status: string }[]) {
  const sent = recipients.filter((r) =>
    ['sent', 'opened', 'quoted', 'declined', 'bounced', 'no_response'].includes(r.status),
  ).length;
  const opened = recipients.filter((r) =>
    ['opened', 'quoted', 'declined'].includes(r.status),
  ).length;
  const quoted = recipients.filter((r) => r.status === 'quoted').length;
  const declined = recipients.filter((r) => r.status === 'declined').length;
  const bounced = recipients.filter((r) => r.status === 'bounced').length;
  const noResponse = recipients.filter((r) => r.status === 'no_response').length;
  return { sent, opened, quoted, declined, bounced, noResponse, total: recipients.length };
}

export type RfqCartLine = {
  id?: string;
  brand?: string;
  device_model?: string;
  quantity?: number;
  category?: string;
  processor?: string | null;
  ram?: string | null;
  storage?: string | null;
  addons?: { id?: string; type?: string; model?: string; qty?: number }[];
  notes?: string | null;
};

export const EXTRA_TYPES = ['applecare', 'warranty', 'accessory', 'other'] as const;
export type ExtraType = (typeof EXTRA_TYPES)[number];

export type BidAlternativeSpec = {
  brand?: string;
  device_model?: string;
  processor?: string | null;
  ram?: string | null;
  storage?: string | null;
};

export type BidQuoteLine = {
  id: string;
  unit_price: number;
  mrp_price: number | null;
  kind?: 'device' | 'addon' | 'extra';
  qty?: number;
  label?: string;
  extra_type?: ExtraType;
  alternative?: BidAlternativeSpec | null;
};

export function extraTypeLabel(t: ExtraType | string | undefined): string {
  if (t === 'applecare') return 'AppleCare';
  if (t === 'warranty') return 'Warranty';
  if (t === 'accessory') return 'Accessory';
  return 'Other';
}

export function parseExtraType(raw: unknown): ExtraType {
  const t = String(raw || '').toLowerCase();
  return (EXTRA_TYPES as readonly string[]).includes(t) ? (t as ExtraType) : 'other';
}

export function isExtraQuoteLine(q: Pick<BidQuoteLine, 'id' | 'kind'>): boolean {
  return q.kind === 'extra' || String(q.id).startsWith('extra::');
}

export function alternativeLabel(alt: BidAlternativeSpec | null | undefined): string {
  if (!alt) return '';
  const head = `${alt.brand || ''} ${alt.device_model || ''}`.trim() || 'Alternative';
  const bits = [head];
  if (alt.processor) bits.push(String(alt.processor));
  if (alt.ram) bits.push(String(alt.ram));
  if (alt.storage) bits.push(String(alt.storage));
  return bits.join(', ');
}

function extrasQuotedAmount(quotes: BidQuoteLine[]): number {
  let sum = 0;
  for (const q of quotes) {
    if (!isExtraQuoteLine(q)) continue;
    sum += q.unit_price * (Number(q.qty) || 1);
  }
  return sum;
}

function extrasMrpAmount(quotes: BidQuoteLine[]): { sum: number; any: boolean } {
  let sum = 0;
  let any = false;
  for (const q of quotes) {
    if (!isExtraQuoteLine(q) || q.mrp_price == null) continue;
    any = true;
    sum += q.mrp_price * (Number(q.qty) || 1);
  }
  return { sum, any };
}

export function addonQuoteId(
  line: RfqCartLine,
  addon: NonNullable<RfqCartLine['addons']>[number],
  index: number,
): string {
  if (addon.id) return String(addon.id);
  return `${line.id || 'line'}::addon::${index}`;
}

export function addonLabel(addon: NonNullable<RfqCartLine['addons']>[number]): string {
  return [addon.type, addon.model].filter((x) => (x || '').trim()).join(' — ') || 'Add-on';
}

export function quoteableCartRows(lines: RfqCartLine[]): { id: string; qty: number; kind: 'device' | 'addon' }[] {
  const rows: { id: string; qty: number; kind: 'device' | 'addon' }[] = [];
  for (const line of lines) {
    if (line.id) rows.push({ id: line.id, qty: Number(line.quantity) || 1, kind: 'device' });
    (line.addons || []).forEach((addon, i) => {
      if (!(addon.type || addon.model || '').trim()) return;
      rows.push({ id: addonQuoteId(line, addon, i), qty: Number(addon.qty) || 1, kind: 'addon' });
    });
  }
  return rows;
}

export function asRfqCartLines(raw: unknown): RfqCartLine[] {
  return Array.isArray(raw) ? (raw as RfqCartLine[]) : [];
}

function asAlternativeSpec(raw: unknown): BidAlternativeSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as BidAlternativeSpec;
  const brand = String(a.brand || '').trim();
  const device_model = String(a.device_model || '').trim();
  const processor = a.processor != null && String(a.processor).trim() ? String(a.processor).trim() : null;
  const ram = a.ram != null && String(a.ram).trim() ? String(a.ram).trim() : null;
  const storage = a.storage != null && String(a.storage).trim() ? String(a.storage).trim() : null;
  if (!brand && !device_model && !processor && !ram && !storage) return null;
  return { brand, device_model, processor, ram, storage };
}

export function asBidQuoteLines(raw: unknown): BidQuoteLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const r = row as BidQuoteLine;
      if (!r?.id) return null;
      const unit = Number(r.unit_price);
      if (!Number.isFinite(unit)) return null;
      const mrp = r.mrp_price == null ? null : Number(r.mrp_price);
      const kind = r.kind === 'addon' || r.kind === 'extra' || r.kind === 'device'
        ? r.kind
        : (String(r.id).startsWith('extra::') ? 'extra' : undefined);
      const qtyRaw = r.qty != null ? Number(r.qty) : undefined;
      return {
        id: String(r.id),
        unit_price: unit,
        mrp_price: mrp != null && Number.isFinite(mrp) ? mrp : null,
        kind,
        qty: qtyRaw != null && Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : undefined,
        label: r.label != null && String(r.label).trim() ? String(r.label).trim() : undefined,
        extra_type: kind === 'extra' ? parseExtraType(r.extra_type) : undefined,
        alternative: asAlternativeSpec(r.alternative),
      };
    })
    .filter((x): x is BidQuoteLine => x != null);
}

export function cartLineLabel(line: RfqCartLine): string {
  const head = `${line.brand || ''} ${line.device_model || ''}`.trim() || 'Item';
  const bits = [head];
  if (line.processor) bits.push(String(line.processor));
  if (line.ram) bits.push(String(line.ram));
  if (line.storage) bits.push(String(line.storage));
  return bits.join(', ');
}

export type BidLineView = {
  id: string;
  kind: 'device' | 'addon' | 'extra';
  requested: string | null;
  quoted: string;
  isAlternative: boolean;
  qty: number;
  unit_price: number;
  mrp_price: number | null;
};

export function describeBidQuoteLine(q: BidQuoteLine, cart: RfqCartLine[]): BidLineView {
  const isAlt = !!(q.alternative && (q.alternative.brand || q.alternative.device_model));
  if (isExtraQuoteLine(q)) {
    return {
      id: q.id,
      kind: 'extra',
      requested: null,
      quoted: `${extraTypeLabel(q.extra_type)} · ${q.label || 'Extra'}`,
      isAlternative: false,
      qty: Number(q.qty) || 1,
      unit_price: q.unit_price,
      mrp_price: q.mrp_price,
    };
  }
  const line = cart.find((c) => c.id === q.id);
  if (line) {
    return {
      id: q.id,
      kind: 'device',
      requested: cartLineLabel(line),
      quoted: isAlt ? alternativeLabel(q.alternative) : cartLineLabel(line),
      isAlternative: isAlt,
      qty: Number(line.quantity) || 1,
      unit_price: q.unit_price,
      mrp_price: q.mrp_price,
    };
  }
  for (const c of cart) {
    const addons = c.addons || [];
    for (let i = 0; i < addons.length; i++) {
      if (addonQuoteId(c, addons[i], i) !== q.id) continue;
      return {
        id: q.id,
        kind: 'addon',
        requested: addonLabel(addons[i]),
        quoted: addonLabel(addons[i]),
        isAlternative: false,
        qty: Number(addons[i].qty) || 1,
        unit_price: q.unit_price,
        mrp_price: q.mrp_price,
      };
    }
  }
  return {
    id: q.id,
    kind: q.kind === 'addon' ? 'addon' : 'device',
    requested: null,
    quoted: isAlt ? alternativeLabel(q.alternative) : q.id,
    isAlternative: isAlt,
    qty: Number(q.qty) || 1,
    unit_price: q.unit_price,
    mrp_price: q.mrp_price,
  };
}

export function bidLineViews(raw: unknown, cart: RfqCartLine[]): BidLineView[] {
  return asBidQuoteLines(raw).map((q) => describeBidQuoteLine(q, cart));
}

export type BidMatchKind = 'as_requested' | 'alternative' | 'mixed' | 'extras_only';

export function bidMatchKind(views: BidLineView[]): BidMatchKind {
  const devices = views.filter((v) => v.kind === 'device');
  const alt = devices.filter((v) => v.isAlternative).length;
  if (devices.length === 0) return views.some((v) => v.kind === 'extra') ? 'extras_only' : 'as_requested';
  if (alt === 0) return 'as_requested';
  if (alt === devices.length) return 'alternative';
  return 'mixed';
}

export function bidMatchLabel(kind: BidMatchKind): string {
  if (kind === 'alternative') return 'Alternative spec';
  if (kind === 'mixed') return 'Mixed specs';
  if (kind === 'extras_only') return 'Extras only';
  return 'As requested';
}

export function cartQuotedSubtotal(lines: RfqCartLine[], quotes: BidQuoteLine[]): number {
  const byId = new Map(quotes.map((q) => [q.id, q]));
  let sum = 0;
  for (const row of quoteableCartRows(lines)) {
    const q = byId.get(row.id);
    if (!q) continue;
    sum += q.unit_price * row.qty;
  }
  sum += extrasQuotedAmount(quotes);
  return Math.round(sum * 100) / 100;
}

export function cartMrpSubtotal(lines: RfqCartLine[], quotes: BidQuoteLine[]): number | null {
  const byId = new Map(quotes.map((q) => [q.id, q]));
  let sum = 0;
  let any = false;
  for (const row of quoteableCartRows(lines)) {
    const q = byId.get(row.id);
    if (!q || q.mrp_price == null) continue;
    any = true;
    sum += q.mrp_price * row.qty;
  }
  const extras = extrasMrpAmount(quotes);
  if (extras.any) {
    any = true;
    sum += extras.sum;
  }
  return any ? Math.round(sum * 100) / 100 : null;
}

/** Cart subtotal, or a legacy single quoted price, plus extra priced lines. */
export function quoteGoodsTotal(
  lines: RfqCartLine[],
  quotes: BidQuoteLine[],
  legacyQuoted?: number,
): number {
  if (lines.length > 0) return cartQuotedSubtotal(lines, quotes);
  const extras = extrasQuotedAmount(quotes);
  const base = Number.isFinite(legacyQuoted as number) ? (legacyQuoted as number) : 0;
  return Math.round((base + extras) * 100) / 100;
}

export function quoteMrpTotal(
  lines: RfqCartLine[],
  quotes: BidQuoteLine[],
  legacyMrp?: number | null,
): number | null {
  if (lines.length > 0) return cartMrpSubtotal(lines, quotes);
  const extras = extrasMrpAmount(quotes);
  const base = legacyMrp != null && Number.isFinite(legacyMrp) ? legacyMrp : null;
  if (base == null && !extras.any) return null;
  return Math.round(((base ?? 0) + extras.sum) * 100) / 100;
}
