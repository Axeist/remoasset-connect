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
  fromNumber?: string | null;
  toNumber?: string | null;
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
