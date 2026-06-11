import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  Users, Target, Trophy, Globe, TrendingUp, TrendingDown, Download, RotateCcw,
  FileText, XCircle, CalendarDays,
} from 'lucide-react';
import {
  format, startOfDay, endOfDay, differenceInDays, eachDayOfInterval,
  eachWeekOfInterval, startOfMonth, endOfMonth,
} from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import {
  getPresetRange, getPreviousPeriodRange, getReportTitle, formatDateRangeSubtitle,
} from '@/lib/datePresets';
import { REGIONS } from '@/components/leads/LeadsFilters';
import { ReportDateFilter, type ReportDateFilterValue } from './ReportDateFilter';
import { cn } from '@/lib/utils';

type DateBasis = 'created' | 'activity';

interface LeadStatusInfo {
  name: string;
  color: string;
  sort_order: number;
}

interface ReportLead {
  id: string;
  owner_id: string | null;
  status_id: string | null;
  country_ids: string[];
  created_at: string;
  lead_statuses: LeadStatusInfo | LeadStatusInfo[] | null;
}

interface CountryInfo {
  id: string;
  name: string;
  region: string | null;
}

interface AgentRow {
  userId: string;
  name: string;
  regions: string[];
  total: number;
  byStatus: Record<string, number>;
  countries: { name: string; count: number }[];
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--popover))',
  color: 'hsl(var(--popover-foreground))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

function getStatusInfo(lead: ReportLead): LeadStatusInfo | null {
  const s = lead.lead_statuses;
  if (!s) return null;
  return Array.isArray(s) ? s[0] ?? null : s;
}

function applySecondaryFilters(
  leads: ReportLead[],
  filters: { agent: string; region: string; country: string; status: string },
  countryMap: Record<string, CountryInfo>,
): ReportLead[] {
  return leads.filter((lead) => {
    if (filters.agent && filters.agent !== 'all' && lead.owner_id !== filters.agent) return false;
    if (filters.status && filters.status !== 'all' && lead.status_id !== filters.status) return false;
    if (filters.country && filters.country !== 'all') {
      if (!lead.country_ids?.includes(filters.country)) return false;
    }
    if (filters.region && filters.region !== 'all') {
      const hasRegion = (lead.country_ids ?? []).some((cid) => countryMap[cid]?.region === filters.region);
      if (!hasRegion) return false;
    }
    return true;
  });
}

function getTimeBuckets(from: string, to: string): { label: string; from: Date; to: Date }[] {
  const start = startOfDay(new Date(from));
  const end = endOfDay(new Date(to));
  const days = differenceInDays(end, start);
  if (days <= 14) {
    return eachDayOfInterval({ start, end }).map((d) => ({
      label: format(d, 'MMM d'),
      from: startOfDay(d),
      to: endOfDay(d),
    }));
  }
  if (days <= 90) {
    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
    return weeks.map((w, i) => {
      const wEnd = new Date(w);
      wEnd.setDate(wEnd.getDate() + 6);
      const clampedEnd = wEnd > end ? end : wEnd;
      return { label: `W${i + 1}`, from: startOfDay(w), to: endOfDay(clampedEnd) };
    });
  }
  let cursor = startOfMonth(start);
  const buckets: { label: string; from: Date; to: Date }[] = [];
  while (cursor <= end) {
    const mEnd = endOfMonth(cursor) > end ? end : endOfMonth(cursor);
    buckets.push({ label: format(cursor, 'MMM yyyy'), from: cursor, to: mEnd });
    cursor = startOfMonth(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  }
  return buckets;
}

async function fetchLeadsByCreatedDate(
  from: string | null,
  to: string | null,
  ownerId?: string,
): Promise<ReportLead[]> {
  return fetchAllPaginated((pageFrom, pageTo) => {
    let q = supabase
      .from('leads')
      .select('id, owner_id, status_id, country_ids, created_at, lead_statuses(name, color, sort_order)')
      .range(pageFrom, pageTo);
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);
    if (ownerId) q = q.eq('owner_id', ownerId);
    return q;
  });
}

