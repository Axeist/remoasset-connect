export type LineId = 'us' | 'sg' | 'uk' | 'unmapped';

export type DidSettings = {
  us: string | null;
  sg: string | null;
  uk: string | null;
};

export type CallRow = {
  id: string;
  lead_id: string | null;
  connect_user_id: string | null;
  direction: string | null;
  status: string | null;
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  waiting_seconds: number | null;
  wrapup_seconds: number | null;
  started_at: string | null;
  created_at: string;
  is_voicemail: boolean | null;
};

export const LINE_META: Record<Exclude<LineId, 'unmapped'>, { id: LineId; label: string; flag: string; color: string; short: string }> = {
  us: { id: 'us', label: 'United States', flag: '🇺🇸', color: '#3B82F6', short: 'US' },
  sg: { id: 'sg', label: 'Singapore', flag: '🇸🇬', color: '#F59E0B', short: 'SG' },
  uk: { id: 'uk', label: 'United Kingdom', flag: '🇬🇧', color: '#8B5CF6', short: 'UK' },
};

export const LINES: Exclude<LineId, 'unmapped'>[] = ['us', 'sg', 'uk'];

export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? '').replace(/[^0-9]/g, '');
}

export function companyDid(call: Pick<CallRow, 'direction' | 'from_number' | 'to_number'>): string | null {
  const inbound = (call.direction ?? '').toLowerCase().includes('in');
  return inbound ? call.to_number : call.from_number;
}

function digitsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 8 && b.length >= 8 && (a.endsWith(b) || b.endsWith(a))) return true;
  return false;
}

export function lineForCall(call: CallRow, dids: DidSettings): LineId {
  const d = phoneDigits(companyDid(call));
  if (!d) return 'unmapped';
  const us = phoneDigits(dids.us);
  const sg = phoneDigits(dids.sg);
  const uk = phoneDigits(dids.uk);
  if (us && digitsMatch(d, us)) return 'us';
  if (sg && digitsMatch(d, sg)) return 'sg';
  if (uk && digitsMatch(d, uk)) return 'uk';
  if (d.startsWith('65')) return 'sg';
  if (d.startsWith('44')) return 'uk';
  if (d.startsWith('1') && d.length >= 11) return 'us';
  return 'unmapped';
}

export function isAnswered(call: CallRow): boolean {
  if (call.is_voicemail) return false;
  if ((call.duration_seconds ?? 0) > 0) return true;
  const s = (call.status ?? '').toLowerCase();
  return s.includes('answer') || s === 'completed';
}

export function talkSeconds(call: CallRow): number {
  if (!isAnswered(call)) return 0;
  return Math.max(0, call.duration_seconds ?? 0);
}

export function callOutcome(call: CallRow): 'answered' | 'missed' | 'voicemail' | 'busy' {
  if (call.is_voicemail) return 'voicemail';
  const s = (call.status ?? '').toLowerCase();
  if (s.includes('busy')) return 'busy';
  if (isAnswered(call)) return 'answered';
  return 'missed';
}

export function formatTalk(sec: number): string {
  if (!sec || sec < 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function callAt(call: CallRow): Date {
  return new Date(call.started_at || call.created_at);
}

export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};
