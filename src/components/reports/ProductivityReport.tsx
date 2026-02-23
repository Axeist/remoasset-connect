import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Mail, Phone, Calendar, Linkedin, MessageCircle, ShieldCheck, Trophy,
  Target, Settings2, TrendingUp, TrendingDown, Minus, Users, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, subDays, format,
} from 'date-fns';
import { TargetConfigDialog, type TargetRow } from './TargetConfigDialog';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

const ACTIVITY_TYPES = ['email', 'call', 'meeting', 'linkedin', 'whatsapp', 'nda', 'deal_closed'] as const;
type ActivityKey = typeof ACTIVITY_TYPES[number];

const META: Record<ActivityKey, { label: string; color: string; icon: React.ElementType }> = {
  email:        { label: 'Emails',    color: '#f97316', icon: Mail },
  call:         { label: 'Calls',     color: '#3b82f6', icon: Phone },
  meeting:      { label: 'Meetings',  color: '#22c55e', icon: Calendar },
  linkedin:     { label: 'LinkedIn',  color: '#0ea5e9', icon: Linkedin },
  whatsapp:     { label: 'WhatsApp',  color: '#25d366', icon: MessageCircle },
  nda:          { label: 'NDAs',      color: '#6366f1', icon: ShieldCheck },
  deal_closed:  { label: 'Deals Won', color: '#ec4899', icon: Trophy },
};

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

function getDateRange(period: Period): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case 'daily':   return { from: startOfDay(now), to: endOfDay(now) };
    case 'weekly':  return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'monthly': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'yearly':  return { from: startOfYear(now), to: endOfYear(now) };
  }
}

function getDailyBreakdownIntervals(period: Period): { label: string; from: Date; to: Date }[] {
  const now = new Date();
  switch (period) {
    case 'daily':
      return [{ label: 'Today', from: startOfDay(now), to: endOfDay(now) }];
    case 'weekly':
      return Array.from({ length: 7 }, (_, i) => {
        const d = subDays(endOfWeek(now, { weekStartsOn: 1 }), 6 - i);
        return { label: format(d, 'EEE'), from: startOfDay(d), to: endOfDay(d) };
      });
    case 'monthly':
      return Array.from({ length: 4 }, (_, i) => {
        const weekStart = new Date(startOfMonth(now));
        weekStart.setDate(weekStart.getDate() + i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const clampedEnd = weekEnd > endOfMonth(now) ? endOfMonth(now) : weekEnd;
        return { label: `W${i + 1}`, from: startOfDay(weekStart), to: endOfDay(clampedEnd) };
      });
    case 'yearly':
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), i, 1);
        return { label: format(d, 'MMM'), from: startOfMonth(d), to: endOfMonth(d) };
      });
  }
}

interface EmployeeStats {
  userId: string;
  name: string;
  counts: Record<ActivityKey, number>;
  total: number;
}

function ProgressRing({ pct, color, size = 44 }: { pct: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(pct, 100);
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-muted/30" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={circ - (filled / 100) * circ}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700"
      />
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="fill-foreground text-[10px] font-bold">
        {Math.round(filled)}%
      </text>
    </svg>
  );
}

function TrendIcon({ pct }: { pct: number }) {
  if (pct >= 100) return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
  if (pct >= 70) return <Minus className="h-3.5 w-3.5 text-amber-500" />;
  return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
}

