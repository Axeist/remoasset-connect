/**
 * Matches spreadsheet logic: Profit ($) = Price quoted − Procurement;
 * Profit (%) = Profit ($) / Procurement × 100 (markup on cost).
 */
export function clientRequestProfit(procurementUsd: number, quotedUsd: number): {
  profitAmount: number;
  profitPctOnProcurement: number | null;
} | null {
  if (!Number.isFinite(procurementUsd) || !Number.isFinite(quotedUsd)) return null;
  const profitAmount = quotedUsd - procurementUsd;
  const profitPctOnProcurement =
    procurementUsd > 0 ? (profitAmount / procurementUsd) * 100 : null;
  return { profitAmount, profitPctOnProcurement };
}
