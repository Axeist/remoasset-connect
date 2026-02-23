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
  startOfYear, endOfYear, subDays, format, differenceInDays, eachDayOfInterval,
  eachWeekOfInterval, eachMonthOfInterval,
} from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarWidget } from '@/components/ui/calendar';
import { CalendarDays } from 'lucide-react';
import { TargetConfigDialog, type TargetRow } from './TargetConfigDialog';

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

const ACTIVITY_TYPES = ['email', 'call', 'meeting', 'linkedin', 'whatsapp', 'nda', 'deal_closed'] as const;
type ActivityKey = typeof ACTIVITY_TYPES[number];

const OUTREACH_TYPES: readonly ActivityKey[] = ['email', 'call', 'linkedin', 'whatsapp'];
const TARGET_CATEGORIES = ['outreach', 'meeting', 'nda', 'deal_closed'] as const;
type TargetCategoryKey = typeof TARGET_CATEGORIES[number];

const META: Record<ActivityKey, { label: string; color: string; icon: React.ElementType }> = {
  email:        { label: 'Emails',    color: '#f97316', icon: Mail },
  call:         { label: 'Calls',     color: '#3b82f6', icon: Phone },
  meeting:      { label: 'Meetings',  color: '#22c55e', icon: Calendar },
  linkedin:     { label: 'LinkedIn',  color: '#0ea5e9', icon: Linkedin },
  whatsapp:     { label: 'WhatsApp',  color: '#25d366', icon: MessageCircle },
  nda:          { label: 'NDAs',      color: '#6366f1', icon: ShieldCheck },
  deal_closed:  { label: 'Deals Won', color: '#ec4899', icon: Trophy },
};

const CATEGORY_META: Record<TargetCategoryKey, { label: string; color: string; icon: React.ElementType }> = {
  outreach:     { label: 'Outreach',  color: '#f97316', icon: Mail },
  meeting:      { label: 'Meetings',  color: '#22c55e', icon: Calendar },
  nda:          { label: 'NDAs',      color: '#6366f1', icon: ShieldCheck },
  deal_closed:  { label: 'Deals Won', color: '#ec4899', icon: Trophy },
};

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

function getDateRange(period: Period, customFrom?: Date | null, customTo?: Date | null): { from: Date; to: Date } {
  const now = new Date();
  switch (period) {
    case 'daily':   return { from: startOfDay(now), to: endOfDay(now) };
    case 'weekly':  return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'monthly': return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'yearly':  return { from: startOfYear(now), to: endOfYear(now) };
    case 'custom':  return {
      from: customFrom ? startOfDay(customFrom) : startOfDay(subDays(now, 30)),
      to: customTo ? endOfDay(customTo) : endOfDay(now),
    };
  }
}

function getDailyBreakdownIntervals(
  period: Period,
  customFrom?: Date | null,
  customTo?: Date | null,
): { label: string; from: Date; to: Date }[] {
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
    case 'custom': {
      const from = customFrom ? startOfDay(customFrom) : startOfDay(subDays(now, 30));
      const to = customTo ? endOfDay(customTo) : endOfDay(now);
      const days = differenceInDays(to, from);
      if (days <= 1) {
        return [{ label: format(from, 'MMM d'), from, to }];
      }
      if (days <= 14) {
        return eachDayOfInterval({ start: from, end: to }).map((d) => ({
          label: format(d, 'MMM d'),
          from: startOfDay(d),
          to: endOfDay(d),
        }));
      }
      if (days <= 90) {
        const weeks = eachWeekOfInterval({ start: from, end: to }, { weekStartsOn: 1 });
        return weeks.map((w, i) => {
          const wEnd = new Date(w);
          wEnd.setDate(wEnd.getDate() + 6);
          const clampedEnd = wEnd > to ? to : wEnd;
          return { label: `W${i + 1}`, from: startOfDay(w), to: endOfDay(clampedEnd) };
        });
      }
      return eachMonthOfInterval({ start: from, end: to }).map((m) => ({
        label: format(m, 'MMM yyyy'),
        from: startOfMonth(m),
        to: endOfMonth(m) > to ? to : endOfMonth(m),
      }));
    }
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
      <text x="50%" y="50%" textAnchor="middle" dy=".35em" className="fill-foreground text-xs font-bold">
        {Math.round(filled)}%
      </text>
    </svg>
  );
}

function TrendIcon({ pct }: { pct: number }) {
  if (pct >= 100) return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (pct >= 70) return <Minus className="h-4 w-4 text-amber-500" />;
  return <TrendingDown className="h-4 w-4 text-red-500" />;
}