async function fetchLeadsByActivityDate(
  from: string,
  to: string,
  ownerId?: string,
): Promise<ReportLead[]> {
  const activities = await fetchAllPaginated<{ lead_id: string }>((pageFrom, pageTo) => {
    let q = supabase
      .from('lead_activities')
      .select('lead_id')
      .gte('created_at', from)
      .lte('created_at', to)
      .range(pageFrom, pageTo);
    return q;
  });

  const leadIds = [...new Set(activities.map((a) => a.lead_id))];
  if (leadIds.length === 0) return [];

  const BATCH = 200;
  const allLeads: ReportLead[] = [];
  for (let i = 0; i < leadIds.length; i += BATCH) {
    const batch = leadIds.slice(i, i + BATCH);
    let q = supabase
      .from('leads')
      .select('id, owner_id, status_id, country_ids, created_at, lead_statuses(name, color, sort_order)')
      .in('id', batch);
    if (ownerId) q = q.eq('owner_id', ownerId);
    const { data, error } = await q;
    if (error) throw error;
    allLeads.push(...(data ?? []));
  }
  return allLeads;
}

function KpiCard({
  label, value, subLabel, icon: Icon, accent,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <Card className="card-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={cn('text-2xl font-bold mt-1', accent)}>{value}</p>
            {subLabel && <p className="text-[11px] text-muted-foreground mt-0.5">{subLabel}</p>}
          </div>
          <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ count, color }: { count: number; color: string }) {
  if (count === 0) return <span className="text-muted-foreground/40">—</span>;
  return (
    <span
      className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {count}
    </span>
  );
}

