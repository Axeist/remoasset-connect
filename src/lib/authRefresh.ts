import { supabase } from '@/integrations/supabase/client';

const REFRESH_COOLDOWN_MS = 60_000; // 1 minute after any failure
const RATE_LIMIT_COOLDOWN_MS = 120_000; // 2 minutes after 429

let lastFailedAt = 0;
let lastRateLimitAt = 0;

/**
 * Refresh the Supabase session with cooldown to avoid 429 (Too Many Requests).
 * Use this instead of calling supabase.auth.refreshSession() directly when
 * you need a fresh token (e.g. after Gmail/Calendar 401 or in Admin).
 */
export async function refreshSessionWithCooldown(): Promise<{
  data: Awaited<ReturnType<typeof supabase.auth.getSession>>['data'];
  error: { message: string; status?: number } | null;
}> {
  const now = Date.now();
  if (now - lastRateLimitAt < RATE_LIMIT_COOLDOWN_MS) {
    return {
      data: { session: null, user: null },
      error: { message: 'Rate limited. Please wait a minute and try again.', status: 429 },
    };
  }
  if (now - lastFailedAt < REFRESH_COOLDOWN_MS) {
    const { data } = await supabase.auth.getSession();
    return {
      data: { session: data.session, user: data.session?.user ?? null },
      error: null,
    };
  }

  const { data, error } = await supabase.auth.refreshSession();

  if (error) {
    lastFailedAt = now;
    const status = (error as { status?: number })?.status;
    if (status === 429 || /rate limit|too many requests/i.test(error.message || '')) {
      lastRateLimitAt = now;
    }
    return { data: { session: null, user: null }, error: { message: error.message, status } };
  }

  return { data: { session: data.session, user: data.user }, error: null };
}
