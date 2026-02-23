import { useMemo } from 'react';
import {
  Users,
  TrendingUp,
  Trophy,
  Target,
  BarChart3,
  Zap,
  Phone,
  Mail,
  Calendar,
  MessageCircle,
  Linkedin,
  ShieldCheck,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Lead, LeadStatusOption } from '@/types/lead';

interface WidgetProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subLabel?: string;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
}

function Widget({ icon: Icon, label, value, subLabel, color = 'text-primary' }: WidgetProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card/80 backdrop-blur-sm px-4 py-3 min-w-[170px] transition-all hover:shadow-sm hover:border-border">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-current/10', color)}>
        <Icon className="h-4.5 w-4.5" style={{ color: 'currentColor' }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground leading-tight truncate">{value}</p>
        <p className="text-[11px] text-muted-foreground leading-tight truncate">{label}</p>
        {subLabel && <p className="text-[10px] text-muted-foreground/70 truncate">{subLabel}</p>}
      </div>
    </div>
  );
}

interface MiniBarSegment {
  label: string;
  count: number;
  color: string;
}

function MiniBar({ segments, total }: { segments: MiniBarSegment[]; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card/80 backdrop-blur-sm px-4 py-3 min-w-[280px] flex-1 transition-all hover:shadow-sm">
      <div className="w-full space-y-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">Distribution</p>
        <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted/50">
          {segments.filter((s) => s.count > 0).map((seg, i) => (
            <div
              key={i}
              className="h-full transition-all duration-500"
              style={{ width: `${(seg.count / total) * 100}%`, backgroundColor: seg.color }}
              title={`${seg.label}: ${seg.count} (${Math.round((seg.count / total) * 100)}%)`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {segments.filter((s) => s.count > 0).map((seg, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="text-[10px] text-muted-foreground">{seg.label} {seg.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ACTIVITY_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  call: { label: 'Call', color: '#3b82f6', icon: Phone },
  email: { label: 'Email', color: '#f97316', icon: Mail },
  meeting: { label: 'Meeting', color: '#22c55e', icon: Calendar },
  whatsapp: { label: 'WhatsApp', color: '#25d366', icon: MessageCircle },
  linkedin: { label: 'LinkedIn', color: '#0ea5e9', icon: Linkedin },
  nda: { label: 'NDA', color: '#6366f1', icon: ShieldCheck },
};

interface PipelineWidgetsProps {
  viewMode: 'status' | 'activity';
  leads: Lead[];
  statuses: LeadStatusOption[];
  lastActivityMap: Record<string, string>;
  isAdmin: boolean;
  owners: { id: string; full_name: string | null }[];
}

export function PipelineWidgets({ viewMode, leads, statuses, lastActivityMap, isAdmin, owners }: PipelineWidgetsProps) {
  const stats = useMemo(() => {
    const total = leads.length;
    const avgScore = total > 0 ? Math.round(leads.reduce((s, l) => s + (l.lead_score ?? 0), 0) / total) : 0;
    const totalScore = leads.reduce((s, l) => s + (l.lead_score ?? 0), 0);
    const highScoreLead = leads.reduce<Lead | null>((best, l) => (!best || (l.lead_score ?? 0) > (best.lead_score ?? 0)) ? l : best, null);

    const wonStatus = statuses.find((s) => s.name.toLowerCase() === 'won');
    const wonCount = wonStatus ? leads.filter((l) => l.status_id === wonStatus.id).length : 0;
    const wonRate = total > 0 ? Math.round((wonCount / total) * 100) : 0;

    const leadsWithActivity = Object.keys(lastActivityMap).filter((id) => leads.some((l) => l.id === id)).length;
    const activityCoverage = total > 0 ? Math.round((leadsWithActivity / total) * 100) : 0;
    const noActivity = total - leadsWithActivity;

    const unassigned = leads.filter((l) => !l.owner_id).length;

    const activityCounts: Record<string, number> = {};
    leads.forEach((l) => {
      const act = lastActivityMap[l.id];
      if (act) activityCounts[act] = (activityCounts[act] ?? 0) + 1;
    });
    const topActivity = Object.entries(activityCounts).sort(([, a], [, b]) => b - a)[0];

    // Per-owner stats for admin
    const ownerLeadCounts: Record<string, number> = {};
    const ownerWonCounts: Record<string, number> = {};
    leads.forEach((l) => {
      if (l.owner_id) {
        ownerLeadCounts[l.owner_id] = (ownerLeadCounts[l.owner_id] ?? 0) + 1;
        if (wonStatus && l.status_id === wonStatus.id) {
          ownerWonCounts[l.owner_id] = (ownerWonCounts[l.owner_id] ?? 0) + 1;
        }
      }
    });
    const topPerformerEntry = Object.entries(ownerWonCounts).sort(([, a], [, b]) => b - a)[0];
    const topPerformer = topPerformerEntry
      ? owners.find((o) => o.id === topPerformerEntry[0])
      : null;

    return {
      total,
      avgScore,
      totalScore,
      highScoreLead,
      wonCount,
      wonRate,
      leadsWithActivity,
      activityCoverage,
      noActivity,
      unassigned,
      topActivity,
      topPerformer,
      topPerformerWon: topPerformerEntry?.[1] ?? 0,
      activityCounts,
    };
  }, [leads, statuses, lastActivityMap, isAdmin, owners]);

  const statusSegments: MiniBarSegment[] = useMemo(() => {
    return statuses.map((s) => ({
      label: s.name,
      count: leads.filter((l) => l.status_id === s.id).length,
      color: s.color,
    }));
  }, [leads, statuses]);

  const activitySegments: MiniBarSegment[] = useMemo(() => {
    const segs: MiniBarSegment[] = Object.entries(ACTIVITY_META).map(([key, meta]) => ({
      label: meta.label,
      count: stats.activityCounts[key] ?? 0,
      color: meta.color,
    }));
    segs.unshift({ label: 'None', count: stats.noActivity, color: '#6b7280' });
    return segs;
  }, [stats]);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin animate-in fade-in-0 slide-in-from-top-1 duration-300">
      <Widget icon={Users} label="Total Leads" value={stats.total} color="text-blue-600" />
      <Widget
        icon={BarChart3}
        label="Avg Score"
        value={stats.avgScore}
        subLabel={`${stats.totalScore} total pts`}
        color="text-amber-600"
      />

      {viewMode === 'status' ? (
        <>
          <Widget
            icon={Trophy}
            label="Won Rate"
            value={`${stats.wonRate}%`}
            subLabel={`${stats.wonCount} of ${stats.total} leads`}
            color="text-emerald-600"
          />
          <Widget
            icon={TrendingUp}
            label="Top Lead"
            value={stats.highScoreLead?.company_name ?? '—'}
            subLabel={stats.highScoreLead ? `Score: ${stats.highScoreLead.lead_score ?? 0}` : undefined}
            color="text-violet-600"
          />
          <MiniBar segments={statusSegments} total={stats.total} />
        </>
      ) : (
        <>
          <Widget
            icon={Zap}
            label="Activity Coverage"
            value={`${stats.activityCoverage}%`}
            subLabel={`${stats.leadsWithActivity} active, ${stats.noActivity} idle`}
            color="text-emerald-600"
          />
          <Widget
            icon={Target}
            label="Top Activity"
            value={stats.topActivity ? (ACTIVITY_META[stats.topActivity[0]]?.label ?? stats.topActivity[0]) : '—'}
            subLabel={stats.topActivity ? `${stats.topActivity[1]} leads` : undefined}
            color="text-violet-600"
          />
          <MiniBar segments={activitySegments} total={stats.total} />
        </>
      )}

      {isAdmin && (
        <>
          {stats.topPerformer && (
            <Widget
              icon={UserCheck}
              label="Top Performer"
              value={stats.topPerformer.full_name ?? 'Unknown'}
              subLabel={`${stats.topPerformerWon} won`}
              color="text-pink-600"
            />
          )}
          {stats.unassigned > 0 && (
            <Widget
              icon={AlertCircle}
              label="Unassigned"
              value={stats.unassigned}
              subLabel="Need an owner"
              color="text-red-500"
            />
          )}
        </>
      )}
    </div>
  );
}
