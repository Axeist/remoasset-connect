import { useState } from 'react';
import {
  PhoneIncoming, PhoneOutgoing, Clock, User, Hash, Tags, StickyNote,
  ExternalLink, ChevronDown, Sparkles, AudioLines, Voicemail, ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { safeFormat } from '@/lib/date';
import { extractCloudTalkMeta, type CloudTalkCallMeta } from '@/lib/cloudtalk';

function formatDuration(sec: number | null | undefined): string {
  if (sec == null || sec < 0) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function displayPhone(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const d = raw.replace(/[^0-9]/g, '');
  if (!d) return raw;
  return raw.startsWith('+') ? raw : `+${d}`;
}

function humanOutcome(meta: CloudTalkCallMeta): string {
  if (meta.outcome) return meta.outcome;
  if (meta.isVoicemail) return 'Voicemail';
  const s = (meta.status ?? '').toLowerCase().replace(/[_-]+/g, ' ');
  const talked = (meta.talkingSeconds ?? 0) > 0;
  if (s.includes('voice')) return 'Voicemail';
  if (s.includes('answer') || s === 'completed') return talked ? 'Answered' : 'Completed';
  if (s.includes('miss') || s.includes('no answer')) return 'Missed';
  if (s.includes('busy')) return 'Busy';
  if (s.includes('cancel')) return 'Cancelled';
  if (s.includes('fail')) return 'Failed';
  if (s) return s.replace(/\b\w/g, (c) => c.toUpperCase());
  return talked ? 'Answered' : 'Missed';
}

function statusTone(outcome: string) {
  const s = outcome.toLowerCase();
  if (s.includes('answer') || s === 'completed') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400';
  if (s.includes('voice')) return 'bg-sky-500/15 text-sky-700 dark:text-sky-400';
  if (s.includes('miss') || s.includes('busy') || s.includes('cancel') || s.includes('fail')) {
    return 'bg-amber-500/15 text-amber-700 dark:text-amber-400';
  }
  return 'bg-muted text-muted-foreground';
}

function sentimentTone(raw: unknown): { label: string; className: string } | null {
  const text = typeof raw === 'string'
    ? raw
    : raw && typeof raw === 'object'
      ? String((raw as { sentiment?: string; overall?: string }).sentiment ?? (raw as { overall?: string }).overall ?? '')
      : '';
  if (!text) return null;
  const l = text.toLowerCase();
  if (l.includes('very positive')) return { label: text, className: 'bg-emerald-600/15 text-emerald-700' };
  if (l.includes('positive')) return { label: text, className: 'bg-emerald-500/15 text-emerald-700' };
  if (l.includes('very negative')) return { label: text, className: 'bg-red-600/15 text-red-700' };
  if (l.includes('negative')) return { label: text, className: 'bg-red-500/15 text-red-700' };
  return { label: text, className: 'bg-slate-500/15 text-slate-700' };
}

function ciText(ci: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!ci) return null;
  for (const k of keys) {
    const v = ci[k];
    if (!v) continue;
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      for (const kk of ['summary', 'text', 'content', 'url', 'link']) {
        if (typeof o[kk] === 'string' && (o[kk] as string).trim()) return o[kk] as string;
      }
    }
  }
  return null;
}

interface Props {
  description: string;
  attachments: { type: string; url: string; name?: string }[];
  compact?: boolean;
}

