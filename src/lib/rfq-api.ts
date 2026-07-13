import { supabase } from '@/integrations/supabase/client';

async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  const { data: refreshed } = await supabase.auth.refreshSession();
  return refreshed.session?.access_token ?? null;
}

async function invokeErrorMessage(error: { message?: string }, data: unknown): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
    return String((data as { error: string }).error);
  }
  const ctx = (error as { context?: Response }).context;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const body = await ctx.json();
      if (body?.error) return String(body.error);
      if (body?.detail) return String(body.detail);
    } catch {
      /* ignore */
    }
  }
  return error.message || 'RFQ function failed';
}

export async function invokeRfqCampaign(body: Record<string, unknown>) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    throw new Error('Not signed in — refresh the page and try again.');
  }
  const res = await supabase.functions.invoke('rfq-campaign', {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.error) {
    throw new Error(await invokeErrorMessage(res.error, res.data));
  }
  if (res.data?.error) {
    throw new Error(res.data.error);
  }
  return res.data;
}

/** Public (no session) calls via fetch + anon key */
export async function invokeRfqPublic(body: Record<string, unknown>) {
  const url = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/rfq-campaign`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  if (data.error) throw new Error(data.error);
  return data;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
