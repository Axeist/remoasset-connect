import { supabase } from '@/integrations/supabase/client';
import type { DeviceCategory, DeviceSpecFieldKey } from '@/constants/device-categories';
import { classifyRetailerHit } from '@/lib/reputable-retailers';

export type PublicPriceType = 'mrp' | 'msrp' | 'list' | 'street' | 'unknown';

export interface MrpLookupRequest {
  category: DeviceCategory;
  brand: string;
  model: string;
  country: string;
  country_code: string;
  specs: Partial<Record<DeviceSpecFieldKey, string>>;
}

export interface PublicPriceHit {
  retailer: string;
  title: string;
  url: string;
  currency: string;
  price: number;
  price_type: PublicPriceType;
  notes?: string;
  match_quality?: 'exact' | 'near';
}

export interface MrpLookupSummary {
  currency: string | null;
  range_from: number | null;
  range_to: number | null;
  listing_count: number;
  confidence: number;
  range_basis?: 'exact' | 'nearby';
}

export interface MrpLookupResponse {
  summary: MrpLookupSummary;
  results: PublicPriceHit[];
  search_queries_used: string[];
  token_usage?: {
    model: string;
    input_tokens: number;
    output_tokens: number;
    input_cost_usd?: number;
    output_cost_usd?: number;
    total_cost_usd: number;
  };
  error?: string;
}

export const LOOKUP_MARKETS: { name: string; code: string; currency: string }[] = [
  { name: 'India', code: 'in', currency: 'INR' },
  { name: 'United States', code: 'us', currency: 'USD' },
  { name: 'United Kingdom', code: 'gb', currency: 'GBP' },
  { name: 'United Arab Emirates', code: 'ae', currency: 'AED' },
  { name: 'Singapore', code: 'sg', currency: 'SGD' },
  { name: 'Australia', code: 'au', currency: 'AUD' },
  { name: 'Canada', code: 'ca', currency: 'CAD' },
  { name: 'Germany', code: 'de', currency: 'EUR' },
  { name: 'France', code: 'fr', currency: 'EUR' },
  { name: 'Netherlands', code: 'nl', currency: 'EUR' },
  { name: 'Japan', code: 'jp', currency: 'JPY' },
  { name: 'South Korea', code: 'kr', currency: 'KRW' },
  { name: 'Philippines', code: 'ph', currency: 'PHP' },
  { name: 'Malaysia', code: 'my', currency: 'MYR' },
  { name: 'Indonesia', code: 'id', currency: 'IDR' },
  { name: 'Thailand', code: 'th', currency: 'THB' },
  { name: 'Vietnam', code: 'vn', currency: 'VND' },
  { name: 'Brazil', code: 'br', currency: 'BRL' },
  { name: 'Mexico', code: 'mx', currency: 'MXN' },
  { name: 'South Africa', code: 'za', currency: 'ZAR' },
  { name: 'Saudi Arabia', code: 'sa', currency: 'SAR' },
  { name: 'Colombia', code: 'co', currency: 'COP' },
];

const CURRENCY_BY_GL: Record<string, string> = Object.fromEntries(
  LOOKUP_MARKETS.map((m) => [m.code, m.currency]),
);

export function currencyForCountryCode(code: string): string {
  return CURRENCY_BY_GL[code.toLowerCase()] || 'USD';
}

export function formatPublicPrice(amount: number, currency: string | null, countryCode: string): string {
  const iso = (currency || currencyForCountryCode(countryCode)).toUpperCase();
  const locale = countryCode.toLowerCase() === 'in' ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: iso,
      maximumFractionDigits: iso === 'JPY' || iso === 'KRW' || iso === 'VND' || iso === 'IDR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${iso} ${amount.toLocaleString(locale)}`;
  }
}

