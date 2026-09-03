export type CloudTalkCallMeta = {
  type: 'cloudtalk_call';
  url: string;
  name?: string;
  callId?: string;
  direction?: string;
  status?: string;
  talkingSeconds?: number | null;
  waitingSeconds?: number | null;
  wrapupSeconds?: number | null;
  agentName?: string | null;
  agentEmail?: string | null;
  contactName?: string | null;
  fromNumber?: string | null;
  toNumber?: string | null;
  externalNumber?: string | null;
  internalNumber?: string | null;
  outcome?: string | null;
  startedAt?: string | null;
  answeredAt?: string | null;
  endedAt?: string | null;
  tags?: string[];
  notes?: string | null;
  recordingLink?: string | null;
  recordingUrl?: string | null;
  recorded?: boolean;
  isVoicemail?: boolean;
  insightsPending?: boolean;
  ci?: Record<string, unknown>;
};

export function extractCloudTalkMeta(
  attachments: { type: string; url: string; name?: string }[],
): CloudTalkCallMeta | null {
  const meta = attachments.find((a) => a.type === 'cloudtalk_call');
  if (meta) return meta as unknown as CloudTalkCallMeta;
  return null;
}

export function hasCloudTalkCall(attachments: { type: string; url: string; name?: string }[]): boolean {
  return attachments.some((a) => a.type === 'cloudtalk_call' || a.url === 'cloudtalk');
}

export async function fetchCloudTalkRecording(callId: string, download = false): Promise<Blob> {
  const { supabase } = await import('@/integrations/supabase/client');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const { data: { session } } = await supabase.auth.getSession();
  if (!supabaseUrl || !session?.access_token) throw new Error('Sign in to play recordings');
  const qs = new URLSearchParams({ call_id: callId });
  if (download) qs.set('download', '1');
  const res = await fetch(`${supabaseUrl}/functions/v1/cloudtalk-recording?${qs}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anon ?? '',
    },
  });
  const ct = res.headers.get('content-type') ?? '';
  if (!res.ok || ct.includes('json')) {
    const err = await res.json().catch(() => ({ error: 'Recording is not available yet' }));
    throw new Error((err as { error?: string }).error || 'Recording is not available yet');
  }
  return res.blob();
}

export async function recordCloudTalkDialIntent(leadId: string, phone: string, userId: string) {
  const { supabase } = await import('@/integrations/supabase/client');
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return;
  await supabase.from('cloudtalk_dial_intents' as never).insert({
    lead_id: leadId,
    user_id: userId,
    phone_digits: digits,
  } as never);
}