export function ProductivityReport() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';

  const [period, setPeriod] = useState<Period>('weekly');
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [configOpen, setConfigOpen] = useState(false);
  const [trendData, setTrendData] = useState<Record<string, number>[]>([]);

  const targetPeriod = period === 'yearly' ? 'monthly' : period;

  const targetMap = useMemo(() => {
    const map: Record<string, number> = {};
    targets.forEach((t) => {
      if (t.period === targetPeriod) map[t.activity_type] = t.target_count;
    });
    return map;
  }, [targets, targetPeriod]);

  const DEFAULT_TARGETS: Record<string, Record<string, number>> = {
    daily:   { email: 60, call: 10, meeting: 3, linkedin: 5, whatsapp: 8, nda: 1, deal_closed: 1 },
    weekly:  { email: 300, call: 50, meeting: 15, linkedin: 25, whatsapp: 40, nda: 5, deal_closed: 3 },
    monthly: { email: 1200, call: 200, meeting: 60, linkedin: 100, whatsapp: 160, nda: 20, deal_closed: 12 },
  };

  const getTarget = useCallback((actType: string): number => {
    return targetMap[actType] ?? DEFAULT_TARGETS[targetPeriod]?.[actType] ?? 0;
  }, [targetMap, targetPeriod]);

  const fetchTargets = useCallback(async () => {
    const { data } = await supabase.from('productivity_targets').select('activity_type, period, target_count');
    if (data) setTargets(data);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { from, to } = getDateRange(period);

    // Fetch activities in the period
    let actQuery = supabase
      .from('lead_activities')
      .select('user_id, activity_type, created_at')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString());

    if (!isAdmin) actQuery = actQuery.eq('user_id', user.id);
    const { data: activities } = await actQuery;

    // Fetch deals closed (leads that moved to Won status) in the period
    let wonQuery = supabase
      .from('lead_activities')
      .select('user_id, description, created_at')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .eq('activity_type', 'note')
      .ilike('description', '%moved%Won%');

    if (!isAdmin) wonQuery = wonQuery.eq('user_id', user.id);
    const { data: wonActivities } = await wonQuery;

    // Also count NDA Received specifically
    let ndaRecvQuery = supabase
      .from('lead_activities')
      .select('user_id, description, created_at')
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .eq('activity_type', 'nda')
      .ilike('description', '%NDA Received%');

    if (!isAdmin) ndaRecvQuery = ndaRecvQuery.eq('user_id', user.id);
    const { data: ndaReceived } = await ndaRecvQuery;

    const allActivities = activities ?? [];
    const allWon = wonActivities ?? [];
    const allNdaRecv = ndaReceived ?? [];

    // Gather unique user IDs
    const userIds = [...new Set([
      ...allActivities.map((a) => a.user_id),
      ...allWon.map((a) => a.user_id),
    ])];

    // Fetch profiles
    let nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
      nameMap = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = p.full_name || 'Unknown'; return acc; }, {} as Record<string, string>);
    }

    // Build per-employee stats
    const statsMap: Record<string, EmployeeStats> = {};
    const ensureUser = (uid: string) => {
      if (!statsMap[uid]) {
        statsMap[uid] = {
          userId: uid,
          name: nameMap[uid] ?? uid.slice(0, 8),
          counts: { email: 0, call: 0, meeting: 0, linkedin: 0, whatsapp: 0, nda: 0, deal_closed: 0 },
          total: 0,
        };
      }
    };

    allActivities.forEach((a) => {
      const type = a.activity_type as ActivityKey;
      if (ACTIVITY_TYPES.includes(type) && type !== 'deal_closed') {
        ensureUser(a.user_id);
        statsMap[a.user_id].counts[type]++;
        statsMap[a.user_id].total++;
      }
    });

    // Count deals closed
    allWon.forEach((a) => {
      ensureUser(a.user_id);
      statsMap[a.user_id].counts.deal_closed++;
      statsMap[a.user_id].total++;
    });

    // For NDA, only count NDA Received (signed) — override the generic nda count
    Object.values(statsMap).forEach((s) => { s.counts.nda = 0; });
    allNdaRecv.forEach((a) => {
      ensureUser(a.user_id);
      statsMap[a.user_id].counts.nda++;
    });

    const sorted = Object.values(statsMap).sort((a, b) => b.total - a.total);
    setEmployeeStats(sorted);

    // Build trend data for the chart
    const intervals = getDailyBreakdownIntervals(period);
    const trend = intervals.map((iv) => {
      const row: Record<string, number | string> = { label: iv.label };
      ACTIVITY_TYPES.filter((t) => t !== 'deal_closed').forEach((type) => {
        row[type] = allActivities.filter((a) => {
          const d = new Date(a.created_at);
          const matchesUser = selectedEmployee === 'all' || a.user_id === selectedEmployee;
          return d >= iv.from && d <= iv.to && a.activity_type === type && matchesUser;
        }).length;
      });
      return row as Record<string, number> & { label: string };
    });
    setTrendData(trend);

    setLoading(false);
  }, [user, isAdmin, period, selectedEmployee]);

  useEffect(() => { fetchTargets(); }, [fetchTargets]);
  useEffect(() => { fetchData(); }, [fetchData]);

  // Aggregate for the selected employee or all
  const aggregated = useMemo(() => {
    if (selectedEmployee === 'all') {
      const totals: Record<ActivityKey, number> = { email: 0, call: 0, meeting: 0, linkedin: 0, whatsapp: 0, nda: 0, deal_closed: 0 };
      employeeStats.forEach((e) => {
        ACTIVITY_TYPES.forEach((t) => { totals[t] += e.counts[t]; });
      });
      return totals;
    }
    const emp = employeeStats.find((e) => e.userId === selectedEmployee);
    return emp?.counts ?? { email: 0, call: 0, meeting: 0, linkedin: 0, whatsapp: 0, nda: 0, deal_closed: 0 };
  }, [employeeStats, selectedEmployee]);

  const targetMultiplier = period === 'yearly' ? 12 : 1;
  const employeeCount = selectedEmployee === 'all' ? Math.max(employeeStats.length, 1) : 1;

  const radarData = useMemo(() => {
    return ACTIVITY_TYPES.map((t) => {
      const target = getTarget(t) * targetMultiplier * employeeCount;
      const actual = aggregated[t];
      return {
        subject: META[t].label,
        actual,
        target,
        pct: target > 0 ? Math.round((actual / target) * 100) : 0,
      };
    });
  }, [aggregated, getTarget, targetMultiplier, employeeCount]);

  const overallPct = useMemo(() => {
    const totalTarget = ACTIVITY_TYPES.reduce((s, t) => s + getTarget(t) * targetMultiplier * employeeCount, 0);
    const totalActual = ACTIVITY_TYPES.reduce((s, t) => s + aggregated[t], 0);
    return totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
  }, [aggregated, getTarget, targetMultiplier, employeeCount]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
          {(['daily', 'weekly', 'monthly', 'yearly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200 capitalize',
                period === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {isAdmin && employeeStats.length > 0 && (
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="All Employees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employeeStats.map((e) => (
                <SelectItem key={e.userId} value={e.userId}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {isAdmin && (
          <Button variant="outline" size="sm" className="gap-1.5 ml-auto" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-4 w-4" />
            Configure Targets
          </Button>
        )}
      </div>

      {/* Overall score + activity cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        {/* Overall score card */}
        <Card className="col-span-2 md:col-span-1 lg:col-span-1 border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1">
            <ProgressRing pct={overallPct} color="hsl(var(--primary))" size={56} />
            <p className="text-xs font-semibold text-primary mt-1">Overall</p>
            <p className="text-[10px] text-muted-foreground capitalize">{period}</p>
          </CardContent>
        </Card>

        {ACTIVITY_TYPES.map((type) => {
          const m = META[type];
          const Icon = m.icon;
          const actual = aggregated[type];
          const target = getTarget(type) * targetMultiplier * employeeCount;
          const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
          return (
            <Card key={type} className="transition-all hover:shadow-sm">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ backgroundColor: `${m.color}15` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: m.color }} />
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground truncate">{m.label}</span>
                </div>
                <div className="flex items-end justify-between gap-1">
                  <div>
                    <p className="text-xl font-bold text-foreground leading-none">{actual}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">/ {target} target</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendIcon pct={pct} />
                    <span className={cn('text-xs font-semibold', pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500')}>
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: m.color }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity trend chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activity Breakdown — {period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : period === 'monthly' ? 'This Month' : 'This Year'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {ACTIVITY_TYPES.filter((t) => t !== 'deal_closed').map((type) => (
                    <Bar key={type} dataKey={type} name={META[type].label} fill={META[type].color} radius={[2, 2, 0, 0]} stackId="a" />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Radar chart — target vs actual */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-5 w-5" />
              Target vs Actual
            </CardTitle>
            <CardDescription>How close to target across all activity types</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid className="stroke-muted" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis tick={{ fontSize: 9 }} />
                <Radar name="Target" dataKey="target" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} strokeDasharray="4 4" />
                <Radar name="Actual" dataKey="actual" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Employee comparison table (admin only, or single-employee summary) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-5 w-5" />
              {isAdmin ? 'Employee Comparison' : 'My Breakdown'}
            </CardTitle>
            <CardDescription className="capitalize">{period} productivity per team member</CardDescription>
          </CardHeader>
          <CardContent>
            {employeeStats.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No activity in this period</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-semibold">Name</th>
                      {ACTIVITY_TYPES.map((t) => (
                        <th key={t} className="text-center py-2 px-1 font-semibold" title={META[t].label}>
                          {(() => { const Icon = META[t].icon; return <Icon className="h-3.5 w-3.5 mx-auto" style={{ color: META[t].color }} />; })()}
                        </th>
                      ))}
                      <th className="text-right py-2 px-2 font-semibold">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeStats.map((emp, idx) => {
                      const empTotal = ACTIVITY_TYPES.reduce((s, t) => {
                        const tgt = getTarget(t) * targetMultiplier;
                        return s + (tgt > 0 ? Math.min(emp.counts[t] / tgt, 1) : 0);
                      }, 0);
                      const empPct = Math.round((empTotal / ACTIVITY_TYPES.length) * 100);
                      return (
                        <tr key={emp.userId} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2 px-2 font-medium whitespace-nowrap">
                            {idx === 0 && isAdmin && <Trophy className="inline h-3 w-3 text-yellow-500 mr-1" />}
                            {emp.name}
                          </td>
                          {ACTIVITY_TYPES.map((t) => {
                            const tgt = getTarget(t) * targetMultiplier;
                            const pctCell = tgt > 0 ? Math.round((emp.counts[t] / tgt) * 100) : 0;
                            return (
                              <td key={t} className="text-center py-2 px-1">
                                <span className={cn(
                                  'inline-block min-w-[28px] rounded px-1 py-0.5 text-[10px] font-semibold',
                                  pctCell >= 100 ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                                    : pctCell >= 70 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                                )}>
                                  {emp.counts[t]}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-right py-2 px-2">
                            <Badge variant={empPct >= 80 ? 'default' : empPct >= 50 ? 'secondary' : 'destructive'} className="text-[10px]">
                              {empPct}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Target config dialog */}
      <TargetConfigDialog
        open={configOpen}
        onOpenChange={setConfigOpen}
        targets={targets}
        onSaved={fetchTargets}
      />
    </div>
  );
}
