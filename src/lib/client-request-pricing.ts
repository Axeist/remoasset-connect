/**
 * Matches spreadsheet logic: Profit ($) = Price quoted − total cost;
 * Profit (%) = Profit ($) / total cost × 100 (markup on cost).
 * Total cost = landing (vendor_price_usd) + service (service_cost_usd).
 */
export function clientRequestProfit(
  landingUsd: number,
  quotedUsd: number,
  serviceCostUsd?: number | null,
): {
  profitAmount: number;
  profitPctOnProcurement: number | null;
  totalCost: number;
} | null {
  if (!Number.isFinite(quotedUsd)) return null;
  const landing = Number.isFinite(landingUsd) ? landingUsd : 0;
  const service = serviceCostUsd != null && Number.isFinite(serviceCostUsd) ? serviceCostUsd : 0;
  const totalCost = landing + service;
  if (totalCost <= 0) return null;
  const profitAmount = quotedUsd - totalCost;
  const profitPctOnProcurement = (profitAmount / totalCost) * 100;
  return { profitAmount, profitPctOnProcurement, totalCost };
}

export function clientRequestProfitFromRequest(
  quotedUsd: number | null | undefined,
  landingUsd: number | null | undefined,
  serviceCostUsd?: number | null,
) {
  if (quotedUsd == null) return null;
  const landing = landingUsd != null ? Number(landingUsd) : 0;
  const service = serviceCostUsd != null ? Number(serviceCostUsd) : 0;
  if (landing + service <= 0) return null;
  return clientRequestProfit(landing, Number(quotedUsd), service);
}