export function LeadProductivityReport() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [dateFilter, setDateFilter] = useState<ReportDateFilterValue>(() => {
    const range = getPresetRange('this_month')!;
    return { preset: 'this_month', from: range.from, to: range.to };
  });
  const [dateBasis, setDateBasis] = useState<DateBasis>('created');
  const [agentFilter, setAgentFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<ReportLead[]>([]);
  const [prevPeriodTotal, setPrevPeriodTotal] = useState<number | null>(null);
  const [statuses, setStatuses] = useState<{ id: string; name: string; color: string; sort_order: number }[]>([]);
  const [countries, setCountries] = useState<CountryInfo[]>([]);
  const [profiles, setProfiles] = useState<{ user_id: string; full_name: string | null }[]>([]);

  const countryMap = useMemo(() => {
    const m: Record<string, CountryInfo> = {};
    countries.forEach((c) => { m[c.id] = c; });
    return m;
  }, [countries]);

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach((p) => { m[p.user_id] = p.full_name || 'Unknown'; });
    return m;
  }, [profiles]);

  const handleDateChange = (v: ReportDateFilterValue) => {
    if (v.preset !== dateFilter.preset && v.preset !== 'custom') {
      const range = getPresetRange(v.preset);
      setDateFilter({ preset: v.preset, from: range?.from ?? null, to: range?.to ?? null });
    } else {
      setDateFilter(v);
    }
  };

  const canFetch = dateFilter.preset === 'all_time'
    || dateFilter.preset !== 'custom'
    || (dateFilter.from != null && dateFilter.to != null);

  const fetchData = useCallback(async () => {
    if (!user || !canFetch) return;
    setLoading(true);
    try {
      const ownerScope = isAdmin ? undefined : user.id;

      let fetched: ReportLead[];
      if (dateBasis === 'created') {
        fetched = await fetchLeadsByCreatedDate(dateFilter.from, dateFilter.to, ownerScope);
      } else if (dateFilter.from && dateFilter.to) {
        fetched = await fetchLeadsByActivityDate(dateFilter.from, dateFilter.to, ownerScope);
      } else {
        fetched = await fetchLeadsByCreatedDate(null, null, ownerScope);
      }

      setLeads(fetched);

      if (dateFilter.from && dateFilter.to && dateFilter.preset !== 'all_time') {
        const prev = getPreviousPeriodRange(dateFilter.from, dateFilter.to);
        let prevLeads: ReportLead[];
        if (dateBasis === 'created') {
          prevLeads = await fetchLeadsByCreatedDate(prev.from, prev.to, ownerScope);
        } else {
          prevLeads = await fetchLeadsByActivityDate(prev.from, prev.to, ownerScope);
        }
        setPrevPeriodTotal(prevLeads.length);
      } else {
        setPrevPeriodTotal(null);
      }
    } catch (err) {
      console.error('Lead report fetch failed:', err);
      setLeads([]);
      setPrevPeriodTotal(null);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, dateFilter, dateBasis, canFetch]);

  useEffect(() => {
    (async () => {
      const [statusRes, countryRes, profileRes] = await Promise.all([
        supabase.from('lead_statuses').select('id, name, color, sort_order').order('sort_order'),
        supabase.from('countries').select('id, name, region').order('name'),
        supabase.from('profiles').select('user_id, full_name'),
      ]);
      if (statusRes.data) setStatuses(statusRes.data);
      if (countryRes.data) setCountries(countryRes.data);
      if (profileRes.data) setProfiles(profileRes.data);
    })();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredLeads = useMemo(
    () => applySecondaryFilters(leads, {
      agent: agentFilter,
      region: regionFilter,
      country: countryFilter,
      status: statusFilter,
    }, countryMap),
    [leads, agentFilter, regionFilter, countryFilter, statusFilter, countryMap],
  );

  const statusColumns = useMemo(
    () => statuses.length > 0
      ? statuses
      : [
          { id: 'new', name: 'New', color: '#3B82F6', sort_order: 1 },
          { id: 'contacted', name: 'Contacted', color: '#8B5CF6', sort_order: 2 },
          { id: 'qualified', name: 'Qualified', color: '#F59E0B', sort_order: 3 },
          { id: 'proposal', name: 'Proposal', color: '#06B6D4', sort_order: 4 },
          { id: 'negotiation', name: 'Negotiation', color: '#EC4899', sort_order: 5 },
          { id: 'won', name: 'Won', color: '#10B981', sort_order: 6 },
          { id: 'lost', name: 'Lost', color: '#EF4444', sort_order: 7 },
        ],
    [statuses],
  );

  const kpis = useMemo(() => {
    const total = filteredLeads.length;
    const proposal = filteredLeads.filter((l) => getStatusInfo(l)?.name === 'Proposal').length;
    const won = filteredLeads.filter((l) => getStatusInfo(l)?.name === 'Won').length;
    const lost = filteredLeads.filter((l) => getStatusInfo(l)?.name === 'Lost').length;
    const countryIds = new Set<string>();
    const regions = new Set<string>();
    filteredLeads.forEach((l) => {
      (l.country_ids ?? []).forEach((cid) => {
        countryIds.add(cid);
        const r = countryMap[cid]?.region;
        if (r) regions.add(r);
      });
    });
    const daysInRange = dateFilter.from && dateFilter.to
      ? Math.max(1, differenceInDays(new Date(dateFilter.to), new Date(dateFilter.from)) + 1)
      : 30;
    const leadsPerDay = total / daysInRange;
    const periodDelta = prevPeriodTotal != null && prevPeriodTotal > 0
      ? Math.round(((total - prevPeriodTotal) / prevPeriodTotal) * 100)
      : prevPeriodTotal === 0 && total > 0 ? 100 : null;

    return { total, proposal, won, lost, countryCount: countryIds.size, regionCount: regions.size, leadsPerDay, periodDelta };
  }, [filteredLeads, countryMap, dateFilter, prevPeriodTotal]);

  const agentRows = useMemo((): AgentRow[] => {
    const byAgent: Record<string, AgentRow> = {};

    filteredLeads.forEach((lead) => {
      const uid = lead.owner_id ?? '__unassigned__';
      if (!byAgent[uid]) {
        byAgent[uid] = {
          userId: uid,
          name: uid === '__unassigned__' ? 'Unassigned' : (profileMap[uid] ?? uid.slice(0, 8)),
          regions: [],
          total: 0,
          byStatus: {},
          countries: [],
        };
      }
      const row = byAgent[uid];
      row.total++;
      const statusName = getStatusInfo(lead)?.name ?? 'Unassigned';
      row.byStatus[statusName] = (row.byStatus[statusName] ?? 0) + 1;

      const regionSet = new Set(row.regions);
      const countryCounts: Record<string, number> = {};
      row.countries.forEach((c) => { countryCounts[c.name] = c.count; });

      (lead.country_ids ?? []).forEach((cid) => {
        const c = countryMap[cid];
        if (!c) return;
        if (c.region) regionSet.add(c.region);
        countryCounts[c.name] = (countryCounts[c.name] ?? 0) + 1;
      });
      row.regions = [...regionSet].sort();
      row.countries = Object.entries(countryCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    });

    return Object.values(byAgent).sort((a, b) => b.total - a.total);
  }, [filteredLeads, profileMap, countryMap]);

  const teamTotals = useMemo(() => {
    const byStatus: Record<string, number> = {};
    statusColumns.forEach((s) => { byStatus[s.name] = 0; });
    filteredLeads.forEach((l) => {
      const name = getStatusInfo(l)?.name ?? 'Unassigned';
      byStatus[name] = (byStatus[name] ?? 0) + 1;
    });
    return { total: filteredLeads.length, byStatus };
  }, [filteredLeads, statusColumns]);

  const funnelData = useMemo(
    () => statusColumns.map((s) => ({
      stage: s.name,
      count: teamTotals.byStatus[s.name] ?? 0,
      fill: s.color,
    })),
    [statusColumns, teamTotals],
  );

  const timeSeriesData = useMemo(() => {
    if (!dateFilter.from || !dateFilter.to) return [];
    const buckets = getTimeBuckets(dateFilter.from, dateFilter.to);
    return buckets.map((b) => ({
      label: b.label,
      leads: filteredLeads.filter((l) => {
        const d = new Date(l.created_at);
        return d >= b.from && d <= b.to;
      }).length,
    }));
  }, [filteredLeads, dateFilter]);

  const regionData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      const ids = l.country_ids ?? [];
      if (ids.length === 0) {
        counts['Other'] = (counts['Other'] ?? 0) + 1;
        return;
      }
      ids.forEach((cid) => {
        const region = countryMap[cid]?.region ?? 'Other';
        counts[region] = (counts[region] ?? 0) + 1;
      });
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredLeads, countryMap]);

  const topCountriesData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach((l) => {
      (l.country_ids ?? []).forEach((cid) => {
        const name = countryMap[cid]?.name ?? 'Other';
        counts[name] = (counts[name] ?? 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filteredLeads, countryMap]);

  const radarData = useMemo(() => {
    if (!isAdmin || agentRows.length < 2) return [];
    const maxLeads = Math.max(...agentRows.map((a) => a.total), 1);
    const maxWon = Math.max(...agentRows.map((a) => a.byStatus['Won'] ?? 0), 1);
    const maxProposal = Math.max(...agentRows.map((a) => a.byStatus['Proposal'] ?? 0), 1);
    const maxCountries = Math.max(...agentRows.map((a) => a.countries.length), 1);

    return agentRows.slice(0, 5).map((a) => ({
      agent: a.name.split(' ')[0],
      leads: Math.round((a.total / maxLeads) * 100),
      winRate: Math.round(((a.byStatus['Won'] ?? 0) / Math.max(a.total, 1)) * 100),
      proposals: Math.round(((a.byStatus['Proposal'] ?? 0) / maxProposal) * 100),
      reach: Math.round((a.countries.length / maxCountries) * 100),
    }));
  }, [agentRows, isAdmin]);

  const exportCsv = () => {
    const headers = ['Agent', 'Total', ...statusColumns.map((s) => s.name)];
    const rows = agentRows.map((a) => [
      a.name,
      a.total,
      ...statusColumns.map((s) => a.byStatus[s.name] ?? 0),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lead-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setAgentFilter('all');
    setRegionFilter('all');
    setCountryFilter('all');
    setStatusFilter('all');
  };

  const hasSecondaryFilters = agentFilter !== 'all' || regionFilter !== 'all'
    || countryFilter !== 'all' || statusFilter !== 'all';

  const rangeSubtitle = formatDateRangeSubtitle(dateFilter.preset, dateFilter.from, dateFilter.to);
  const reportTitle = getReportTitle(dateFilter.preset, dateFilter.from, dateFilter.to);

  if (dateFilter.preset === 'custom' && (!dateFilter.from || !dateFilter.to)) {
    return (
      <div className="space-y-6">
        <ReportHeader
          title={reportTitle}
          dateBasis={dateBasis}
          onDateBasisChange={setDateBasis}
          dateFilter={dateFilter}
          onDateChange={handleDateChange}
          isAdmin={isAdmin}
          agentFilter={agentFilter}
          onAgentChange={setAgentFilter}
          regionFilter={regionFilter}
          onRegionChange={setRegionFilter}
          countryFilter={countryFilter}
          onCountryChange={setCountryFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          profiles={profiles}
          countries={countries}
          statuses={statuses}
          onExport={exportCsv}
        />
        <Card className="card-shadow">
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>Select a start and end date for the custom range.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportHeader
        title={reportTitle}
        dateBasis={dateBasis}
        onDateBasisChange={setDateBasis}
        dateFilter={dateFilter}
        onDateChange={handleDateChange}
        isAdmin={isAdmin}
        agentFilter={agentFilter}
        onAgentChange={setAgentFilter}
        regionFilter={regionFilter}
        onRegionChange={setRegionFilter}
        countryFilter={countryFilter}
        onCountryChange={setCountryFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        profiles={profiles}
        countries={countries}
        statuses={statuses}
        onExport={exportCsv}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : filteredLeads.length === 0 ? (
        <Card className="card-shadow">
          <CardContent className="py-12 text-center">
            <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No leads match the current filters.</p>
            {hasSecondaryFilters && (
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={clearFilters}>
                <RotateCcw className="h-3.5 w-3.5" />
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <KpiCard label="Total leads" value={kpis.total} subLabel={rangeSubtitle || undefined} icon={Users} />
            <KpiCard
              label="Proposal / NDA sent"
              value={kpis.proposal}
              subLabel={kpis.total ? `${((kpis.proposal / kpis.total) * 100).toFixed(1)}% of total` : undefined}
              icon={Target}
              accent="text-sky-400"
            />
            <KpiCard
              label="Closed won"
              value={kpis.won}
              subLabel={kpis.total ? `${((kpis.won / kpis.total) * 100).toFixed(1)}% win rate` : undefined}
              icon={Trophy}
              accent="text-emerald-400"
            />
            <KpiCard
              label="Countries covered"
              value={kpis.countryCount}
              subLabel={`${kpis.regionCount} region${kpis.regionCount !== 1 ? 's' : ''}`}
              icon={Globe}
            />
            <KpiCard
              label="Lost"
              value={kpis.lost}
              subLabel={kpis.total ? `${((kpis.lost / kpis.total) * 100).toFixed(1)}% loss rate` : undefined}
              icon={XCircle}
              accent="text-rose-400"
            />
            <KpiCard
              label="Leads / day"
              value={kpis.leadsPerDay.toFixed(1)}
              subLabel="avg in period"
              icon={TrendingUp}
            />
            <KpiCard
              label="Period change"
              value={kpis.periodDelta != null ? `${kpis.periodDelta > 0 ? '+' : ''}${kpis.periodDelta}%` : '—'}
              subLabel="vs previous period"
              icon={kpis.periodDelta != null && kpis.periodDelta >= 0 ? TrendingUp : TrendingDown}
              accent={kpis.periodDelta != null && kpis.periodDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}
            />
          </div>

          {/* Agent performance table */}
          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Agent performance</CardTitle>
              <CardDescription>Lead status breakdown by owner</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    {statusColumns.map((s) => (
                      <TableHead key={s.id} className="text-center">{s.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentRows.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{row.name}</p>
                          {row.regions.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">{row.regions.join(' · ')}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-semibold">{row.total}</TableCell>
                      {statusColumns.map((s) => (
                        <TableCell key={s.id} className="text-center">
                          <StatusBadge count={row.byStatus[s.name] ?? 0} color={s.color} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                {isAdmin && agentRows.length > 1 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Team total</TableCell>
                      <TableCell className="text-center font-bold">{teamTotals.total}</TableCell>
                      {statusColumns.map((s) => (
                        <TableCell key={s.id} className="text-center">
                          <StatusBadge count={teamTotals.byStatus[s.name] ?? 0} color={s.color} />
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </CardContent>
          </Card>

          {/* Country coverage */}
          <Card className="card-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Country coverage by agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentRows.map((row) => (
                <div key={row.userId}>
                  <p className="text-sm font-medium mb-2">
                    {row.name}
                    <span className="text-muted-foreground font-normal ml-1.5">
                      ({row.countries.length} countr{row.countries.length !== 1 ? 'ies' : 'y'})
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {row.countries.map((c) => (
                      <Badge key={c.name} variant="outline" className="text-xs font-normal">
                        {c.name} {c.count}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Conversion funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={funnelData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {timeSeriesData.length > 0 && (
              <Card className="card-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Leads over time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {regionData.length > 0 && (
              <Card className="card-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Region breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={regionData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {regionData.map((_, i) => (
                          <Cell key={i} fill={`hsl(${(i * 47) % 360}, 60%, 55%)`} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {topCountriesData.length > 0 && (
              <Card className="card-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Top countries</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={topCountriesData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Bar dataKey="count" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {radarData.length > 0 && (
              <Card className="card-shadow lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold">Agent comparison</CardTitle>
                  <CardDescription>Normalized scores across key metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="agent" tick={{ fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <Radar name="Leads" dataKey="leads" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.2} />
                      <Radar name="Win rate" dataKey="winRate" stroke="#10B981" fill="#10B981" fillOpacity={0.2} />
                      <Radar name="Proposals" dataKey="proposals" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.2} />
                      <Radar name="Country reach" dataKey="reach" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.2} />
                      <Legend />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Data from RemoAsset · {format(new Date(), 'yyyy-MM-dd')}
          </p>
        </>
      )}
    </div>
  );
}

function ReportHeader({
  title, dateBasis, onDateBasisChange, dateFilter, onDateChange,
  isAdmin, agentFilter, onAgentChange, regionFilter, onRegionChange,
  countryFilter, onCountryChange, statusFilter, onStatusChange,
  profiles, countries, statuses, onExport,
}: {
  title: string;
  dateBasis: DateBasis;
  onDateBasisChange: (v: DateBasis) => void;
  dateFilter: ReportDateFilterValue;
  onDateChange: (v: ReportDateFilterValue) => void;
  isAdmin: boolean;
  agentFilter: string;
  onAgentChange: (v: string) => void;
  regionFilter: string;
  onRegionChange: (v: string) => void;
  countryFilter: string;
  onCountryChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  profiles: { user_id: string; full_name: string | null }[];
  countries: CountryInfo[];
  statuses: { id: string; name: string }[];
  onExport: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">{title}</h2>
          <Badge variant="outline" className="mt-1.5 text-xs font-normal">
            Live · as of {format(new Date(), 'MMM d, yyyy')}
          </Badge>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={onExport}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-end gap-4 flex-wrap">
        <ToggleGroup
          type="single"
          value={dateBasis}
          onValueChange={(v) => { if (v) onDateBasisChange(v as DateBasis); }}
          className="justify-start"
        >
          <ToggleGroupItem value="created" className="text-xs h-8 px-3">Created date</ToggleGroupItem>
          <ToggleGroupItem value="activity" className="text-xs h-8 px-3">Activity / status change</ToggleGroupItem>
        </ToggleGroup>

        <ReportDateFilter value={dateFilter} onChange={onDateChange} />

        {isAdmin && (
          <Select value={agentFilter} onValueChange={onAgentChange}>
            <SelectTrigger className="h-9 w-[160px] text-xs">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {profiles.map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || 'Unknown'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={regionFilter} onValueChange={onRegionChange}>
          <SelectTrigger className="h-9 w-[130px] text-xs">
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {REGIONS.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={countryFilter} onValueChange={onCountryChange}>
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="All countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
