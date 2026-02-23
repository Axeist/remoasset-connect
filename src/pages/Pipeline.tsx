import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  SlidersHorizontal,
  RotateCcw,
  CalendarDays,
  X,
  Kanban,
  Layers,
  Activity,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  FileText,
  MessageCircle,
  Linkedin,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths, startOfYear } from 'date-fns';
import type { Lead, LeadStatusOption, CountryOption } from '@/types/lead';
import { KanbanColumn } from '@/components/pipeline/KanbanColumn';
import { KanbanCard, StaticKanbanCard } from '@/components/pipeline/KanbanCard';
import { StaticKanbanColumn } from '@/components/pipeline/StaticKanbanColumn';
import { PipelineWidgets } from '@/components/pipeline/PipelineWidgets';
import { MoveCommentDialog } from '@/components/pipeline/MoveCommentDialog';
import { AddActivityDialog } from '@/components/leads/AddActivityDialog';

// ------- Activity columns config -------

const ACTIVITY_COLUMNS = [
  { id: '__no_activity__', label: 'No Activity', color: '#6b7280', icon: FileText },
  { id: 'call', label: 'Call', color: '#3b82f6', icon: Phone },
  { id: 'email', label: 'Email Sent', color: '#f97316', icon: Mail },
  { id: 'meeting', label: 'Meeting', color: '#22c55e', icon: CalendarIcon },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', icon: MessageCircle },
  { id: 'linkedin', label: 'LinkedIn', color: '#0ea5e9', icon: Linkedin },
  { id: 'nda', label: 'NDA', color: '#6366f1', icon: ShieldCheck },
];

// ------- Filter types -------

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'last_3_months', label: 'Last 3 Months' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

function getPresetRange(preset: string): { from: string; to: string } | null {
  const now = new Date();
  switch (preset) {
    case 'today': return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case 'yesterday': { const y = subDays(now, 1); return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }; }
    case 'this_week': return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: endOfWeek(now, { weekStartsOn: 1 }).toISOString() };
    case 'last_week': { const s = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7); return { from: s.toISOString(), to: endOfWeek(s, { weekStartsOn: 1 }).toISOString() }; }
    case 'this_month': return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    case 'last_month': { const m = subMonths(now, 1); return { from: startOfMonth(m).toISOString(), to: endOfMonth(m).toISOString() }; }
    case 'last_3_months': return { from: subMonths(now, 3).toISOString(), to: now.toISOString() };
    case 'this_year': return { from: startOfYear(now).toISOString(), to: now.toISOString() };
    default: return null;
  }
}

interface Filters {
  search: string;
  owner: string;
  country: string;
  datePreset: string;
  dateFrom: string;
  dateTo: string;
  scoreMin: number;
  scoreMax: number;
}

const EMPTY_FILTERS: Filters = { search: '', owner: '', country: '', datePreset: '', dateFrom: '', dateTo: '', scoreMin: 0, scoreMax: 100 };

type ViewMode = 'status' | 'activity';

// ------- Pending move type for comment dialog -------

interface PendingMove {
  leadId: string;
  lead: Lead;
  targetStatusId: string | null;
  fromStatusName: string;
  toStatusName: string;
}

// ------- Page -------

interface PipelineProps {
  pageTitle: string;
  adminOnly?: boolean;
}

