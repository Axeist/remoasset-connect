import type { ClientRequestType } from '@/types/procurement';

export type ClientRequestProfitResult = {
  profitAmount: number;
  profitPctOnProcurement: number | null;
  totalCost: number;
};

/**
 * Profit ($) = quoted − total cost.
 * Profit (%) = profit / total cost × 100, capped at 100%.
 * When total cost is 0, profit = quoted and margin = 100%.
 */
function buildClientRequestProfit(quotedUsd: number, totalCost: number): ClientRequestProfitResult | null {
  if (!Number.isFinite(quotedUsd)) return null;

  if (totalCost <= 0) {
    return {
      profitAmount: quotedUsd,
      profitPctOnProcurement: 100,
      totalCost: 0,
    };
  }

  const profitAmount = quotedUsd - totalCost;
  const rawPct = (profitAmount / totalCost) * 100;
  const profitPctOnProcurement = Math.min(100, rawPct);

  return { profitAmount, profitPctOnProcurement, totalCost };
}

/**
 * Matches spreadsheet logic for service-style inputs (landing + service).
 */
export function clientRequestProfit(
  landingUsd: number,
  quotedUsd: number,
  serviceCostUsd?: number | null,
): ClientRequestProfitResult | null {
  const landing = Number.isFinite(landingUsd) ? landingUsd : 0;
  const service = serviceCostUsd != null && Number.isFinite(serviceCostUsd) ? serviceCostUsd : 0;
  return buildClientRequestProfit(quotedUsd, landing + service);
}

/** Fulfillment uses landing only; service requests include service fees. Wire is informational. */
export function clientRequestTotalCostUsd(
  requestType: ClientRequestType | string | null | undefined,
  landingUsd: number | null | undefined,
  serviceCostUsd?: number | null,
): number {
  const landing = landingUsd != null && Number.isFinite(Number(landingUsd)) ? Number(landingUsd) : 0;
  const service = serviceCostUsd != null && Number.isFinite(Number(serviceCostUsd)) ? Number(serviceCostUsd) : 0;
  const type = requestType ?? 'fulfillment';
  if (type === 'fulfillment') return landing;
  return landing + service;
}

export function clientRequestProfitFromRequest(
  quotedUsd: number | null | undefined,
  landingUsd: number | null | undefined,
  serviceCostUsd?: number | null,
  requestType?: ClientRequestType | string | null,
): ClientRequestProfitResult | null {
  if (quotedUsd == null) return null;
  const totalCost = clientRequestTotalCostUsd(requestType, landingUsd, serviceCostUsd);
  return buildClientRequestProfit(Number(quotedUsd), totalCost);
}

/** Per-unit profit multiplied by line quantity. */
export function clientRequestLineProfitUsd(
  req: {
    request_type?: ClientRequestType | string | null;
    client_price_usd: number | null;
    vendor_price_usd: number | null;
    service_cost_usd?: number | null;
    quantity: number;
  },
): number | null {
  const p = clientRequestProfitFromRequest(
    req.client_price_usd,
    req.vendor_price_usd,
    req.service_cost_usd,
    req.request_type,
  );
  if (!p) return null;
  return p.profitAmount * req.quantity;
}
