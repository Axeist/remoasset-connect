import { supabase } from '@/integrations/supabase/client';

async function functionErrorMessage(error: unknown, data: unknown): Promise<string> {
  const fromBody = (data as { error?: unknown } | null)?.error;
  if (typeof fromBody === 'string' && fromBody.trim()) return fromBody;

  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === 'function') {
    try {
      const json = await context.clone().json();
      if (typeof json?.error === 'string' && json.error.trim()) return json.error;
    } catch {
      /* ignore */
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Request failed';
}

export async function invokeEdgeFunction<T = Record<string, unknown>>(
  name: string,
  options?: { body?: Record<string, unknown>; method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' },
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, options);
  if (error || (data && typeof data === 'object' && 'error' in data && (data as { error?: unknown }).error)) {
    throw new Error(await functionErrorMessage(error, data));
  }
  return (data ?? {}) as T;
}
