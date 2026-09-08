/**
 * FX to USD: try Frankfurter (ECB), then open.er-api.com fallback (broader currency coverage).
 * Rate = multiply local amount by this to get USD.
 */
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { rate: number; date: string; via: string; at: number }>();

async function frankfurterRate(from: string): Promise<{ rate: number; date: string } | null> {
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?from=${encodeURIComponent(from)}&to=USD`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: { USD?: number }; date?: string };
    const usd = data.rates?.USD;
    if (usd == null || Number.isNaN(usd)) return null;
    return { rate: usd, date: data.date || new Date().toISOString().slice(0, 10) };
  } catch {
    return null;
  }
}

/** Open Exchange Rates public endpoint (no key). Field is `rates` (older payloads used conversion_rates). */
async function openErRate(from: string): Promise<{ rate: number; date: string } | null> {
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string;
      time_last_update_utc?: string;
      conversion_rates?: { USD?: number };
      rates?: { USD?: number };
    };
    if (data.result === 'error') return null;
    const usd = data.rates?.USD ?? data.conversion_rates?.USD;
    if (usd == null || Number.isNaN(usd)) return null;
    const date = data.time_last_update_utc
      ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    return { rate: usd, date };
  } catch {
    return null;
  }
}

/** Community daily JSON; covers INR and other codes ECB omits. */
async function currencyApiRate(from: string): Promise<{ rate: number; date: string } | null> {
  const code = from.toLowerCase();
  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${code}.json`,
    `https://latest.currency-api.pages.dev/v1/currencies/${code}.json`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as Record<string, unknown>;
      const table = data[code] as { usd?: number } | undefined;
      const usd = table?.usd;
      if (usd == null || Number.isNaN(Number(usd))) continue;
      const date = typeof data.date === 'string' ? data.date : new Date().toISOString().slice(0, 10);
      return { rate: Number(usd), date };
    } catch {
      /* try next */
    }
  }
  return null;
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

  const er = await openErRate(from);
  if (er) {
    cache.set(from, { rate: er.rate, date: er.date, via: 'open.er-api.com', at: now });
    return { ...er, source: 'open.er-api.com' };
  }

  const frank = await frankfurterRate(from);
  if (frank) {
    cache.set(from, { rate: frank.rate, date: frank.date, via: 'Frankfurter (ECB)', at: now });
    return { ...frank, source: 'Frankfurter (ECB)' };
  }

  const community = await currencyApiRate(from);
  if (community) {
    cache.set(from, { rate: community.rate, date: community.date, via: 'currency-api', at: now });
    return { ...community, source: 'currency-api' };
  }

  throw new Error(`No USD rate for ${from}. Try USD or another major currency.`);
}

export function convertToUsd(localAmount: number, rateToUsd: number): number {
  if (!Number.isFinite(localAmount) || !Number.isFinite(rateToUsd)) return 0;
  return localAmount * rateToUsd;
}