export function ProductivityReport() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';

  const [period, setPeriod] = useState<Period>('weekly');
  const [customFrom, setCustomFrom] = useState<Date | null>(null);
  const [customTo, setCustomTo] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStats[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [configOpen, setConfigOpen] = useState(false);
  const [trendData, setTrendData] = useState<Record<string, number>[]>([]);

  const targetPeriod = period === 'yearly' || period === 'custom' ? 'monthly' : period;

  const targetMap = useMemo(() => {
    const map: Record<string, number> = {};
    targets.forEach((t) => {
      if (t.period === targetPeriod) map[t.activity_type] = t.target_count;
    });
    return map;
  }, [targets, targetPeriod]);

  const DEFAULT_TARGETS: Record<string, Record<string, number>> = {
    daily:   { outreach: 83, meeting: 3, nda: 1, deal_closed: 1 },
    weekly:  { outreach: 415, meeting: 15, nda: 5, deal_closed: 5 },
    monthly: { outreach: 1826, meeting: 66, nda: 22, deal_closed: 22 },
  };

  const getTarget = useCallback((category: string): number => {
    return targetMap[category] ?? DEFAULT_TARGETS[targetPeriod]?.[category] ?? 0;
  }, [targetMap, targetPeriod]);

  const getCategoryActual = useCallback((category: TargetCategoryKey, agg: Record<ActivityKey, number>): number => {
    if (category === 'outreach') return OUTREACH_TYPES.reduce((s, t) => s + agg[t], 0);
    return agg[category as ActivityKey] ?? 0;
  }, []);

  const fetchTargets = useCallback(async () => {
    const { data } = await supabase.from('productivity_targets').select('activity_type, period, target_count');
    if (data) setTargets(data);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user) return;
    if (period === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);

    const { from, to } = getDateRange(period, customFrom, customTo);

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
    const intervals = getDailyBreakdownIntervals(period, customFrom, customTo);
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
  }, [user, isAdmin, period, selectedEmployee, customFrom, customTo]);

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

  const targetMultiplier = useMemo(() => {
    if (period === 'yearly') return 12;
    if (period === 'custom' && customFrom && customTo) {
      const days = differenceInDays(customTo, customFrom) + 1;
      return Math.max(1, Math.round(days / 30));
    }
    return 1;
  }, [period, customFrom, customTo]);
  const employeeCount = selectedEmployee === 'all' ? Math.max(employeeStats.length, 1) : 1;

  const radarData = useMemo(() => {
    return TARGET_CATEGORIES.map((cat) => {
      const target = getTarget(cat) * targetMultiplier * employeeCount;
      const actual = getCategoryActual(cat, aggregated);
      return {
        subject: CATEGORY_META[cat].label,
        actual,
        target,
        pct: target > 0 ? Math.round((actual / target) * 100) : 0,
      };
    });
  }, [aggregated, getTarget, getCategoryActual, targetMultiplier, employeeCount]);

  const overallPct = useMemo(() => {
    const totalTarget = TARGET_CATEGORIES.reduce((s, cat) => s + getTarget(cat) * targetMultiplier * employeeCount, 0);
    const totalActual = TARGET_CATEGORIES.reduce((s, cat) => s + getCategoryActual(cat, aggregated), 0);
    return totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
  }, [aggregated, getTarget, getCategoryActual, targetMultiplier, employeeCount]);

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
          {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                'rounded-md px-3.5 py-1.5 text-sm font-medium transition-all duration-200 capitalize',
                period === p ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5 font-normal min-w-[140px] justify-start">
                  <CalendarDays className="h-4 w-4" />
                  {customFrom ? format(customFrom, 'MMM d, yyyy') : 'Start date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarWidget
                  mode="single"
                  selected={customFrom ?? undefined}
                  onSelect={(d) => setCustomFrom(d ?? null)}
                  disabled={(d) => (customTo ? d > customTo : false)}
                />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5 font-normal min-w-[140px] justify-start">
                  <CalendarDays className="h-4 w-4" />
                  {customTo ? format(customTo, 'MMM d, yyyy') : 'End date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarWidget
                  mode="single"
                  selected={customTo ?? undefined}
                  onSelect={(d) => setCustomTo(d ?? null)}
                  disabled={(d) => (customFrom ? d < customFrom : false)}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {isAdmin && employeeStats.length > 0 && (
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger className="w-[200px] h-9 text-sm">
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

      {/* Overall score + category cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {/* Overall score card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-1">
            <ProgressRing pct={overallPct} color="hsl(var(--primary))" size={64} />
            <p className="text-sm font-semibold text-primary mt-1">Overall</p>
            <p className="text-xs text-muted-foreground capitalize">{period === 'custom' ? 'Custom' : period}</p>
          </CardContent>
        </Card>

        {TARGET_CATEGORIES.map((cat) => {
          const m = CATEGORY_META[cat];
          const Icon = m.icon;
          const actual = getCategoryActual(cat, aggregated);
          const target = getTarget(cat) * targetMultiplier * employeeCount;
          const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
          return (
            <Card key={cat} className="transition-all hover:shadow-sm">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md" style={{ backgroundColor: `${m.color}15` }}>
                    <Icon className="h-4 w-4" style={{ color: m.color }} />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground truncate">{m.label}</span>
                </div>
                <div className="flex items-end justify-between gap-1">
                  <div>
                    <p className="text-2xl font-bold text-foreground leading-none">{actual}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">/ {target} target</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendIcon pct={pct} />
                    <span className={cn('text-sm font-semibold', pct >= 100 ? 'text-green-600' : pct >= 70 ? 'text-amber-600' : 'text-red-500')}>
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
                {cat === 'outreach' && (
                  <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {OUTREACH_TYPES.map((t) => {
                      const OIcon = META[t].icon;
                      return (
                        <span key={t} className="inline-flex items-center gap-1">
                          <OIcon className="h-3 w-3" style={{ color: META[t].color }} />
                          {aggregated[t]}
                        </span>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity trend chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Activity Breakdown — {period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : period === 'monthly' ? 'This Month' : period === 'yearly' ? 'This Year' : customFrom && customTo ? `${format(customFrom, 'MMM d')} – ${format(customTo, 'MMM d, yyyy')}` : 'Custom Range'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="text-base text-muted-foreground py-8 text-center">No data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 13 }} />
                  <YAxis tick={{ fontSize: 13 }} />
                  <Tooltip contentStyle={{ ...TOOLTIP_STYLE, fontSize: 13 }} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
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
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />
              Target vs Actual
            </CardTitle>
            <CardDescription className="text-sm">How close to target across all categories</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid className="stroke-muted" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <PolarRadiusAxis tick={{ fontSize: 11 }} />
                <Radar name="Target" dataKey="target" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} strokeDasharray="4 4" />
                <Radar name="Actual" dataKey="actual" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Tooltip contentStyle={{ ...TOOLTIP_STYLE, fontSize: 13 }} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Employee comparison table (admin only, or single-employee summary) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              {isAdmin ? 'Employee Comparison' : 'My Breakdown'}
            </CardTitle>
            <CardDescription className="text-sm capitalize">{period} productivity per team member</CardDescription>
          </CardHeader>
          <CardContent>
            {employeeStats.length === 0 ? (
              <p className="text-base text-muted-foreground py-8 text-center">No activity in this period</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2.5 px-2 font-semibold">Name</th>
                      {TARGET_CATEGORIES.map((cat) => (
                        <th key={cat} className="text-center py-2.5 px-1.5 font-semibold" title={CATEGORY_META[cat].label}>
                          {(() => { const Icon = CATEGORY_META[cat].icon; return <Icon className="h-4 w-4 mx-auto" style={{ color: CATEGORY_META[cat].color }} />; })()}
                        </th>
                      ))}
                      <th className="text-right py-2.5 px-2 font-semibold">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeStats.map((emp, idx) => {
                      const empTotal = TARGET_CATEGORIES.reduce((s, cat) => {
                        const tgt = getTarget(cat) * targetMultiplier;
                        const actual = getCategoryActual(cat, emp.counts);
                        return s + (tgt > 0 ? Math.min(actual / tgt, 1) : 0);
                      }, 0);
                      const empPct = Math.round((empTotal / TARGET_CATEGORIES.length) * 100);
                      return (
                        <tr key={emp.userId} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="py-2.5 px-2 font-medium whitespace-nowrap">
                            {idx === 0 && isAdmin && <Trophy className="inline h-3.5 w-3.5 text-yellow-500 mr-1" />}
                            {emp.name}
                          </td>
                          {TARGET_CATEGORIES.map((cat) => {
                            const tgt = getTarget(cat) * targetMultiplier;
                            const actual = getCategoryActual(cat, emp.counts);
                            const pctCell = tgt > 0 ? Math.round((actual / tgt) * 100) : 0;
                            return (
                              <td key={cat} className="text-center py-2.5 px-1.5">
                                <span className={cn(
                                  'inline-block min-w-[30px] rounded px-1.5 py-0.5 text-xs font-semibold',
                                  pctCell >= 100 ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
                                    : pctCell >= 70 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                                )}>
                                  {actual}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-right py-2.5 px-2">
                            <Badge variant={empPct >= 80 ? 'default' : empPct >= 50 ? 'secondary' : 'destructive'} className="text-xs">
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