export function formatUsdCost(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '$0.00';
  if (amount < 0.0001) return `$${amount.toFixed(6)}`;
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(4)}`;
}

export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString('en-US');
}

export function formatPriceRange(
  from: number | null,
  to: number | null,
  currency: string | null,
  countryCode: string,
): string {
  if (from == null && to == null) return 'No public prices found';
  if (from != null && to != null && from !== to) {
    return `${formatPublicPrice(from, currency, countryCode)} – ${formatPublicPrice(to, currency, countryCode)}`;
  }
  const only = from ?? to;
  return only != null ? formatPublicPrice(only, currency, countryCode) : 'No public prices found';
}

export function isMajorMarketplace(hit: PublicPriceHit, countryCode = 'us'): boolean {
  return classifyRetailerHit(hit, countryCode) !== 'other';
}

export function splitPublicPriceHits(hits: PublicPriceHit[], countryCode: string): {
  marketplaces: PublicPriceHit[];
  official: PublicPriceHit[];
  others: PublicPriceHit[];
} {
  const marketplaces: PublicPriceHit[] = [];
  const official: PublicPriceHit[] = [];
  const others: PublicPriceHit[] = [];
  for (const hit of hits) {
    const tier = classifyRetailerHit(hit, countryCode);
    if (tier === 'marketplace') marketplaces.push(hit);
    else if (tier === 'official') official.push(hit);
    else others.push(hit);
  }
  return { marketplaces, official, others };
}

export function splitExactNearby(hits: PublicPriceHit[]): {
  exact: PublicPriceHit[];
  nearby: PublicPriceHit[];
} {
  const exact: PublicPriceHit[] = [];
  const nearby: PublicPriceHit[] = [];
  for (const hit of hits) {
    (hit.match_quality === 'near' ? nearby : exact).push(hit);
  }
  return { exact, nearby };
}

export function rangeHitsForBanner(hits: PublicPriceHit[]): PublicPriceHit[] {
  const { exact, nearby } = splitExactNearby(hits);
  return exact.length ? exact : nearby;
}

export function rangeFromHits(hits: PublicPriceHit[]): { from: number | null; to: number | null; currency: string | null } {
  if (!hits.length) return { from: null, to: null, currency: null };
  const prices = hits.map((h) => h.price);
  return {
    from: Math.min(...prices),
    to: Math.max(...prices),
    currency: hits[0]?.currency || null,
  };
}

export interface MrpLookupHistoryRow {
  id: string;
  user_id: string;
  query: MrpLookupRequest;
  summary: MrpLookupSummary;
  results: PublicPriceHit[];
  token_usage: MrpLookupResponse['token_usage'] | null;
  created_at: string;
}

const HISTORY_TABLE = 'mrp_lookup_history';
const HISTORY_LIMIT = 30;

export async function loadLookupHistory(): Promise<MrpLookupHistoryRow[]> {
  const { data, error } = await supabase
    .from(HISTORY_TABLE as any)
    .select('id, user_id, query, summary, results, token_usage, created_at')
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw new Error(error.message);
  return (data as MrpLookupHistoryRow[]) || [];
}

export async function saveLookupHistory(
  userId: string,
  query: MrpLookupRequest,
  response: MrpLookupResponse,
): Promise<void> {
  const { error } = await supabase.from(HISTORY_TABLE as any).insert({
    user_id: userId,
    query,
    summary: response.summary,
    results: response.results,
    token_usage: response.token_usage ?? null,
  });
  if (error) throw new Error(error.message);

  const { data: extra } = await supabase
    .from(HISTORY_TABLE as any)
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(HISTORY_LIMIT, HISTORY_LIMIT + 50);
  const ids = ((extra as { id: string }[]) || []).map((r) => r.id);
  if (ids.length) {
    await supabase.from(HISTORY_TABLE as any).delete().in('id', ids);
  }
}

export async function deleteLookupHistory(id: string): Promise<void> {
  const { error } = await supabase.from(HISTORY_TABLE as any).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function clearLookupHistory(userId: string): Promise<void> {
  const { error } = await supabase.from(HISTORY_TABLE as any).delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export const PRICE_TYPE_LABEL: Record<PublicPriceType, string> = {
  mrp: 'MRP',
  msrp: 'MSRP',
  list: 'List',
  street: 'Street',
  unknown: 'Public',
};

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? null;
}

export async function invokeMrpLookup(body: MrpLookupRequest): Promise<MrpLookupResponse> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Not signed in — refresh the page and try again.');
  }

  const { data, error } = await supabase.functions.invoke('mrp-price-lookup', {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!error && data && !data.error) {
    return data as MrpLookupResponse;
  }

  const res = await fetch('/api/mrp-price-lookup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });
  const fallback = await res.json().catch(() => null);
  if (res.ok && fallback && !fallback.error) {
    return fallback as MrpLookupResponse;
  }

  const supabaseMessage = data?.error
    || (error as { message?: string })?.message
    || (fallback && typeof fallback === 'object' && 'error' in fallback ? String(fallback.error) : null);
  throw new Error(supabaseMessage || 'Price lookup failed');
}
