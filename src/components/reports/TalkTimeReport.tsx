import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { AgentTablePicker } from './AgentTablePicker';
import { ReportDateFilter, type ReportDateFilterValue } from './ReportDateFilter';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from 'recharts';
import { Clock, Download, Phone, RotateCcw, Users, Voicemail } from 'lucide-react';
import { eachDayOfInterval, format, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { getPresetRange, formatDateRangeSubtitle } from '@/lib/datePresets';
import { cn } from '@/lib/utils';
import {
  LINE_META, LINES, type CallRow, type DidSettings, type LineId,
  callAt, downloadCsv, formatTalk, isAnswered, lineForCall, talkSeconds, TOOLTIP_STYLE,
} from '@/lib/call-reports';

const UNASSIGNED = '__unassigned__';

function defaultFilter(): ReportDateFilterValue {
  const r = getPresetRange('this_month', 'filter');
  return { preset: 'this_month', from: r?.from ?? null, to: r?.to ?? null };
}

export function TalkTimeReport() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [dids, setDids] = useState<DidSettings>({ us: null, sg: null, uk: null });
  const [date, setDate] = useState<ReportDateFilterValue>(defaultFilter);
  const [lineFilter, setLineFilter] = useState<LineId | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [dayFilter, setDayFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: settings } = await supabase
        .from('app_settings' as never)
        .select('cloudtalk_did_us_e164, cloudtalk_did_sg_e164, cloudtalk_did_uk_e164')
        .limit(1)
        .maybeSingle();
      const s = settings as {
        cloudtalk_did_us_e164?: string | null;
        cloudtalk_did_sg_e164?: string | null;
        cloudtalk_did_uk_e164?: string | null;
      } | null;
      const nextDids: DidSettings = {
        us: s?.cloudtalk_did_us_e164 ?? null,
        sg: s?.cloudtalk_did_sg_e164 ?? null,
        uk: s?.cloudtalk_did_uk_e164 ?? null,
      };
      setDids(nextDids);

      const rows = await fetchAllPaginated<CallRow>(async (from, to) => {
        let q = supabase
          .from('cloudtalk_calls' as never)
          .select('id, lead_id, connect_user_id, direction, status, from_number, to_number, duration_seconds, waiting_seconds, wrapup_seconds, started_at, created_at, is_voicemail')
          .order('created_at', { ascending: true })
          .range(from, to);
        if (date.from) q = q.gte('created_at', date.from);
        if (date.to) q = q.lte('created_at', date.to);
        if (!isAdmin && user?.id) q = q.eq('connect_user_id', user.id);
        return q;
      });
      setCalls(rows);

      const ownerIds = [...new Set(rows.map((c) => c.connect_user_id).filter(Boolean))] as string[];
      if (ownerIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ownerIds);
        const map: Record<string, string> = {};
        for (const p of profiles ?? []) map[p.user_id] = p.full_name || 'User';
        setNames(map);
      } else {
        setNames({});
      }
    } finally {
      setLoading(false);
    }
  }, [date.from, date.to, isAdmin, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const enriched = useMemo(() => calls.map((c) => ({
    ...c,
    line: lineForCall(c, dids),
    owner: c.connect_user_id || UNASSIGNED,
    talk: talkSeconds(c),
    answered: isAnswered(c),
    at: callAt(c),
  })), [calls, dids]);

  const afterLine = useMemo(() => {
    let list = enriched;
    if (lineFilter !== 'all') list = list.filter((c) => c.line === lineFilter);
    if (dayFilter) {
      list = list.filter((c) => format(c.at, 'yyyy-MM-dd') === dayFilter);
    }
    return list;
  }, [enriched, lineFilter, dayFilter]);

  const pickerAgents = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of afterLine) counts.set(c.owner, (counts.get(c.owner) ?? 0) + 1);
    return [...counts.entries()]
      .map(([userId, leadCount]) => ({
        userId,
        name: userId === UNASSIGNED ? 'Unassigned' : (names[userId] ?? 'User'),
        leadCount,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [afterLine, names]);

  const filtered = useMemo(() => {
    if (!selectedIds) return afterLine;
    const set = new Set(selectedIds);
    return afterLine.filter((c) => set.has(c.owner));
  }, [afterLine, selectedIds]);

  const kpis = useMemo(() => {
    const talk = filtered.reduce((s, c) => s + c.talk, 0);
    const answered = filtered.filter((c) => c.answered).length;
    const wrap = filtered.reduce((s, c) => s + (c.wrapup_seconds ?? 0), 0);
    const owners = new Set(filtered.map((c) => c.owner).filter((id) => id !== UNASSIGNED));
    return {
      talk,
      avg: answered ? Math.round(talk / answered) : 0,
      answeredPct: filtered.length ? Math.round((answered / filtered.length) * 100) : 0,
      wrap,
      callers: owners.size,
      answered,
      total: filtered.length,
    };
  }, [filtered]);

  const lineStats = useMemo(() => LINES.map((id) => {
    const rows = enriched.filter((c) => c.line === id);
    return {
      id,
      talk: rows.reduce((s, c) => s + c.talk, 0),
      calls: rows.length,
      answered: rows.filter((c) => c.answered).length,
    };
  }), [enriched]);

  const trend = useMemo(() => {
    if (!filtered.length && !date.from) return [];
    const start = date.from ? startOfDay(new Date(date.from)) : startOfDay(filtered[0]?.at ?? new Date());
    const end = date.to ? endOfDay(new Date(date.to)) : endOfDay(new Date());
    let days: Date[] = [];
    try {
      days = eachDayOfInterval({ start, end });
    } catch {
      return [];
    }
    if (days.length > 62) {
      const byMonth = new Map<string, { us: number; sg: number; uk: number; label: string }>();
      for (const c of filtered) {
        const key = format(c.at, 'yyyy-MM');
        const row = byMonth.get(key) ?? { us: 0, sg: 0, uk: 0, label: format(c.at, 'MMM yyyy') };
        if (c.line === 'us' || c.line === 'sg' || c.line === 'uk') row[c.line] += c.talk / 60;
        byMonth.set(key, row);
      }
      return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({
        label: v.label,
        key: v.label,
        us: Math.round(v.us * 10) / 10,
        sg: Math.round(v.sg * 10) / 10,
        uk: Math.round(v.uk * 10) / 10,
      }));
    }
    return days.map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      const dayRows = filtered.filter((c) => format(c.at, 'yyyy-MM-dd') === key);
      const mins = (id: LineId) => Math.round(dayRows.filter((c) => c.line === id).reduce((s, c) => s + c.talk, 0) / 60 * 10) / 10;
      return { label: format(d, 'MMM d'), key, us: mins('us'), sg: mins('sg'), uk: mins('uk') };
    });
  }, [filtered, date.from, date.to]);

  const ownerBars = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of filtered) map.set(c.owner, (map.get(c.owner) ?? 0) + c.talk);
    return [...map.entries()]
      .map(([id, talk]) => ({
        name: id === UNASSIGNED ? 'Unassigned' : (names[id] ?? 'User'),
        id,
        minutes: Math.round(talk / 60 * 10) / 10,
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 20);
  }, [filtered, names]);

  const tableRows = useMemo(() => {
    const map = new Map<string, { us: number; sg: number; uk: number; unmapped: number }>();
    for (const c of filtered) {
      const row = map.get(c.owner) ?? { us: 0, sg: 0, uk: 0, unmapped: 0 };
      row[c.line] += c.talk;
      map.set(c.owner, row);
    }
    return [...map.entries()]
      .map(([id, v]) => ({
        id,
        name: id === UNASSIGNED ? 'Unassigned' : (names[id] ?? 'User'),
        us: v.us,
        sg: v.sg,
        uk: v.uk,
        unmapped: v.unmapped,
        total: v.us + v.sg + v.uk + v.unmapped,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, names]);

  const unmappedCount = enriched.filter((c) => c.line === 'unmapped').length;

  const exportCsv = () => {
    downloadCsv(`talk-time-${format(new Date(), 'yyyy-MM-dd')}.csv`, [
      ['Owner', 'US minutes', 'SG minutes', 'UK minutes', 'Unmapped minutes', 'Total minutes'],
      ...tableRows.map((r) => [
        r.name,
        String(Math.round(r.us / 60 * 10) / 10),
        String(Math.round(r.sg / 60 * 10) / 10),
        String(Math.round(r.uk / 60 * 10) / 10),
        String(Math.round(r.unmapped / 60 * 10) / 10),
        String(Math.round(r.total / 60 * 10) / 10),
      ]),
    ]);
  };

  if (loading) return <Skeleton className="h-[480px] w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold">Talk time</h2>
          <p className="text-sm text-muted-foreground">
            {formatDateRangeSubtitle(date.preset, date.from, date.to)} · credited to lead owner · 3 CloudTalk numbers
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportDateFilter value={date} onChange={(v) => { setDate(v); setDayFilter(null); }} compact />
          {isAdmin && (
            <AgentTablePicker agents={pickerAgents} selectedIds={selectedIds} onChange={setSelectedIds} />
          )}
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          {(lineFilter !== 'all' || dayFilter || selectedIds) && (
            <Button variant="ghost" size="sm" className="gap-1.5 h-9" onClick={() => { setLineFilter('all'); setDayFilter(null); setSelectedIds(null); }}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Talk time', value: formatTalk(kpis.talk), icon: Clock, color: 'text-primary' },
          { label: 'Avg answered', value: formatTalk(kpis.avg), icon: Phone, color: 'text-violet-500' },
          { label: 'Answered', value: `${kpis.answeredPct}%`, icon: Phone, color: 'text-emerald-500' },
          { label: 'Wrap-up', value: formatTalk(kpis.wrap), icon: Voicemail, color: 'text-amber-500' },
          { label: 'Lead owners', value: String(kpis.callers), icon: Users, color: 'text-sky-500' },
        ].map((k) => (
          <Card key={k.label} className="card-shadow rounded-xl border-border/80">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{k.label}</p>
                <k.icon className={cn('h-4 w-4', k.color)} />
              </div>
              <p className={cn('text-2xl font-bold tabular-nums', k.color)}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        {lineStats.map((ls) => {
          const meta = LINE_META[ls.id];
          const on = lineFilter === ls.id;
          return (
            <button
              key={ls.id}
              type="button"
              onClick={() => setLineFilter(on ? 'all' : ls.id)}
              className={cn(
                'text-left rounded-xl border p-4 transition-all',
                on ? 'ring-2 ring-offset-2 ring-offset-background shadow-lg' : 'hover:border-foreground/20 hover:shadow-md',
              )}
              style={{ borderColor: on ? meta.color : undefined, ['--tw-ring-color' as string]: meta.color }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{meta.flag}</span>
                <div>
                  <p className="text-sm font-semibold">{meta.label}</p>
                  <p className="text-[11px] text-muted-foreground">Company line</p>
                </div>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: meta.color }}>{formatTalk(ls.talk)}</p>
              <p className="text-xs text-muted-foreground mt-1">{ls.calls} calls · {ls.answered} answered</p>
            </button>
          );
        })}
      </div>

      {unmappedCount > 0 && (
        <p className="text-xs text-amber-600">
          {unmappedCount} call{unmappedCount === 1 ? '' : 's'} not on US / SG / UK — save the three numbers in Admin → CloudTalk.
        </p>
      )}

      {filtered.length === 0 ? (
        <Card className="rounded-xl border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            No CloudTalk calls in this range. Place a call from Connect to start the report.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="card-shadow rounded-xl border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Talk minutes by day</CardTitle>
              <CardDescription>Stacked by US / Singapore / UK. Click a day in the chart legend filters via the line cards.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trend}
                  onClick={(e) => {
                    const label = (e as { activeLabel?: string })?.activeLabel;
                    const row = trend.find((t) => t.label === label);
                    if (row) setDayFilter((d) => d === row.key ? null : row.key);
                  }}
                >
                  <defs>
                    {LINES.map((id) => (
                      <linearGradient key={id} id={`talk-${id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={LINE_META[id].color} stopOpacity={0.45} />
                        <stop offset="100%" stopColor={LINE_META[id].color} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend />
                  {LINES.map((id) => (
                    <Area key={id} type="monotone" dataKey={id} name={LINE_META[id].short} stackId="1" stroke={LINE_META[id].color} fill={`url(#talk-${id})`} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="card-shadow rounded-xl border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">Lead owners</CardTitle>
                <CardDescription>Talk minutes credited to the lead owner</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ownerBars} layout="vertical" margin={{ left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="minutes" name="Minutes" fill="#EA6E35" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="card-shadow rounded-xl border-border/80 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">Owner × line</CardTitle>
                <CardDescription>Minutes on each company number</CardDescription>
              </CardHeader>
              <CardContent className="p-0 max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner</TableHead>
                      <TableHead className="text-right">🇺🇸 US</TableHead>
                      <TableHead className="text-right">🇸🇬 SG</TableHead>
                      <TableHead className="text-right">🇬🇧 UK</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatTalk(r.us)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatTalk(r.sg)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatTalk(r.uk)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatTalk(r.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>Total</TableCell>
                      {(['us', 'sg', 'uk'] as const).map((id) => (
                        <TableCell key={id} className="text-right tabular-nums">
                          {formatTalk(tableRows.reduce((s, r) => s + r[id], 0))}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">
                        {formatTalk(tableRows.reduce((s, r) => s + r.total, 0))}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
