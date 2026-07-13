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
