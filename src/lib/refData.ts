import { supabase } from '@/integrations/supabase/client';

/**
 * Shared, short-lived cache for reference data that almost every page needs
 * (lead statuses, countries, team profiles). One request per kind per 5 minutes
 * instead of one per page visit and dialog open.
 */
const TTL_MS = 5 * 60 * 1000;
type Entry<T> = { at: number; promise: Promise<T> };
const cache = new Map<string, Entry<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = load().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

export function invalidateRefData(kind?: 'statuses' | 'countries' | 'profiles') {
  if (kind) cache.delete(kind);
  else cache.clear();
}

export function getStatuses() {
  return cached('statuses', async () => {
    const { data, error } = await supabase.from('lead_statuses').select('id, name, color, sort_order').order('sort_order');
    if (error) throw error;
    return data ?? [];
  });
}

export function getCountries() {
  return cached('countries', async () => {
    const { data, error } = await supabase.from('countries').select('id, name, code, region').order('name');
    if (error) throw error;
    return data ?? [];
  });
}

export function getProfiles() {
  return cached('profiles', async () => {
    const { data, error } = await supabase.from('profiles').select('user_id, full_name');
    if (error) throw error;
    return data ?? [];
  });
}