export default function Pipeline({ pageTitle, adminOnly }: PipelineProps) {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('status');
  const [statuses, setStatuses] = useState<LeadStatusOption[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lastActivityMap, setLastActivityMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [owners, setOwners] = useState<{ id: string; full_name: string | null }[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Move comment dialog state
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moveSubmitting, setMoveSubmitting] = useState(false);

  // Add activity dialog state
  const [activityLead, setActivityLead] = useState<Lead | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  // Fetch reference data
  useEffect(() => {
    const fetchRef = async () => {
      const [statusRes, countryRes, ownerRes] = await Promise.all([
        supabase.from('lead_statuses').select('id, name, color, sort_order').order('sort_order'),
        supabase.from('countries').select('id, name, code').order('name'),
        supabase.from('profiles').select('user_id, full_name'),
      ]);
      if (statusRes.data) setStatuses(statusRes.data);
      if (countryRes.data) setCountries(countryRes.data);
      if (ownerRes.data) setOwners(ownerRes.data.map((p) => ({ id: p.user_id, full_name: p.full_name })));
    };
    fetchRef();
  }, []);

  // Fetch leads + last activity per lead
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('leads')
      .select('id, company_name, contact_name, email, phone, lead_score, status_id, owner_id, country_id, created_at, updated_at, website, contact_designation, notes, status:lead_statuses(name, color), country:countries(name, code)')
      .order('lead_score', { ascending: false });

    if (role === 'employee' && user) {
      query = query.eq('owner_id', user.id);
    }

    if (filters.search) {
      query = query.or(`company_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }
    if (filters.owner) {
      if (filters.owner === 'unassigned') query = query.is('owner_id', null);
      else query = query.eq('owner_id', filters.owner);
    }
    if (filters.country) query = query.eq('country_id', filters.country);
    if (filters.scoreMin > 0) query = query.gte('lead_score', filters.scoreMin);
    if (filters.scoreMax < 100) query = query.lte('lead_score', filters.scoreMax);

    let dateFrom = filters.dateFrom;
    let dateTo = filters.dateTo;
    if (filters.datePreset && filters.datePreset !== 'custom') {
      const range = getPresetRange(filters.datePreset);
      if (range) { dateFrom = range.from; dateTo = range.to; }
    }
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data, error } = await query;
    if (error) {
      toast({ variant: 'destructive', title: 'Error loading leads' });
    }

    const rawLeads = (data ?? []) as (Lead & { owner_id?: string | null })[];
    const ownerIds = [...new Set(rawLeads.map((l) => l.owner_id).filter(Boolean))] as string[];
    let ownerMap: Record<string, { full_name: string | null }> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ownerIds);
      ownerMap = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = { full_name: p.full_name }; return acc; }, {} as Record<string, { full_name: string | null }>);
    }

    const enrichedLeads = rawLeads.map((l) => ({ ...l, owner: l.owner_id ? ownerMap[l.owner_id] ?? null : null }));
    setLeads(enrichedLeads);

    const leadIds = enrichedLeads.map((l) => l.id);
    if (leadIds.length > 0) {
      const { data: activityRows } = await supabase
        .from('lead_activities')
        .select('lead_id, activity_type, created_at')
        .in('lead_id', leadIds)
        .order('created_at', { ascending: false });

      const actMap: Record<string, string> = {};
      (activityRows ?? []).forEach((row) => {
        if (!actMap[row.lead_id]) {
          actMap[row.lead_id] = row.activity_type;
        }
      });
      setLastActivityMap(actMap);
    } else {
      setLastActivityMap({});
    }

    setLoading(false);
  }, [filters, user, role, toast]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ------- Status view columns -------
  const statusColumns = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    const unassignedKey = '__unassigned__';
    statuses.forEach((s) => { map[s.id] = []; });
    map[unassignedKey] = [];
    leads.forEach((l) => {
      const key = l.status_id ?? unassignedKey;
      if (map[key]) map[key].push(l);
      else map[unassignedKey].push(l);
    });
    return map;
  }, [leads, statuses]);

  // ------- Activity view columns -------
  const activityColumns = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    ACTIVITY_COLUMNS.forEach((c) => { map[c.id] = []; });
    leads.forEach((l) => {
      const lastAct = lastActivityMap[l.id];
      const colId = lastAct && ACTIVITY_COLUMNS.some((c) => c.id === lastAct) ? lastAct : '__no_activity__';
      map[colId].push(l);
    });
    return map;
  }, [leads, lastActivityMap]);

  // ------- Drag handlers (only for status view) -------
  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragOver = (_e: DragOverEvent) => {};

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const leadId = String(active.id);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    let targetStatusId: string | null = null;
    const overId = String(over.id);
    const isColumn = statuses.some((s) => s.id === overId) || overId === '__unassigned__';
    if (isColumn) {
      targetStatusId = overId === '__unassigned__' ? null : overId;
    } else {
      const targetLead = leads.find((l) => l.id === overId);
      targetStatusId = targetLead?.status_id ?? null;
    }

    if (lead.status_id === targetStatusId) return;

    const targetStatus = statuses.find((s) => s.id === targetStatusId);
    const fromStatus = statuses.find((s) => s.id === lead.status_id);

    // Optimistic UI update
    setLeads((prev) => prev.map((l) =>
      l.id === leadId
        ? { ...l, status_id: targetStatusId, status: targetStatus ? { name: targetStatus.name, color: targetStatus.color } : null }
        : l
    ));

    // Open comment dialog instead of committing immediately
    setPendingMove({
      leadId,
      lead,
      targetStatusId,
      fromStatusName: fromStatus?.name ?? 'Unassigned',
      toStatusName: targetStatus?.name ?? 'Unassigned',
    });
  };

  const confirmMove = async (comment: string) => {
    if (!pendingMove || !user) return;
    setMoveSubmitting(true);

    const { leadId, lead, targetStatusId, fromStatusName, toStatusName } = pendingMove;

    const { error } = await supabase.from('leads').update({ status_id: targetStatusId }).eq('id', leadId);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to move lead', description: error.message });
      // Revert optimistic update
      setLeads((prev) => prev.map((l) =>
        l.id === leadId ? { ...l, status_id: lead.status_id, status: lead.status } : l
      ));
      setMoveSubmitting(false);
      setPendingMove(null);
      return;
    }

    const desc = `Lead moved from "${fromStatusName}" to "${toStatusName}" — ${comment}`;
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'note',
      description: desc,
    });

    toast({ title: 'Lead moved', description: `${lead.company_name} → ${toStatusName}` });
    setMoveSubmitting(false);
    setPendingMove(null);
  };

  const cancelMove = () => {
    if (pendingMove) {
      const { leadId, lead } = pendingMove;
      setLeads((prev) => prev.map((l) =>
        l.id === leadId ? { ...l, status_id: lead.status_id, status: lead.status } : l
      ));
    }
    setPendingMove(null);
  };

  // ------- Add activity from card -------
  const handleAddActivity = (lead: Lead) => {
    setActivityLead(lead);
  };

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  const update = (partial: Partial<Filters>) => setFilters((f) => ({ ...f, ...partial }));

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.owner) c++;
    if (filters.country) c++;
    if (filters.datePreset || filters.dateFrom) c++;
    if (filters.scoreMin > 0 || filters.scoreMax < 100) c++;
    return c;
  }, [filters]);

  const handleDatePreset = (preset: string) => {
    if (preset === 'custom') {
      update({ datePreset: 'custom' });
    } else {
      const range = getPresetRange(preset);
      update({ datePreset: preset, dateFrom: range?.from ?? '', dateTo: range?.to ?? '' });
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-1 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                <Kanban className="h-6 w-6 text-primary shrink-0" />
                {pageTitle}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {viewMode === 'status'
                  ? 'Drag leads between stages to update their status'
                  : 'View leads grouped by their latest activity'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* View toggle */}
              <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
                <button
                  onClick={() => setViewMode('status')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200',
                    viewMode === 'status'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Stages
                </button>
                <button
                  onClick={() => setViewMode('activity')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200',
                    viewMode === 'activity'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Activities
                </button>
              </div>

              {/* Search */}
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={filters.search}
                  onChange={(e) => update({ search: e.target.value })}
                  className="pl-9 h-9 text-sm"
                />
                {filters.search && (
                  <button onClick={() => update({ search: '' })} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Filters toggle */}
              <Button
                variant="outline"
                size="sm"
                className={cn('gap-1.5 h-9', showFilters && 'bg-accent/10 border-accent')}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge className="h-5 w-5 p-0 justify-center text-[10px] bg-accent text-white">{activeFilterCount}</Badge>
                )}
              </Button>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={() => setFilters(EMPTY_FILTERS)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Filter row */}
          {showFilters && (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5 animate-in slide-in-from-top-2 duration-200 bg-card border rounded-lg p-3">
              {role === 'admin' && (
                <Select value={filters.owner || 'all'} onValueChange={(v) => update({ owner: v === 'all' ? '' : v })}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Owners" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Owners</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name || o.id.slice(0, 8)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={filters.country || 'all'} onValueChange={(v) => update({ country: v === 'all' ? '' : v })}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Countries" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filters.datePreset || 'all'} onValueChange={(v) => v === 'all' ? update({ datePreset: '', dateFrom: '', dateTo: '' }) : handleDatePreset(v)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Date Range" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  {DATE_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {filters.datePreset === 'custom' && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 justify-start font-normal">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {filters.dateFrom ? format(new Date(filters.dateFrom), 'MMM d, yyyy') : 'From'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined} onSelect={(d) => update({ dateFrom: d ? startOfDay(d).toISOString() : '' })} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5 justify-start font-normal">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {filters.dateTo ? format(new Date(filters.dateTo), 'MMM d, yyyy') : 'To'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filters.dateTo ? new Date(filters.dateTo) : undefined} onSelect={(d) => update({ dateTo: d ? endOfDay(d).toISOString() : '' })} />
                    </PopoverContent>
                  </Popover>
                </>
              )}
              <div className="flex items-center gap-1.5">
                <Input type="number" min={0} max={100} value={filters.scoreMin} onChange={(e) => update({ scoreMin: Number(e.target.value) || 0 })} className="h-9 text-xs w-20" placeholder="Min" />
                <span className="text-xs text-muted-foreground">–</span>
                <Input type="number" min={0} max={100} value={filters.scoreMax} onChange={(e) => update({ scoreMax: Number(e.target.value) || 100 })} className="h-9 text-xs w-20" placeholder="Max" />
              </div>
            </div>
          )}
        </div>

        {/* Insight Widgets */}
        {!loading && leads.length > 0 && (
          <div className="shrink-0 px-1 pb-3">
            <PipelineWidgets
              viewMode={viewMode}
              leads={leads}
              statuses={statuses}
              lastActivityMap={lastActivityMap}
              isAdmin={role === 'admin'}
              owners={owners}
            />
          </div>
        )}

        {/* Kanban board */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          {loading ? (
            <div className="flex gap-4 px-1 h-full">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-[290px] shrink-0">
                  <Skeleton className="h-10 w-full rounded-lg mb-3" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => <Skeleton key={j} className="h-28 w-full rounded-lg" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'status' ? (
            /* ===== STATUS VIEW — drag-and-drop enabled ===== */
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-3 px-1 h-full pb-4">
                {statuses.map((status) => (
                  <KanbanColumn
                    key={status.id}
                    id={status.id}
                    title={status.name}
                    color={status.color}
                    count={statusColumns[status.id]?.length ?? 0}
                    totalScore={statusColumns[status.id]?.reduce((s, l) => s + (l.lead_score ?? 0), 0) ?? 0}
                  >
                    <SortableContext items={(statusColumns[status.id] ?? []).map((l) => l.id)} strategy={verticalListSortingStrategy}>
                      {(statusColumns[status.id] ?? []).map((lead) => (
                        <KanbanCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          onAddActivity={handleAddActivity}
                        />
                      ))}
                    </SortableContext>
                    {(statusColumns[status.id] ?? []).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                        <p className="text-xs">No leads</p>
                      </div>
                    )}
                  </KanbanColumn>
                ))}
                {(statusColumns['__unassigned__']?.length ?? 0) > 0 && (
                  <KanbanColumn
                    id="__unassigned__"
                    title="No Status"
                    color="#6b7280"
                    count={statusColumns['__unassigned__']?.length ?? 0}
                    totalScore={statusColumns['__unassigned__']?.reduce((s, l) => s + (l.lead_score ?? 0), 0) ?? 0}
                  >
                    <SortableContext items={(statusColumns['__unassigned__'] ?? []).map((l) => l.id)} strategy={verticalListSortingStrategy}>
                      {(statusColumns['__unassigned__'] ?? []).map((lead) => (
                        <KanbanCard
                          key={lead.id}
                          lead={lead}
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          onAddActivity={handleAddActivity}
                        />
                      ))}
                    </SortableContext>
                  </KanbanColumn>
                )}
              </div>

              <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
                {activeLead ? <KanbanCard lead={activeLead} isDragOverlay /> : null}
              </DragOverlay>
            </DndContext>
          ) : (
            /* ===== ACTIVITY VIEW — static, no drag-and-drop ===== */
            <div className="flex gap-3 px-1 h-full pb-4">
              {ACTIVITY_COLUMNS.map((col) => (
                <StaticKanbanColumn
                  key={col.id}
                  title={col.label}
                  color={col.color}
                  count={activityColumns[col.id]?.length ?? 0}
                  totalScore={activityColumns[col.id]?.reduce((s, l) => s + (l.lead_score ?? 0), 0) ?? 0}
                >
                  {(activityColumns[col.id] ?? []).map((lead) => (
                    <StaticKanbanCard
                      key={lead.id}
                      lead={lead}
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      onAddActivity={handleAddActivity}
                    />
                  ))}
                  {(activityColumns[col.id] ?? []).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                      <p className="text-xs">No leads</p>
                    </div>
                  )}
                </StaticKanbanColumn>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Move comment dialog */}
      <MoveCommentDialog
        open={!!pendingMove}
        leadName={pendingMove?.lead.company_name ?? ''}
        fromStatus={pendingMove?.fromStatusName ?? ''}
        toStatus={pendingMove?.toStatusName ?? ''}
        onConfirm={confirmMove}
        onCancel={cancelMove}
        submitting={moveSubmitting}
      />

      {/* Add activity dialog */}
      {activityLead && (
        <AddActivityDialog
          open={!!activityLead}
          onOpenChange={(open) => { if (!open) setActivityLead(null); }}
          leadId={activityLead.id}
          currentLeadScore={activityLead.lead_score ?? 0}
          onSuccess={() => {
            setActivityLead(null);
            fetchLeads();
          }}
          leadEmail={activityLead.email}
          leadContactName={activityLead.contact_name}
          leadCompanyName={activityLead.company_name}
          leadPhone={activityLead.phone}
          leadStatusName={activityLead.status?.name ?? null}
        />
      )}
    </AppLayout>
  );
}
