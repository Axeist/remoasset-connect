import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { AgentTablePicker } from './AgentTablePicker';
import { ReportDateFilter, type ReportDateFilterValue } from './ReportDateFilter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Download, PhoneIncoming, PhoneOutgoing, PhoneOff, RotateCcw, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { getPresetRange, formatDateRangeSubtitle } from '@/lib/datePresets';
import { cn } from '@/lib/utils';
import {
  LINE_META, LINES, type CallRow, type DidSettings, type LineId,
  callAt, callOutcome, downloadCsv, isAnswered, lineForCall, TOOLTIP_STYLE,
} from '@/lib/call-reports';

const UNASSIGNED = '__unassigned__';
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function defaultFilter(): ReportDateFilterValue {
  const r = getPresetRange('this_month', 'filter');
  return { preset: 'this_month', from: r?.from ?? null, to: r?.to ?? null };
}

export function CallingReport() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [dids, setDids] = useState<DidSettings>({ us: null, sg: null, uk: null });
  const [date, setDate] = useState<ReportDateFilterValue>(defaultFilter);
  const [lineFilter, setLineFilter] = useState<LineId | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [dirFilter, setDirFilter] = useState<'all' | 'inbound' | 'outbound'>('all');

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
      setDids({
        us: s?.cloudtalk_did_us_e164 ?? null,
        sg: s?.cloudtalk_did_sg_e164 ?? null,
        uk: s?.cloudtalk_did_uk_e164 ?? null,
      });

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
      } else setNames({});
    } finally {
      setLoading(false);
    }
  }, [date.from, date.to, isAdmin, user?.id]);

  useEffect(() => { void load(); }, [load]);

  const enriched = useMemo(() => calls.map((c) => {
    const inbound = (c.direction ?? '').toLowerCase() === 'inbound';
    return {
      ...c,
      line: lineForCall(c, dids),
      owner: c.connect_user_id || UNASSIGNED,
      answered: isAnswered(c),
      outcome: callOutcome(c),
      inbound,
      at: callAt(c),
    };
  }), [calls, dids]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (lineFilter !== 'all') list = list.filter((c) => c.line === lineFilter);
    if (dirFilter !== 'all') list = list.filter((c) => dirFilter === 'inbound' ? c.inbound : !c.inbound);
    if (selectedIds) {
      const set = new Set(selectedIds);
      list = list.filter((c) => set.has(c.owner));
    }
    return list;
  }, [enriched, lineFilter, dirFilter, selectedIds]);

  const pickerAgents = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of enriched) {
      if (lineFilter !== 'all' && c.line !== lineFilter) continue;
      counts.set(c.owner, (counts.get(c.owner) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([userId, leadCount]) => ({
        userId,
        name: userId === UNASSIGNED ? 'Unassigned' : (names[userId] ?? 'User'),
        leadCount,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [enriched, names, lineFilter]);

  const kpis = useMemo(() => {
    const inbound = filtered.filter((c) => c.inbound).length;
    const outbound = filtered.length - inbound;
    const answered = filtered.filter((c) => c.answered).length;
    const missed = filtered.filter((c) => c.outcome === 'missed').length;
    const unmatched = filtered.filter((c) => !c.lead_id).length;
    return {
      total: filtered.length,
      inbound,
      outbound,
      answeredPct: filtered.length ? Math.round((answered / filtered.length) * 100) : 0,
      missed,
      unmatched,
    };
  }, [filtered]);

  const lineStats = useMemo(() => LINES.map((id) => {
    const rows = enriched.filter((c) => c.line === id);
    const answered = rows.filter((c) => c.answered).length;
    return {
      id,
      calls: rows.length,
      answeredPct: rows.length ? Math.round((answered / rows.length) * 100) : 0,
    };
  }), [enriched]);

  const byDay = useMemo(() => {
    const map = new Map<string, { label: string; inbound: number; outbound: number; sort: string }>();
    for (const c of filtered) {
      const sort = format(c.at, 'yyyy-MM-dd');
      const row = map.get(sort) ?? { label: format(c.at, 'MMM d'), inbound: 0, outbound: 0, sort };
      if (c.inbound) row.inbound += 1;
      else row.outbound += 1;
      map.set(sort, row);
    }
    return [...map.values()].sort((a, b) => a.sort.localeCompare(b.sort));
  }, [filtered]);

  const outcomes = useMemo(() => {
    const counts = { answered: 0, missed: 0, voicemail: 0, busy: 0 };
    for (const c of filtered) counts[c.outcome] += 1;
    return [
      { name: 'Answered', value: counts.answered, color: '#10B981' },
      { name: 'Missed', value: counts.missed, color: '#F59E0B' },
      { name: 'Voicemail', value: counts.voicemail, color: '#38BDF8' },
      { name: 'Busy', value: counts.busy, color: '#F43F5E' },
    ].filter((d) => d.value > 0);
  }, [filtered]);

  const heat = useMemo(() => {
    const grid: number[][] = DOW.map(() => HOURS.map(() => 0));
    let max = 0;
    for (const c of filtered) {
      const d = c.at.getDay();
      const h = c.at.getHours();
      grid[d][h] += 1;
      if (grid[d][h] > max) max = grid[d][h];
    }
    return { grid, max: max || 1 };
  }, [filtered]);

  const tableRows = useMemo(() => {
    const map = new Map<string, { us: number; sg: number; uk: number; unmapped: number; answered: number; total: number }>();
    for (const c of filtered) {
      const row = map.get(c.owner) ?? { us: 0, sg: 0, uk: 0, unmapped: 0, answered: 0, total: 0 };
      row[c.line] += 1;
      row.total += 1;
      if (c.answered) row.answered += 1;
      map.set(c.owner, row);
    }
    return [...map.entries()]
      .map(([id, v]) => ({
        id,
        name: id === UNASSIGNED ? 'Unassigned' : (names[id] ?? 'User'),
        ...v,
        rate: v.total ? Math.round((v.answered / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, names]);

  const unmappedCount = enriched.filter((c) => c.line === 'unmapped').length;

  const exportCsv = () => {
    downloadCsv(`calling-${format(new Date(), 'yyyy-MM-dd')}.csv`, [
      ['Owner', 'US calls', 'SG calls', 'UK calls', 'Unmapped', 'Answered', 'Answer rate %', 'Total'],
      ...tableRows.map((r) => [r.name, String(r.us), String(r.sg), String(r.uk), String(r.unmapped), String(r.answered), String(r.rate), String(r.total)]),
    ]);
  };

  if (loading) return <Skeleton className="h-[480px] w-full rounded-xl" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <div>
          <h2 className="text-lg font-display font-semibold">Calling</h2>
          <p className="text-sm text-muted-foreground">
            {formatDateRangeSubtitle(date.preset, date.from, date.to)} · volume by lead owner on US / SG / UK lines
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReportDateFilter value={date} onChange={setDate} compact />
          {isAdmin && (
            <AgentTablePicker agents={pickerAgents} selectedIds={selectedIds} onChange={setSelectedIds} />
          )}
          <div className="flex rounded-lg border overflow-hidden">
            {(['all', 'outbound', 'inbound'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirFilter(d)}
                className={cn(
                  'px-2.5 py-1.5 text-[11px] font-medium capitalize',
                  dirFilter === d ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {d}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          {(lineFilter !== 'all' || selectedIds || dirFilter !== 'all') && (
            <Button variant="ghost" size="sm" className="gap-1.5 h-9" onClick={() => { setLineFilter('all'); setSelectedIds(null); setDirFilter('all'); }}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Calls', value: kpis.total, icon: Phone, color: 'text-primary' },
          { label: 'Outbound', value: kpis.outbound, icon: PhoneOutgoing, color: 'text-violet-500' },
          { label: 'Inbound', value: kpis.inbound, icon: PhoneIncoming, color: 'text-sky-500' },
          { label: 'Answer rate', value: `${kpis.answeredPct}%`, icon: Phone, color: 'text-emerald-500' },
          { label: 'Missed', value: kpis.missed, icon: PhoneOff, color: 'text-amber-500' },
          { label: 'No lead', value: kpis.unmatched, icon: Phone, color: 'text-muted-foreground' },
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
                <p className="text-sm font-semibold">{meta.label}</p>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ color: meta.color }}>{ls.calls}</p>
              <p className="text-xs text-muted-foreground mt-1">{ls.answeredPct}% answered</p>
            </button>
          );
        })}
      </div>

      {unmappedCount > 0 && (
        <p className="text-xs text-amber-600">
          {unmappedCount} call{unmappedCount === 1 ? '' : 's'} not matched to US / SG / UK — save the three numbers in Admin → CloudTalk.
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
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="card-shadow rounded-xl border-border/80 lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">Inbound vs outbound</CardTitle>
                <CardDescription>Daily volume on the selected lines</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                    <Bar dataKey="outbound" name="Outbound" stackId="a" fill="#8B5CF6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="inbound" name="Inbound" stackId="a" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="card-shadow rounded-xl border-border/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-display">Outcomes</CardTitle>
                <CardDescription>Answered, missed, voicemail</CardDescription>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={outcomes} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3}>
                      {outcomes.map((o) => <Cell key={o.name} fill={o.color} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="card-shadow rounded-xl border-border/80">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">When seats are in use</CardTitle>
              <CardDescription>Call counts by weekday and hour (lead owner timezone of this browser)</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid gap-px" style={{ gridTemplateColumns: `48px repeat(24, minmax(0, 1fr))` }}>
                  <div />
                  {HOURS.map((h) => (
                    <div key={h} className="text-[9px] text-muted-foreground text-center">{h}</div>
                  ))}
                  {DOW.map((day, di) => (
                    <Fragment key={day}>
                      <div className="text-[11px] text-muted-foreground pr-1 flex items-center justify-end">{day}</div>
                      {HOURS.map((h) => {
                        const n = heat.grid[di][h];
                        const t = n / heat.max;
                        return (
                          <div
                            key={`${day}-${h}`}
                            title={`${day} ${h}:00 · ${n} call${n === 1 ? '' : 's'}`}
                            className="h-5 rounded-sm"
                            style={{
                              backgroundColor: n === 0 ? 'hsl(var(--muted))' : `rgba(139, 92, 246, ${0.15 + t * 0.85})`,
                            }}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-shadow rounded-xl border-border/80 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Owner × line</CardTitle>
              <CardDescription>Calls credited to the lead owner on each company number</CardDescription>
            </CardHeader>
            <CardContent className="p-0 max-h-96 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">🇺🇸 US</TableHead>
                    <TableHead className="text-right">🇸🇬 SG</TableHead>
                    <TableHead className="text-right">🇬🇧 UK</TableHead>
                    <TableHead className="text-right">Answered</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.us}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.sg}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.uk}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.answered}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.rate}%</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{r.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{tableRows.reduce((s, r) => s + r.us, 0)}</TableCell>
                    <TableCell className="text-right">{tableRows.reduce((s, r) => s + r.sg, 0)}</TableCell>
                    <TableCell className="text-right">{tableRows.reduce((s, r) => s + r.uk, 0)}</TableCell>
                    <TableCell className="text-right">{tableRows.reduce((s, r) => s + r.answered, 0)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">{tableRows.reduce((s, r) => s + r.total, 0)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