export function CloudTalkCallCard({ description, attachments, compact }: Props) {
  const meta = extractCloudTalkMeta(attachments);
  const [openTranscript, setOpenTranscript] = useState(false);
  if (!meta) {
    return <p className="text-sm text-foreground whitespace-pre-wrap">{description}</p>;
  }

  const inbound = meta.direction === 'inbound';
  const outcome = humanOutcome(meta);
  const storedAudio = [meta.recordingUrl, attachments.find((a) => a.name === 'Call recording')?.url]
    .find((u) => typeof u === 'string' && (u.includes('call-recordings') || u.includes('/storage/') || u.endsWith('.wav')));
  const playUrl = meta.recordingLink || (meta.url !== 'cloudtalk' ? meta.url : null) || meta.recordingUrl
    || attachments.find((a) => a.name === 'Call recording')?.url;
  const cloudTalkPlay = playUrl && playUrl !== 'cloudtalk' && !storedAudio ? playUrl : null;
  const sent = sentimentTone(meta.ci?.sentiment ?? meta.ci?.['overall-sentiment']);
  const summary = ciText(meta.ci, ['summary']);
  const smart = meta.ci?.['smart-notes'] ?? meta.ci?.smartNotes;
  const transcript = meta.ci?.transcription ?? meta.ci?.transcript;
  const analytics = ciText(meta.ci, ['details-link', 'link']);
  const from = displayPhone(meta.fromNumber || (inbound ? meta.externalNumber : meta.internalNumber));
  const to = displayPhone(meta.toNumber || (inbound ? meta.internalNumber : meta.externalNumber));
  const agent = meta.agentName || meta.agentEmail;

  return (
    <div
      className={cn(
        'rounded-xl border border-violet-500/20 overflow-hidden',
        'bg-gradient-to-br from-violet-500/[0.07] via-card to-indigo-500/[0.05]',
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 px-3 py-2 bg-violet-500/10 border-b border-violet-500/15">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-600 text-white shadow-sm">
          {inbound ? <PhoneIncoming className="h-3.5 w-3.5" /> : <PhoneOutgoing className="h-3.5 w-3.5" />}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          {inbound ? 'Inbound call' : 'Outbound call'}
        </span>
        <Badge className={cn('ml-auto border-0 text-[10px] font-semibold', statusTone(outcome))}>
          {outcome}
        </Badge>
      </div>

      <div className={cn('p-3 space-y-3', compact && 'p-2.5 space-y-2')}>
        <p className="text-sm font-medium text-foreground">
          {outcome}
          {meta.talkingSeconds != null ? ` · ${formatDuration(meta.talkingSeconds)} talk` : ''}
          {agent ? ` · ${agent}` : ''}
        </p>

        {(from || to) && (
          <div className="flex items-center gap-1.5 min-w-0 text-xs font-medium">
            <Hash className="h-3.5 w-3.5 text-violet-500 shrink-0" />
            <span className="truncate">{from || '—'}</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="truncate">{to || '—'}</span>
          </div>
        )}

        <div className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3')}>
          <Stat icon={Clock} label="Talk time" value={formatDuration(meta.talkingSeconds)} />
          {meta.waitingSeconds != null && meta.waitingSeconds > 0 && (
            <Stat icon={Clock} label="Wait" value={formatDuration(meta.waitingSeconds)} muted />
          )}
          {meta.wrapupSeconds != null && meta.wrapupSeconds > 0 && (
            <Stat icon={Clock} label="Wrap-up" value={formatDuration(meta.wrapupSeconds)} muted />
          )}
          {agent && <Stat icon={User} label="Agent" value={agent} />}
          {meta.contactName && <Stat icon={User} label="Contact" value={meta.contactName} />}
        </div>

        {meta.startedAt && (
          <p className="text-[11px] text-muted-foreground">
            {safeFormat(meta.startedAt, 'EEE, MMM d · h:mm a')}
            {meta.endedAt ? ` – ${safeFormat(meta.endedAt, 'h:mm a')}` : ''}
          </p>
        )}

        {meta.tags && meta.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <Tags className="h-3 w-3 text-violet-500" />
            {meta.tags.map((t) => (
              <span key={t} className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                {t}
              </span>
            ))}
          </div>
        )}

        {meta.notes && (
          <p className="text-xs text-muted-foreground flex gap-1.5">
            <StickyNote className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
            {meta.notes}
          </p>
        )}

        {storedAudio ? (
          <div className="rounded-lg border border-violet-500/15 bg-background/70 px-2.5 py-2">
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
              <AudioLines className="h-3.5 w-3.5" />
              Recording
            </div>
            <audio controls preload="none" className="w-full h-8">
              <source src={storedAudio} />
            </audio>
          </div>
        ) : cloudTalkPlay ? (
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-800 dark:text-violet-200 hover:bg-violet-500/15"
            onClick={() => {
              window.open(cloudTalkPlay, 'cloudtalk-recording', 'popup=yes,width=720,height=480,noopener');
            }}
          >
            <AudioLines className="h-3.5 w-3.5" />
            Play recording
          </button>
        ) : meta.recorded ? (
          <p className="text-[11px] text-muted-foreground italic flex items-center gap-1.5">
            <Voicemail className="h-3.5 w-3.5" />
            Recording is in CloudTalk (no play link on this event yet)
          </p>
        ) : null}

        {(sent || summary || smart) && (
          <div className="rounded-lg border border-border/60 bg-background/50 p-2.5 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              Conversation intelligence
              {sent && <Badge className={cn('ml-auto border-0 text-[10px] capitalize', sent.className)}>{sent.label}</Badge>}
            </div>
            {summary && <p className="text-xs text-foreground leading-relaxed">{summary}</p>}
            {smart && typeof smart === 'object' && (
              <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap font-sans">
                {JSON.stringify(smart, null, 2).slice(0, 800)}
              </pre>
            )}
          </div>
        )}

        {transcript && (
          <div>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 dark:text-violet-300"
              onClick={() => setOpenTranscript((v) => !v)}
            >
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openTranscript && 'rotate-180')} />
              Transcript
            </button>
            {openTranscript && (
              <pre className="mt-1.5 max-h-48 overflow-auto rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground whitespace-pre-wrap font-sans">
                {typeof transcript === 'string' ? transcript : JSON.stringify(transcript, null, 2)}
              </pre>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {meta.recordingLink && (
            <a
              href={meta.recordingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 dark:text-violet-300 hover:underline"
            >
              Open in CloudTalk <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {analytics && analytics.startsWith('http') && (
            <a
              href={analytics}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 dark:text-violet-300 hover:underline"
            >
              Analytics <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {meta.callId && (
            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]" title={meta.callId}>
              ID {meta.callId}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  muted,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', muted ? 'text-muted-foreground' : 'text-violet-500')} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xs font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

export function CloudTalkCallCardCompact(props: Props) {
  return <CloudTalkCallCard {...props} compact />;
}
