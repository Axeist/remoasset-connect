export const SLA_APPROACHING_RATIO = 0.8;

export interface StatusSla {
  id?: string;
  name: string;
  color?: string;
  sla_idle_days?: number | null;
  sla_stage_days?: number | null;
  sla_followup_intent?: string | null;
}

export interface LeadSlaClocks {
  last_activity_at?: string | null;
  status_changed_at?: string | null;
  created_at: string;
  status?: StatusSla | null;
}

export interface LeadSlaResult {
  idleDays: number;
  stageDays: number;
  idleLimit: number | null;
  stageLimit: number | null;
  idleBreached: boolean;
  stageBreached: boolean;
  approaching: boolean;
  breached: boolean;
  isTerminal: boolean;
  badge: string | null;
  tooltip: string;
  clock: 'idle' | 'stage' | null;
}

export const DEFAULT_FOLLOWUP_INTENTS: Record<string, string> = {
  new: 'First outreach; they have not been contacted yet. Introduce RemoAsset briefly and ask for a short call.',
  contacted: 'First touch already happened. Continue the conversation; do not re-introduce the company.',
  qualified: 'Fit is established. Push the next commercial step (call, pricing, or sample).',
  proposal: 'NDA or contract was sent; they have not signed yet. Polite nudge to review and sign.',
  negotiation:
    'They sent a rebuttal or redlines on the NDA. Address next step on those points; do not re-send the original intro or a fresh NDA as if unsigned.',
};

export function isTerminalStatus(name: string | null | undefined): boolean {
  const n = (name ?? '').toLowerCase();
  return n === 'won' || n === 'lost';
}

export function slaDaysOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function daysBetween(fromIso: string | null | undefined, fallbackIso: string, now = new Date()): number {
  const raw = fromIso || fallbackIso;
  const t = new Date(raw).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now.getTime() - t) / 86_400_000);
}

export function followupIntentForStatus(status: StatusSla | null | undefined): string {
  const custom = status?.sla_followup_intent?.trim();
  if (custom) return custom;
  const key = (status?.name ?? '').toLowerCase();
  return DEFAULT_FOLLOWUP_INTENTS[key] ?? 'Nudge the next step for this stage. Stay brief and specific.';
}

export function evaluateLeadSla(lead: LeadSlaClocks, now = new Date()): LeadSlaResult {
  const status = lead.status ?? null;
  const terminal = isTerminalStatus(status?.name);
  const idleDays = daysBetween(lead.last_activity_at, lead.created_at, now);
  const stageDays = daysBetween(lead.status_changed_at, lead.created_at, now);
  const idleLimit = terminal ? null : slaDaysOrNull(status?.sla_idle_days);
  const stageLimit = terminal ? null : slaDaysOrNull(status?.sla_stage_days);

  const idleBreached = idleLimit != null && idleDays > idleLimit;
  const stageBreached = stageLimit != null && stageDays > stageLimit;
  const idleApproaching =
    idleLimit != null && !idleBreached && idleDays >= idleLimit * SLA_APPROACHING_RATIO;
  const stageApproaching =
    stageLimit != null && !stageBreached && stageDays >= stageLimit * SLA_APPROACHING_RATIO;
  const breached = idleBreached || stageBreached;
  const approaching = !breached && (idleApproaching || stageApproaching);

  const clock: 'idle' | 'stage' | null = idleBreached
    ? 'idle'
    : stageBreached
      ? 'stage'
      : idleApproaching
        ? 'idle'
        : stageApproaching
          ? 'stage'
          : null;

  const stageName = status?.name ?? 'Unassigned';
  let badge: string | null = null;
  if (idleBreached) badge = `Idle ${Math.floor(idleDays)}d`;
  else if (stageBreached) badge = `Stage ${Math.floor(stageDays)}d`;
  else if (approaching) badge = 'SLA due';

  const parts = [`${stageName}`];
  if (idleLimit != null) parts.push(`activity SLA ${idleLimit}d, last activity ${idleDays.toFixed(1)}d ago`);
  if (stageLimit != null) parts.push(`time-in-stage SLA ${stageLimit}d, in stage ${stageDays.toFixed(1)}d`);
  if (!idleLimit && !stageLimit) parts.push('no SLA on this stage');

  return {
    idleDays,
    stageDays,
    idleLimit,
    stageLimit,
    idleBreached,
    stageBreached,
    approaching,
    breached,
    isTerminal: terminal,
    badge,
    tooltip: parts.join(' — '),
    clock,
  };
}

export function formatSlaPreview(idle: number | null | undefined, stage: number | null | undefined): string {
  const i = slaDaysOrNull(idle);
  const s = slaDaysOrNull(stage);
  if (!i && !s) return 'No SLA';
  const bits: string[] = [];
  if (i) bits.push(`Idle ${i}d`);
  if (s) bits.push(`Stage ${s}d`);
  return bits.join(' · ');
}
