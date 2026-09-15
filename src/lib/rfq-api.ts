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
export async function invokeRfqPublic(
  body: Record<string, unknown>,
  opts?: { signal?: AbortSignal; timeoutMs?: number },
) {
  const url = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')}/functions/v1/rfq-campaign`;
  const timeoutMs = opts?.timeoutMs;
  const timeoutCtrl = timeoutMs ? new AbortController() : null;
  const timer = timeoutMs ? setTimeout(() => timeoutCtrl!.abort(), timeoutMs) : null;
  const onUserAbort = () => timeoutCtrl?.abort();
  if (opts?.signal && timeoutCtrl) {
    if (opts.signal.aborted) timeoutCtrl.abort();
    else opts.signal.addEventListener('abort', onUserAbort, { once: true });
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body),
      signal: timeoutCtrl?.signal ?? opts?.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || data.detail || data.message || res.statusText);
    if (data.error) throw new Error(data.error);
    return data;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(opts?.signal?.aborted ? 'Cancelled' : 'Reading quotation timed out. Enter prices below.');
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
    opts?.signal?.removeEventListener('abort', onUserAbort);
  }
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Reads a quotation via the public rfq-campaign function (token-gated). */
export async function parsePartnerQuotation(opts: {
  token: string;
  fileBase64: string;
  fileName: string;
  contentType: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}) {
  return invokeRfqPublic(
    {
      action: 'parse_quotation',
      token: opts.token,
      file_base64: opts.fileBase64,
      file_name: opts.fileName,
      file_content_type: opts.contentType,
    },
    { signal: opts.signal, timeoutMs: opts.timeoutMs ?? 45_000 },
  );
}
