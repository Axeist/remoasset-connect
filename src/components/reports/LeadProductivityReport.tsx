import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { AgentTablePicker } from './AgentTablePicker';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  Users, Target, Trophy, Globe, TrendingUp, TrendingDown, Download, RotateCcw,
  FileText, XCircle, CalendarDays, SlidersHorizontal,
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

interface ReportActivity {
  user_id: string;
  activity_type: string;
  lead_id: string;
}

interface TableColumn {
  id: string;
  name: string;
  color: string;
}

interface AgentRow {
  userId: string;
  name: string;
  regions: string[];
  total: number;
  byStatus: Record<string, number>;
  byActivity: Record<string, number>;
  countries: { name: string; count: number }[];
}

const ACTIVITY_TABLE_COLUMNS: TableColumn[] = [
  { id: 'call', name: 'Calls', color: '#EA6E35' },
  { id: 'email', name: 'Emails', color: '#F09A72' },
  { id: 'meeting', name: 'Meetings', color: '#3B9B6D' },
  { id: 'whatsapp', name: 'WhatsApp', color: '#25d366' },
  { id: 'linkedin', name: 'LinkedIn', color: '#0ea5e9' },
  { id: 'nda', name: 'NDA', color: '#30282B' },
  { id: 'quotation', name: 'Quotation', color: '#d97706' },
  { id: 'note', name: 'Notes', color: '#6E7180' },
];

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
  filters: { region: string; country: string; status: string },
  countryMap: Record<string, CountryInfo>,
): ReportLead[] {
  return leads.filter((lead) => {
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

async function fetchActivitiesInRange(
  from: string | null,
  to: string | null,
  ownerId?: string,
): Promise<ReportActivity[]> {
  return fetchAllPaginated((pageFrom, pageTo) => {
    let q = supabase
      .from('lead_activities')
      .select('user_id, activity_type, lead_id')
      .range(pageFrom, pageTo);
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lte('created_at', to);
    if (ownerId) q = q.eq('user_id', ownerId);
    return q;
  });
}

function buildAgentCountries(
  leads: ReportLead[],
  countryMap: Record<string, CountryInfo>,
): Map<string, { regions: string[]; countries: { name: string; count: number }[] }> {
  const map = new Map<string, { regions: string[]; countries: { name: string; count: number }[] }>();

  leads.forEach((lead) => {
    const uid = lead.owner_id ?? '__unassigned__';
    if (!map.has(uid)) {
      map.set(uid, { regions: [], countries: [] });
    }
    const entry = map.get(uid)!;
    const regionSet = new Set(entry.regions);
    const countryCounts: Record<string, number> = {};
    entry.countries.forEach((c) => { countryCounts[c.name] = c.count; });

    (lead.country_ids ?? []).forEach((cid) => {
      const c = countryMap[cid];
      if (!c) return;
      if (c.region) regionSet.add(c.region);
      countryCounts[c.name] = (countryCounts[c.name] ?? 0) + 1;
    });

    entry.regions = [...regionSet].sort();
    entry.countries = Object.entries(countryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  });

  return map;
}

function KpiCard({
  label, value, subLabel, icon: Icon, accent, iconBg,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: React.ElementType;
  accent?: string;
  iconBg?: string;
}) {
  return (
    <div className="flex h-full min-h-[104px] flex-col justify-between rounded-xl border border-border/80 bg-card px-4 py-3.5 transition-all hover:border-border hover:shadow-sm">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg ?? 'bg-primary/10')}>
        <Icon className={cn('h-4 w-4', accent ?? 'text-primary')} />
      </div>
      <div className="mt-3 min-w-0">
        <p className={cn('text-2xl font-bold leading-none tracking-tight', accent ?? 'text-foreground')}>{value}</p>
        <p className="text-xs font-medium text-muted-foreground leading-tight mt-1.5">{label}</p>
        {subLabel && <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{subLabel}</p>}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground leading-none">{label}</Label>
      <div className="w-full [&_button]:w-full [&_[role=combobox]]:w-full">{children}</div>
    </div>
  );
}

function StatusCell({ count, color }: { count: number; color: string }) {
  if (count === 0) {
    return <span className="text-base text-muted-foreground/30 font-medium">—</span>;
  }
  return (
    <div className="inline-flex flex-col items-center gap-1">
      <span
        className="inline-flex items-center justify-center min-w-[2.25rem] h-9 px-2.5 rounded-lg text-base font-bold text-white shadow-sm"
        style={{ backgroundColor: color }}
      >
        {count}
      </span>
    </div>
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
  const [tableAgentIds, setTableAgentIds] = useState<string[] | null>(null);
  const [regionFilter, setRegionFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<ReportLead[]>([]);
  const [activities, setActivities] = useState<ReportActivity[]>([]);
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

      const activityFrom = dateFilter.preset === 'all_time' ? null : dateFilter.from;
      const activityTo = dateFilter.preset === 'all_time' ? null : dateFilter.to;
      if (dateFilter.preset !== 'custom' || (activityFrom && activityTo)) {
        const activityData = await fetchActivitiesInRange(activityFrom, activityTo, ownerScope);
        setActivities(activityData);
      } else {
        setActivities([]);
      }

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
      setActivities([]);
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
      region: regionFilter,
      country: countryFilter,
      status: statusFilter,
    }, countryMap),
    [leads, regionFilter, countryFilter, statusFilter, countryMap],
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

  const isActivityTable = dateBasis === 'activity';

  const statusAgentRows = useMemo((): AgentRow[] => {
    const geoByAgent = buildAgentCountries(filteredLeads, countryMap);
    const byAgent: Record<string, AgentRow> = {};

    filteredLeads.forEach((lead) => {
      const uid = lead.owner_id ?? '__unassigned__';
      if (!byAgent[uid]) {
        const geo = geoByAgent.get(uid);
        byAgent[uid] = {
          userId: uid,
          name: uid === '__unassigned__' ? 'Unassigned' : (profileMap[uid] ?? uid.slice(0, 8)),
          regions: geo?.regions ?? [],
          total: 0,
          byStatus: {},
          byActivity: {},
          countries: geo?.countries ?? [],
        };
      }
      const row = byAgent[uid];
      row.total++;
      const statusName = getStatusInfo(lead)?.name ?? 'Unassigned';
      row.byStatus[statusName] = (row.byStatus[statusName] ?? 0) + 1;
    });

    return Object.values(byAgent).sort((a, b) => b.total - a.total);
  }, [filteredLeads, profileMap, countryMap]);

  const activityAgentRows = useMemo((): AgentRow[] => {
    const filteredLeadIds = new Set(filteredLeads.map((l) => l.id));
    const geoByAgent = buildAgentCountries(filteredLeads, countryMap);
    const byAgent: Record<string, AgentRow> = {};

    activities.forEach((act) => {
      if (!filteredLeadIds.has(act.lead_id)) return;
      const uid = act.user_id || '__unassigned__';
      if (!byAgent[uid]) {
        const geo = geoByAgent.get(uid);
        byAgent[uid] = {
          userId: uid,
          name: uid === '__unassigned__' ? 'Unassigned' : (profileMap[uid] ?? uid.slice(0, 8)),
          regions: geo?.regions ?? [],
          total: 0,
          byStatus: {},
          byActivity: {},
          countries: geo?.countries ?? [],
        };
      }
      const row = byAgent[uid];
      row.total++;
      const type = act.activity_type || 'other';
      row.byActivity[type] = (row.byActivity[type] ?? 0) + 1;
    });

    return Object.values(byAgent).sort((a, b) => b.total - a.total);
  }, [activities, filteredLeads, profileMap, countryMap]);

  const agentRows = isActivityTable ? activityAgentRows : statusAgentRows;

  const tableColumns = useMemo((): TableColumn[] => {
    if (!isActivityTable) return statusColumns;
    const knownIds = new Set(ACTIVITY_TABLE_COLUMNS.map((c) => c.id));
    const extras = new Set<string>();
    activityAgentRows.forEach((row) => {
      Object.keys(row.byActivity).forEach((type) => {
        if (!knownIds.has(type)) extras.add(type);
      });
    });
    const extraCols = [...extras].sort().map((type) => ({
      id: type,
      name: type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' '),
      color: '#6E7180',
    }));
    return [...ACTIVITY_TABLE_COLUMNS, ...extraCols];
  }, [isActivityTable, statusColumns, activityAgentRows]);

  const getColumnCount = useCallback((row: AgentRow, col: TableColumn) => {
    if (isActivityTable) return row.byActivity[col.id] ?? 0;
    return row.byStatus[col.name] ?? 0;
  }, [isActivityTable]);

  const displayAgentRows = useMemo(() => {
    if (!tableAgentIds) return agentRows;
    return agentRows.filter((r) => tableAgentIds.includes(r.userId));
  }, [agentRows, tableAgentIds]);

  const displayTeamTotals = useMemo(() => {
    const breakdown: Record<string, number> = {};
    tableColumns.forEach((c) => { breakdown[c.id] = 0; });
    let total = 0;
    displayAgentRows.forEach((row) => {
      total += row.total;
      tableColumns.forEach((col) => {
        breakdown[col.id] = (breakdown[col.id] ?? 0) + getColumnCount(row, col);
      });
    });
    return { total, breakdown };
  }, [displayAgentRows, tableColumns, getColumnCount]);

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
    const headers = ['Agent', 'Total', ...tableColumns.map((c) => c.name)];
    const rows = displayAgentRows.map((a) => [
      a.name,
      a.total,
      ...tableColumns.map((c) => getColumnCount(a, c)),
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
    setRegionFilter('all');
    setCountryFilter('all');
    setStatusFilter('all');
    setTableAgentIds(null);
  };

  const hasSecondaryFilters = regionFilter !== 'all' || countryFilter !== 'all'
    || statusFilter !== 'all' || tableAgentIds !== null;

  const rangeSubtitle = formatDateRangeSubtitle(dateFilter.preset, dateFilter.from, dateFilter.to);
  const reportTitle = getReportTitle(dateFilter.preset, dateFilter.from, dateFilter.to);

  if (dateFilter.preset === 'custom' && (!dateFilter.from || !dateFilter.to)) {
    return (
      <div className="space-y-6">
        <ReportFiltersBar
          title={reportTitle}
          rangeSubtitle={rangeSubtitle}
          dateBasis={dateBasis}
          onDateBasisChange={setDateBasis}
          dateFilter={dateFilter}
          onDateChange={handleDateChange}
          isAdmin={isAdmin}
          tableAgentIds={tableAgentIds}
          onTableAgentIdsChange={setTableAgentIds}
          agentOptions={[]}
          regionFilter={regionFilter}
          onRegionChange={setRegionFilter}
          countryFilter={countryFilter}
          onCountryChange={setCountryFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          countries={countries}
          statuses={statuses}
          onExport={exportCsv}
          onClearFilters={clearFilters}
          hasFilters={hasSecondaryFilters}
        />
        <Card className="card-shadow rounded-xl border-border/80">
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
      <ReportFiltersBar
        title={reportTitle}
        rangeSubtitle={rangeSubtitle}
        dateBasis={dateBasis}
        onDateBasisChange={setDateBasis}
        dateFilter={dateFilter}
        onDateChange={handleDateChange}
        isAdmin={isAdmin}
        tableAgentIds={tableAgentIds}
        onTableAgentIdsChange={setTableAgentIds}
        agentOptions={agentRows.map((r) => ({ userId: r.userId, name: r.name, leadCount: r.total }))}
        regionFilter={regionFilter}
        onRegionChange={setRegionFilter}
        countryFilter={countryFilter}
        onCountryChange={setCountryFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        countries={countries}
        statuses={statuses}
        onExport={exportCsv}
        onClearFilters={clearFilters}
        hasFilters={hasSecondaryFilters}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-[104px] rounded-xl" />
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
          {/* KPI cards — single symmetrical grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <KpiCard label="Total leads" value={kpis.total} subLabel={rangeSubtitle || undefined} icon={Users} iconBg="bg-primary/10" />
            <KpiCard
              label="Proposal / NDA"
              value={kpis.proposal}
              subLabel={kpis.total ? `${((kpis.proposal / kpis.total) * 100).toFixed(1)}% of total` : undefined}
              icon={Target}
              accent="text-sky-500"
              iconBg="bg-sky-500/10"
            />
            <KpiCard
              label="Closed won"
              value={kpis.won}
              subLabel={kpis.total ? `${((kpis.won / kpis.total) * 100).toFixed(1)}% win rate` : undefined}
              icon={Trophy}
              accent="text-emerald-500"
              iconBg="bg-emerald-500/10"
            />
            <KpiCard
              label="Countries"
              value={kpis.countryCount}
              subLabel={`${kpis.regionCount} region${kpis.regionCount !== 1 ? 's' : ''}`}
              icon={Globe}
              iconBg="bg-violet-500/10"
              accent="text-violet-500"
            />
            <KpiCard
              label="Lost"
              value={kpis.lost}
              subLabel={kpis.total ? `${((kpis.lost / kpis.total) * 100).toFixed(1)}% loss rate` : undefined}
              icon={XCircle}
              accent="text-rose-500"
              iconBg="bg-rose-500/10"
            />
            <KpiCard
              label="Leads / day"
              value={kpis.leadsPerDay.toFixed(1)}
              subLabel="Avg in period"
              icon={TrendingUp}
              iconBg="bg-amber-500/10"
              accent="text-amber-600"
            />
            <KpiCard
              label="Period change"
              value={kpis.periodDelta != null ? `${kpis.periodDelta > 0 ? '+' : ''}${kpis.periodDelta}%` : '—'}
              subLabel="vs prev. period"
              icon={kpis.periodDelta != null && kpis.periodDelta >= 0 ? TrendingUp : TrendingDown}
              accent={kpis.periodDelta != null && kpis.periodDelta >= 0 ? 'text-emerald-500' : 'text-rose-500'}
              iconBg={kpis.periodDelta != null && kpis.periodDelta >= 0 ? 'bg-emerald-500/10' : 'bg-rose-500/10'}
            />
          </div>

          {/* Agent performance table */}
          <Card className="card-shadow rounded-xl border-border/80 overflow-hidden">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg font-semibold">Agent performance</CardTitle>
              <CardDescription className="text-sm">
                {isActivityTable
                  ? 'Activity counts by agent in the selected period'
                  : 'Lead status breakdown by owner'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[200px] text-sm font-semibold sticky left-0 bg-muted z-10">Agent</TableHead>
                      <TableHead className="text-center text-sm font-semibold w-20">
                        {isActivityTable ? 'Activities' : 'Total'}
                      </TableHead>
                      {tableColumns.map((col) => (
                        <TableHead key={col.id} className="text-center text-sm font-semibold min-w-[72px]">
                          <div className="flex flex-col items-center gap-1 py-1">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                            <span>{col.name}</span>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayAgentRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={tableColumns.length + 2} className="text-center py-10 text-muted-foreground">
                          {isActivityTable
                            ? 'No activities found for the selected filters and period.'
                            : 'No agents selected. Use the agent picker above to choose who appears in the table.'}
                        </TableCell>
                      </TableRow>
                    ) : displayAgentRows.map((row) => (
                      <TableRow key={row.userId} className="hover:bg-muted/30">
                        <TableCell className="sticky left-0 bg-card z-10 py-4">
                          <p className="font-semibold text-base text-foreground">{row.name}</p>
                          {row.regions.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">{row.regions.join(' · ')}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-4">
                          <span className="text-lg font-bold text-foreground">{row.total}</span>
                        </TableCell>
                        {tableColumns.map((col) => (
                          <TableCell key={col.id} className="text-center py-4">
                            <StatusCell count={getColumnCount(row, col)} color={col.color} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                  {isAdmin && displayAgentRows.length > 1 && (
                    <TableFooter>
                      <TableRow className="bg-muted/40">
                        <TableCell className="font-bold text-base sticky left-0 bg-muted/40 z-10">Team total</TableCell>
                        <TableCell className="text-center">
                          <span className="text-lg font-bold">{displayTeamTotals.total}</span>
                        </TableCell>
                        {tableColumns.map((col) => (
                          <TableCell key={col.id} className="text-center">
                            <StatusCell count={displayTeamTotals.breakdown[col.id] ?? 0} color={col.color} />
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Country coverage */}
          <Card className="card-shadow rounded-xl border-border/80">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-lg font-semibold">Country coverage by agent</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-5">
              {displayAgentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Select agents to view country coverage.</p>
              ) : displayAgentRows.map((row) => (
                <div key={row.userId} className="rounded-lg border border-border/60 bg-muted/10 p-4">
                  <p className="text-base font-semibold mb-3">
                    {row.name}
                    <span className="text-muted-foreground font-normal text-sm ml-2">
                      {row.countries.length} {row.countries.length === 1 ? 'country' : 'countries'}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {row.countries.map((c) => (
                      <Badge key={c.name} variant="secondary" className="text-sm font-medium px-3 py-1">
                        {c.name}
                        <span className="ml-1.5 text-muted-foreground">{c.count}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="card-shadow rounded-xl border-border/80">
              <CardHeader className="pb-2 border-b bg-muted/20">
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

function ReportFiltersBar({
  title, rangeSubtitle, dateBasis, onDateBasisChange, dateFilter, onDateChange,
  isAdmin, tableAgentIds, onTableAgentIdsChange, agentOptions,
  regionFilter, onRegionChange, countryFilter, onCountryChange,
  statusFilter, onStatusChange, countries, statuses, onExport,
  onClearFilters, hasFilters,
}: {
  title: string;
  rangeSubtitle: string;
  dateBasis: DateBasis;
  onDateBasisChange: (v: DateBasis) => void;
  dateFilter: ReportDateFilterValue;
  onDateChange: (v: ReportDateFilterValue) => void;
  isAdmin: boolean;
  tableAgentIds: string[] | null;
  onTableAgentIdsChange: (ids: string[] | null) => void;
  agentOptions: { userId: string; name: string; leadCount: number }[];
  regionFilter: string;
  onRegionChange: (v: string) => void;
  countryFilter: string;
  onCountryChange: (v: string) => void;
  statusFilter: string;
  onStatusChange: (v: string) => void;
  countries: CountryInfo[];
  statuses: { id: string; name: string; color?: string }[];
  onExport: () => void;
  onClearFilters: () => void;
  hasFilters: boolean;
}) {
  return (
    <Card className="card-shadow rounded-xl border-border/80">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-display font-bold text-foreground tracking-tight">{title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <Badge variant="secondary" className="text-xs font-normal">
                Live · {format(new Date(), 'MMM d, yyyy')}
              </Badge>
              {rangeSubtitle && (
                <span className="text-sm text-muted-foreground">{rangeSubtitle}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {hasFilters && (
              <Button variant="ghost" size="sm" className="gap-1.5 h-9 text-muted-foreground" onClick={onClearFilters}>
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={onExport}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            Filters
          </div>
        </div>

        <div
          className={cn(
            'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3',
            isAdmin && agentOptions.length > 0 ? 'xl:grid-cols-6' : 'xl:grid-cols-5',
          )}
        >
          <FilterField label="Count leads by">
            <div className="flex h-9 items-center rounded-md border border-input bg-background p-0.5">
              {([
                { value: 'created' as const, label: 'Created' },
                { value: 'activity' as const, label: 'Activity' },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onDateBasisChange(opt.value)}
                  className={cn(
                    'flex h-full flex-1 items-center justify-center rounded-[5px] px-2 text-sm font-medium transition-all',
                    dateBasis === opt.value
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FilterField>

          <FilterField label="Date range">
            <ReportDateFilter value={dateFilter} onChange={onDateChange} compact className="w-full" triggerClassName="w-full" />
          </FilterField>

          <FilterField label="Region">
            <Select value={regionFilter} onValueChange={onRegionChange}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue placeholder="All regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Country">
            <Select value={countryFilter} onValueChange={onCountryChange}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue placeholder="All countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All countries</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Status">
            <Select value={statusFilter} onValueChange={onStatusChange}>
              <SelectTrigger className="h-9 w-full text-sm">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      {s.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />}
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          {isAdmin && agentOptions.length > 0 && (
            <FilterField label="Agents in table">
              <AgentTablePicker
                agents={agentOptions}
                selectedIds={tableAgentIds}
                onChange={onTableAgentIdsChange}
                className="w-full"
              />
            </FilterField>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
