/** Discount vs MRP: how much below list price (USD and % of MRP). */
export function discountVsMrp(mrpUsd: number, dealPriceUsd: number): { savingsUsd: number; pctOffMrp: number } | null {
  if (!Number.isFinite(mrpUsd) || !Number.isFinite(dealPriceUsd) || mrpUsd <= 0) return null;
  const savingsUsd = mrpUsd - dealPriceUsd;
  const pctOffMrp = (savingsUsd / mrpUsd) * 100;
  return { savingsUsd, pctOffMrp };
}

/** Client quoted as % of MRP (e.g. 85 means paying 85% of list). */
export function quotedPctOfMrp(mrpUsd: number, quotedUsd: number): number | null {
  if (!Number.isFinite(mrpUsd) || !Number.isFinite(quotedUsd) || mrpUsd <= 0) return null;
  return (quotedUsd / mrpUsd) * 100;
}
