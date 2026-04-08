/**
 * FX to USD: try Frankfurter (ECB), then open.er-api.com fallback (broader currency coverage).
 * Rate = multiply local amount by this to get USD.
 */
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { rate: number; date: string; via: string; at: number }>();

async function frankfurterRate(from: string): Promise<{ rate: number; date: string } | null> {
  const urls = [
    `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(from)}&to=USD`,
    `https://api.frankfurter.app/v1/latest?from=${encodeURIComponent(from)}&to=USD`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as { rates?: { USD?: number }; date?: string };
      const usd = data.rates?.USD;
      if (usd != null && !Number.isNaN(usd)) {
        return { rate: usd, date: data.date || new Date().toISOString().slice(0, 10) };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Open Exchange Rates public endpoint (no key); supports many ISO 4217 codes including BHD. */
async function openErRate(from: string): Promise<{ rate: number; date: string } | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string; time_last_update_utc?: string; conversion_rates?: { USD?: number } };
    if (data.result === 'error') return null;
    const usd = data.conversion_rates?.USD;
    if (usd == null || Number.isNaN(usd)) return null;
    const date = data.time_last_update_utc
      ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return { rate: usd, date };
  } catch {
    return null;
  }
}

export async function getRateToUsd(fromCurrency: string): Promise<{ rate: number; date: string; source: string }> {
  const from = fromCurrency.trim().toUpperCase();
  if (from === 'USD') {
    return { rate: 1, date: new Date().toISOString().slice(0, 10), source: 'USD' };
  }

  const now = Date.now();
  const hit = cache.get(from);
  if (hit && now - hit.at < CACHE_MS) {
    return { rate: hit.rate, date: hit.date, source: hit.via };
  }

  const frank = await frankfurterRate(from);
  if (frank) {
    cache.set(from, { rate: frank.rate, date: frank.date, via: 'Frankfurter (ECB)', at: now });
    return { ...frank, source: 'Frankfurter (ECB)' };
  }

  const er = await openErRate(from);
  if (er) {
    cache.set(from, { rate: er.rate, date: er.date, via: 'open.er-api.com', at: now });
    return { ...er, source: 'open.er-api.com' };
  }

  throw new Error(`No USD rate for ${from}. Try USD or another major currency.`);
}

export function convertToUsd(localAmount: number, rateToUsd: number): number {
  if (!Number.isFinite(localAmount) || !Number.isFinite(rateToUsd)) return 0;
  return localAmount * rateToUsd;
}
