/**
 * Live FX via Frankfurter (ECB-based), no API key. Rates: 1 unit of `from` = rate USD.
 */
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { rate: number; at: number }>();

export async function getRateToUsd(fromCurrency: string): Promise<{ rate: number; date: string }> {
  const from = fromCurrency.trim().toUpperCase();
  if (from === 'USD') return { rate: 1, date: new Date().toISOString().slice(0, 10) };

  const now = Date.now();
  const hit = cache.get(from);
  if (hit && now - hit.at < CACHE_MS) {
    return { rate: hit.rate, date: new Date().toISOString().slice(0, 10) };
  }

  const url = `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(from)}&to=USD`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`FX request failed (${res.status})`);
  }
  const data = (await res.json()) as { rates?: { USD?: number }; date?: string };
  const usd = data.rates?.USD;
  if (usd == null || Number.isNaN(usd)) {
    throw new Error(`No USD rate for ${from}`);
  }
  cache.set(from, { rate: usd, at: now });
  return { rate: usd, date: data.date || new Date().toISOString().slice(0, 10) };
}

export function convertToUsd(localAmount: number, rateToUsd: number): number {
  if (!Number.isFinite(localAmount) || !Number.isFinite(rateToUsd)) return 0;
  return localAmount * rateToUsd;
}
