import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LeadsTable, type SortField } from '@/components/leads/LeadsTable';
import { LeadsFilters, type LeadsFiltersState } from '@/components/leads/LeadsFilters';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { LeadImportDialog } from '@/components/leads/LeadImportDialog';
import { BulkActionsDialog } from '@/components/leads/BulkActionsDialog';
import { LeadSidePanel } from '@/components/leads/LeadSidePanel';
import { Button } from '@/components/ui/button';
import { Plus, Download, Upload, UserPlus, Tag, Trash2, List, Loader2, ChevronDown, FileText, Filter, Database, Calendar, Copy } from 'lucide-react';
import type { Lead } from '@/types/lead';
import { applyStatusIdFilter, leadIdsWithNoNextStep } from '@/lib/leadWorkQueue';
import { findDuplicatePairs, type DuplicatePair } from '@/lib/leadDuplicates';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeFormat } from '@/lib/date';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type SortOrder = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function Leads() {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'status' | 'owner' | 'followup' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ownerOptions, setOwnerOptions] = useState<{ id: string; full_name: string | null }[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);
  const [sidePanelLead, setSidePanelLead] = useState<Lead | null>(null);
  const defaultOwner = searchParams.get('owner') ?? (!isAdmin && user ? user.id : '');
  const viewParam = searchParams.get('view') ?? '';
  const [queueView, setQueueView] = useState(viewParam);
  const [queueCounts, setQueueCounts] = useState({
    breach: 0,
    warning: 0,
    unassigned: 0,
    overdueFu: 0,
    overdueTask: 0,
    noNext: 0,
  });
  const [dupOpen, setDupOpen] = useState(false);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupPairs, setDupPairs] = useState<DuplicatePair[]>([]);
  const [filters, setFilters] = useState<LeadsFiltersState>({
    search: searchParams.get('search') ?? '',
    status: '',
    region: '',
    country: '',
    owner: defaultOwner,
    scoreMin: 0,
    scoreMax: 100,
    vendorType: '',
    warehouseAvailable: '',
    createdPreset: '',
    createdFrom: '',
    createdTo: '',
    lastActivityPreset: '',
    lastActivityFrom: '',
    lastActivityTo: '',
    ndaStatus: '',
    linkedinOutreach: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    const search = searchParams.get('search');
    const owner = searchParams.get('owner');
    const view = searchParams.get('view') ?? '';
    setQueueView(view);
    setFilters((f) => ({
      ...f,
      ...(search != null ? { search: search ?? '' } : {}),
      ...(owner != null ? { owner: owner ?? '' } : {}),
    }));
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name');
      setOwnerOptions((profiles ?? []).map((p) => ({ id: p.user_id, full_name: p.full_name })));
    })();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [filters, page, pageSize, sortBy, sortOrder, queueView]);

  useEffect(() => {
    (async () => {
      const nowIso = new Date().toISOString();
      const [breach, warn, unassigned, fu, tasks, noNext] = await Promise.all([
        supabase.rpc('leads_matching_sla', { p_mode: 'breach' }),
        supabase.rpc('leads_matching_sla', { p_mode: 'warning' }),
        supabase.from('leads').select('id', { count: 'exact', head: true }).is('owner_id', null),
        supabase.from('follow_ups').select('lead_id').eq('is_completed', false).lt('scheduled_at', nowIso),
        supabase.from('tasks').select('lead_id').eq('is_completed', false).lt('due_date', nowIso).not('lead_id', 'is', null),
        leadIdsWithNoNextStep(),
      ]);
      setQueueCounts({
        breach: (breach.data ?? []).length,
        warning: (warn.data ?? []).length,
        unassigned: unassigned.count ?? 0,
        overdueFu: [...new Set((fu.data ?? []).map((r) => r.lead_id))].length,
        overdueTask: [...new Set((tasks.data ?? []).map((r) => r.lead_id))].length,
        noNext: noNext.length,
      });
    })();
  }, []);

  const handleFiltersChange = (newFilters: LeadsFiltersState) => {
    setFilters(newFilters);
    setPage(1);
  };

  const fetchLeads = async () => {
    setLoading(true);

    // Pre-fetch lead IDs that match the NDA filter (if active)
    let ndaLeadIds: string[] | null = null;
    if (filters.ndaStatus) {
      if (filters.ndaStatus === 'no_nda') {
        const { data: ndaRows } = await supabase
          .from('lead_activities')
          .select('lead_id')
          .eq('activity_type', 'nda');
        const idsWithNda = [...new Set((ndaRows ?? []).map((r) => r.lead_id))];
        ndaLeadIds = idsWithNda;
      } else {
        let ndaQuery = supabase
          .from('lead_activities')
          .select('lead_id, description')
          .eq('activity_type', 'nda');
        if (filters.ndaStatus === 'nda_sent') {
          ndaQuery = ndaQuery.ilike('description', 'NDA Sent%');
        } else if (filters.ndaStatus === 'nda_received') {
          ndaQuery = ndaQuery.ilike('description', 'NDA Received%');
        }
        const { data: ndaRows } = await ndaQuery;
        ndaLeadIds = [...new Set((ndaRows ?? []).map((r) => r.lead_id))];
      }
    }

    // Pre-fetch lead IDs that match the LinkedIn filter (if active)
    let linkedinLeadIds: string[] | null = null;
    if (filters.linkedinOutreach) {
      const { data: liRows } = await supabase
        .from('lead_activities')
        .select('lead_id')
        .eq('activity_type', 'linkedin');
      const idsWithLinkedin = [...new Set((liRows ?? []).map((r) => r.lead_id))];
      if (filters.linkedinOutreach === 'no_linkedin') {
        linkedinLeadIds = idsWithLinkedin;
      } else {
        linkedinLeadIds = idsWithLinkedin;
      }
    }

    let query = supabase
      .from('leads')
      .select(
        `
        id,
        company_name,
        website,
        contact_name,
        contact_designation,
        email,
        phone,
        additional_contacts,
        lead_score,
        vendor_types,
        warehouse_available,
        warehouse_location,
        warehouse_notes,
        warehouse_price,
        warehouse_currency,
        notes,
        hq_country_id,
        country_ids,
        created_at,
        updated_at,
        last_activity_at,
        status_changed_at,
        owner_id,
        status:lead_statuses(name, color, sla_idle_days, sla_stage_days, sla_followup_intent)
      `,
        { count: 'exact' }
      )
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (filters.search) {
      query = query.or(`company_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,website.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
    }
    query = applyStatusIdFilter(query, filters.status);
    if (filters.region) {
      const { data: regionCountries } = await supabase.from('countries').select('id').eq('region', filters.region);
      const regionCountryIds = (regionCountries ?? []).map((r) => r.id);
      if (regionCountryIds.length > 0) {
        query = (query as any).overlaps('country_ids', regionCountryIds);
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
    if (filters.country) query = (query as any).contains('country_ids', [filters.country]);
    if (filters.owner === 'unassigned') query = query.is('owner_id', null);
    else if (filters.owner) query = query.eq('owner_id', filters.owner);
    if (filters.vendorType) query = query.contains('vendor_types', [filters.vendorType]);
    if (filters.warehouseAvailable === 'true') query = query.eq('warehouse_available', true);
    else if (filters.warehouseAvailable === 'false') query = query.eq('warehouse_available', false);
    query = query.gte('lead_score', filters.scoreMin).lte('lead_score', filters.scoreMax);

    if (filters.createdFrom) query = query.gte('created_at', filters.createdFrom);
    if (filters.createdTo) query = query.lte('created_at', filters.createdTo);
    if (filters.lastActivityFrom) query = query.gte('last_activity_at', filters.lastActivityFrom);
    if (filters.lastActivityTo) query = query.lte('last_activity_at', filters.lastActivityTo);

    if (queueView === 'sla_breach' || queueView === 'sla_warning') {
      const { data: slaRows } = await supabase.rpc('leads_matching_sla', {
        p_mode: queueView === 'sla_warning' ? 'warning' : 'breach',
      });
      const ids = (slaRows ?? []).map((r) => r.lead_id);
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (queueView === 'unassigned') {
      query = query.is('owner_id', null);
    } else if (queueView === 'overdue_followup') {
      const { data: fuRows } = await supabase
        .from('follow_ups')
        .select('lead_id')
        .eq('is_completed', false)
        .lt('scheduled_at', new Date().toISOString());
      const ids = [...new Set((fuRows ?? []).map((r) => r.lead_id))];
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (queueView === 'overdue_task') {
      const { data: taskRows } = await supabase
        .from('tasks')
        .select('lead_id')
        .eq('is_completed', false)
        .lt('due_date', new Date().toISOString())
        .not('lead_id', 'is', null);
      const ids = [...new Set((taskRows ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    } else if (queueView === 'no_next_step') {
      const ids = await leadIdsWithNoNextStep();
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    }

    // Apply NDA filter: include/exclude by lead IDs
    if (ndaLeadIds !== null && filters.ndaStatus !== 'no_nda') {
      if (ndaLeadIds.length > 0) {
        query = query.in('id', ndaLeadIds);
      } else {
        query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
      }
    }

    // Apply LinkedIn filter: include by lead IDs
    if (linkedinLeadIds !== null && filters.linkedinOutreach === 'has_linkedin') {
      if (linkedinLeadIds.length > 0) {
        query = query.in('id', linkedinLeadIds);
      } else {
        query = query.in('id', ['00000000-0000-0000-0000-000000000000']);
      }
    }

    const { data: rawData, error, count } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch leads' });
      setLoading(false);
      return;
    }

    let data = (rawData ?? []) as (Lead & { owner_id?: string | null })[];

    // Client-side exclusion for "no_nda" filter
    if (filters.ndaStatus === 'no_nda' && ndaLeadIds !== null) {
      const excludeSet = new Set(ndaLeadIds);
      data = data.filter((l) => !excludeSet.has(l.id));
    }

    // Client-side exclusion for "no_linkedin" filter
    if (filters.linkedinOutreach === 'no_linkedin' && linkedinLeadIds !== null) {
      const excludeSet = new Set(linkedinLeadIds);
      data = data.filter((l) => !excludeSet.has(l.id));
    }

    const ownerIds = [...new Set(data.map((l) => l.owner_id).filter(Boolean))] as string[];
    let ownerMap: Record<string, { full_name: string | null }> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', ownerIds);
      ownerMap = (profiles ?? []).reduce(
        (acc, p) => {
          acc[p.user_id] = { full_name: p.full_name };
          return acc;
        },
        {} as Record<string, { full_name: string | null }>
      );
    }

    // Resolve countries from hq_country_id and country_ids arrays
    const hqIds = data.map((l) => (l as any).hq_country_id).filter(Boolean) as string[];
    const allCountryIds = [...new Set([...hqIds, ...data.flatMap((l) => (l as any).country_ids ?? [])])] as string[];
    let countryMap: Record<string, { name: string; code: string }> = {};
    if (allCountryIds.length > 0) {
      const { data: countryRows } = await supabase.from('countries').select('id, name, code').in('id', allCountryIds);
      countryMap = (countryRows ?? []).reduce((acc, c) => { acc[c.id] = { name: c.name, code: c.code }; return acc; }, {} as Record<string, { name: string; code: string }>);
    }

    const leadsWithOwner = data.map((l) => ({
      ...l,
      owner: l.owner_id ? ownerMap[l.owner_id] ?? null : null,
      hq_country: (l as any).hq_country_id ? countryMap[(l as any).hq_country_id] ?? null : null,
      countries: ((l as any).country_ids ?? []).map((id: string) => countryMap[id]).filter(Boolean),
    }));

    const pageIds = leadsWithOwner.map((l) => l.id);
    if (pageIds.length > 0) {
      const nowIso = new Date().toISOString();
      const [fuRes, taskRes] = await Promise.all([
        supabase.from('follow_ups').select('lead_id, scheduled_at').in('lead_id', pageIds).eq('is_completed', false).gte('scheduled_at', nowIso).order('scheduled_at', { ascending: true }),
        supabase.from('tasks').select('lead_id, due_date').in('lead_id', pageIds).eq('is_completed', false).not('due_date', 'is', null).order('due_date', { ascending: true }),
      ]);
      const nextFu: Record<string, string> = {};
      for (const row of fuRes.data ?? []) {
        if (row.lead_id && !nextFu[row.lead_id]) nextFu[row.lead_id] = row.scheduled_at;
      }
      const nextTask: Record<string, string> = {};
      for (const row of taskRes.data ?? []) {
        if (row.lead_id && row.due_date && !nextTask[row.lead_id]) nextTask[row.lead_id] = row.due_date;
      }
      for (const l of leadsWithOwner) {
        l.next_follow_up_at = nextFu[l.id] ?? null;
        l.next_task_due = nextTask[l.id] ?? null;
      }
    }

    setLeads(leadsWithOwner);
    const usesClientSideExclusion = filters.ndaStatus === 'no_nda' || filters.linkedinOutreach === 'no_linkedin';
    setTotalCount(usesClientSideExclusion ? leadsWithOwner.length : (count ?? 0));
    setLoading(false);
  };

  const handleSort = (field: SortField) => {
    setSortBy(field);
    setSortOrder((o) => (sortBy === field ? (o === 'asc' ? 'desc' : 'asc') : 'desc'));
    setPage(1);
  };

  const bulkUpdateSuccess = () => {
    setSelectedIds(new Set());
    fetchLeads();
  };

  const formatAdditionalContacts = (contacts: unknown): string => {
    if (!Array.isArray(contacts) || contacts.length === 0) return '';
    return contacts
      .map((c: any) => {
        const parts: string[] = [];
        if (c?.name) parts.push(c.name);
        if (c?.designation) parts.push(`(${c.designation})`);
        if (c?.email) parts.push(`<${c.email}>`);
        if (c?.phone) parts.push(`tel:${c.phone}`);
        return parts.join(' ');
      })
      .filter(Boolean)
      .join(' | ');
  };

  const buildCsvRows = (leadsData: Lead[]) => {
    const headers = [
      'Lead ID', 'Company', 'Website', 'Status',
      'Contact Name', 'Contact Designation', 'Email', 'Phone',
      'Additional Contacts',
      'Score', 'HQ Country', 'Served Countries',
      'Vendor Types',
      'Warehouse Available', 'Warehouse Location', 'Warehouse Notes', 'Warehouse Price', 'Warehouse Currency',
      'Owner', 'Notes', 'Created', 'Last Updated',
    ];
    const rows = leadsData.map((l) => {
      const a = l as any;
      const warehousePrice =
        a.warehouse_price != null && a.warehouse_price !== ''
          ? Number(a.warehouse_price).toFixed(2)
          : '';
      return [
        l.id,
        l.company_name,
        l.website ?? '',
        l.status?.name ?? '',
        l.contact_name ?? '',
        l.contact_designation ?? '',
        l.email ?? '',
        l.phone ?? '',
        formatAdditionalContacts(a.additional_contacts),
        l.lead_score ?? '',
        l.hq_country?.name ?? '',
        (l.countries ?? []).map((c) => c.name).join('; ') || '',
        (l.vendor_types ?? []).join('; ') || '',
        l.warehouse_available != null ? (l.warehouse_available ? 'Yes' : 'No') : '',
        a.warehouse_location ?? '',
        a.warehouse_notes ?? '',
        warehousePrice,
        warehousePrice ? (a.warehouse_currency ?? 'USD') : '',
        l.owner?.full_name ?? '',
        l.notes ?? '',
        safeFormat(l.created_at, 'PPp', '-'),
        safeFormat(l.updated_at, 'PPp', '-'),
      ];
    });
    return { headers, rows };
  };

  const downloadCsv = (leadsData: Lead[], filename: string) => {
    const { headers, rows } = buildCsvRows(leadsData);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = (selectedOnly?: boolean) => {
    const toExport = selectedOnly && selectedIds.size > 0
      ? leads.filter((l) => selectedIds.has(l.id))
      : leads;
    downloadCsv(toExport, `leads-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: 'Exported', description: `${toExport.length} lead(s) exported.` });
  };

  const exportAllLeads = async (withFilters = true) => {
    setExportingAll(true);
    try {
      // Pre-fetch NDA lead IDs
      let ndaLeadIds: string[] | null = null;
      if (withFilters && filters.ndaStatus) {
        if (filters.ndaStatus === 'no_nda') {
          const { data: ndaRows } = await supabase.from('lead_activities').select('lead_id').eq('activity_type', 'nda');
          ndaLeadIds = [...new Set((ndaRows ?? []).map((r) => r.lead_id))];
        } else {
          let ndaQuery = supabase.from('lead_activities').select('lead_id, description').eq('activity_type', 'nda');
          if (filters.ndaStatus === 'nda_sent') ndaQuery = ndaQuery.ilike('description', 'NDA Sent%');
          else if (filters.ndaStatus === 'nda_received') ndaQuery = ndaQuery.ilike('description', 'NDA Received%');
          const { data: ndaRows } = await ndaQuery;
          ndaLeadIds = [...new Set((ndaRows ?? []).map((r) => r.lead_id))];
        }
      }

      // Pre-fetch LinkedIn lead IDs
      let linkedinLeadIds: string[] | null = null;
      if (withFilters && filters.linkedinOutreach) {
        const { data: liRows } = await supabase.from('lead_activities').select('lead_id').eq('activity_type', 'linkedin');
        linkedinLeadIds = [...new Set((liRows ?? []).map((r) => r.lead_id))];
      }

      let query = supabase
        .from('leads')
        .select(
          `id, company_name, website, contact_name, contact_designation,
          email, phone, additional_contacts, lead_score, vendor_types,
          warehouse_available, warehouse_location, warehouse_notes,
          warehouse_price, warehouse_currency,
          notes, hq_country_id, country_ids, created_at, updated_at, owner_id,
          status:lead_statuses(name, color)`
        )
        .order(sortBy, { ascending: sortOrder === 'asc' });

      if (withFilters) {
        if (filters.search) {
          query = query.or(`company_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,website.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
        }
        query = applyStatusIdFilter(query, filters.status);
        if (filters.region) {
          const { data: regionCountries } = await supabase.from('countries').select('id').eq('region', filters.region);
          const regionCountryIds = (regionCountries ?? []).map((r) => r.id);
          if (regionCountryIds.length > 0) {
            query = (query as any).overlaps('country_ids', regionCountryIds);
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
        if (filters.country) query = (query as any).contains('country_ids', [filters.country]);
        if (filters.owner === 'unassigned') query = query.is('owner_id', null);
        else if (filters.owner) query = query.eq('owner_id', filters.owner);
        if (filters.vendorType) query = query.contains('vendor_types', [filters.vendorType]);
        if (filters.warehouseAvailable === 'true') query = query.eq('warehouse_available', true);
        else if (filters.warehouseAvailable === 'false') query = query.eq('warehouse_available', false);
        query = query.gte('lead_score', filters.scoreMin).lte('lead_score', filters.scoreMax);
        if (filters.createdFrom) query = query.gte('created_at', filters.createdFrom);
        if (filters.createdTo) query = query.lte('created_at', filters.createdTo);
        if (filters.lastActivityFrom) query = query.gte('last_activity_at', filters.lastActivityFrom);
        if (filters.lastActivityTo) query = query.lte('last_activity_at', filters.lastActivityTo);

        if (ndaLeadIds !== null && filters.ndaStatus !== 'no_nda') {
          query = ndaLeadIds.length > 0
            ? query.in('id', ndaLeadIds)
            : query.in('id', ['00000000-0000-0000-0000-000000000000']);
        }
        if (linkedinLeadIds !== null && filters.linkedinOutreach === 'has_linkedin') {
          query = linkedinLeadIds.length > 0
            ? query.in('id', linkedinLeadIds)
            : query.in('id', ['00000000-0000-0000-0000-000000000000']);
        }
      }

      let data: any[];
      try {
        data = await fetchAllPaginated((from, to) => query.range(from, to));
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to export leads' });
        return;
      }
      if (withFilters && filters.ndaStatus === 'no_nda' && ndaLeadIds !== null) {
        const excludeSet = new Set(ndaLeadIds);
        data = data.filter((l) => !excludeSet.has(l.id));
      }
      if (withFilters && filters.linkedinOutreach === 'no_linkedin' && linkedinLeadIds !== null) {
        const excludeSet = new Set(linkedinLeadIds);
        data = data.filter((l) => !excludeSet.has(l.id));
      }

      const ownerIds = [...new Set(data.map((l) => l.owner_id).filter(Boolean))] as string[];
      let ownerMap: Record<string, { full_name: string | null }> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ownerIds);
        ownerMap = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = { full_name: p.full_name }; return acc; }, {} as Record<string, { full_name: string | null }>);
      }

      const hqIds = data.map((l) => l.hq_country_id).filter(Boolean) as string[];
      const allCountryIds = [...new Set([...hqIds, ...data.flatMap((l) => l.country_ids ?? [])])] as string[];
      let countryMap: Record<string, { name: string; code: string }> = {};
      if (allCountryIds.length > 0) {
        const { data: countryRows } = await supabase.from('countries').select('id, name, code').in('id', allCountryIds);
        countryMap = (countryRows ?? []).reduce((acc, c) => { acc[c.id] = { name: c.name, code: c.code }; return acc; }, {} as Record<string, { name: string; code: string }>);
      }

      const enriched = data.map((l) => ({
        ...l,
        owner: l.owner_id ? ownerMap[l.owner_id] ?? null : null,
        hq_country: l.hq_country_id ? countryMap[l.hq_country_id] ?? null : null,
        countries: (l.country_ids ?? []).map((id: string) => countryMap[id]).filter(Boolean),
      })) as Lead[];

      downloadCsv(enriched, `leads-${withFilters ? 'filtered-' : ''}export-${new Date().toISOString().slice(0, 10)}.csv`);
      toast({ title: 'Exported', description: `${enriched.length} lead(s) exported.` });
    } finally {
      setExportingAll(false);
    }
  };

  // Comprehensive "export all" — every lead with every field PLUS related activities,
  // follow-ups, tasks, and documents flattened into the same CSV row per lead.
  const exportCompleteData = async (withFilters = false) => {
    setExportingAll(true);
    try {
      let ndaLeadIds: string[] | null = null;
      if (withFilters && filters.ndaStatus) {
        if (filters.ndaStatus === 'no_nda') {
          const { data: ndaRows } = await supabase.from('lead_activities').select('lead_id').eq('activity_type', 'nda');
          ndaLeadIds = [...new Set((ndaRows ?? []).map((r) => r.lead_id))];
        } else {
          let ndaQuery = supabase.from('lead_activities').select('lead_id, description').eq('activity_type', 'nda');
          if (filters.ndaStatus === 'nda_sent') ndaQuery = ndaQuery.ilike('description', 'NDA Sent%');
          else if (filters.ndaStatus === 'nda_received') ndaQuery = ndaQuery.ilike('description', 'NDA Received%');
          const { data: ndaRows } = await ndaQuery;
          ndaLeadIds = [...new Set((ndaRows ?? []).map((r) => r.lead_id))];
        }
      }

      let linkedinLeadIds: string[] | null = null;
      if (withFilters && filters.linkedinOutreach) {
        const { data: liRows } = await supabase.from('lead_activities').select('lead_id').eq('activity_type', 'linkedin');
        linkedinLeadIds = [...new Set((liRows ?? []).map((r) => r.lead_id))];
      }

      let query = supabase
        .from('leads')
        .select(
          `id, company_name, website, contact_name, contact_designation,
          email, phone, additional_contacts, lead_score, vendor_types,
          warehouse_available, warehouse_location, warehouse_notes,
          warehouse_price, warehouse_currency,
          notes, hq_country_id, country_ids, created_at, updated_at, owner_id,
          status:lead_statuses(name, color)`
        )
        .order(sortBy, { ascending: sortOrder === 'asc' });

      if (withFilters) {
        if (filters.search) {
          query = query.or(`company_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,website.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
        }
        query = applyStatusIdFilter(query, filters.status);
        if (filters.region) {
          const { data: regionCountries } = await supabase.from('countries').select('id').eq('region', filters.region);
          const regionCountryIds = (regionCountries ?? []).map((r) => r.id);
          if (regionCountryIds.length > 0) {
            query = (query as any).overlaps('country_ids', regionCountryIds);
          } else {
            query = query.eq('id', '00000000-0000-0000-0000-000000000000');
          }
        }
        if (filters.country) query = (query as any).contains('country_ids', [filters.country]);
        if (filters.owner === 'unassigned') query = query.is('owner_id', null);
        else if (filters.owner) query = query.eq('owner_id', filters.owner);
        if (filters.vendorType) query = query.contains('vendor_types', [filters.vendorType]);
        if (filters.warehouseAvailable === 'true') query = query.eq('warehouse_available', true);
        else if (filters.warehouseAvailable === 'false') query = query.eq('warehouse_available', false);
        query = query.gte('lead_score', filters.scoreMin).lte('lead_score', filters.scoreMax);
        if (filters.createdFrom) query = query.gte('created_at', filters.createdFrom);
        if (filters.createdTo) query = query.lte('created_at', filters.createdTo);
        if (filters.lastActivityFrom) query = query.gte('last_activity_at', filters.lastActivityFrom);
        if (filters.lastActivityTo) query = query.lte('last_activity_at', filters.lastActivityTo);
        if (ndaLeadIds !== null && filters.ndaStatus !== 'no_nda') {
          query = ndaLeadIds.length > 0
            ? query.in('id', ndaLeadIds)
            : query.in('id', ['00000000-0000-0000-0000-000000000000']);
        }
        if (linkedinLeadIds !== null && filters.linkedinOutreach === 'has_linkedin') {
          query = linkedinLeadIds.length > 0
            ? query.in('id', linkedinLeadIds)
            : query.in('id', ['00000000-0000-0000-0000-000000000000']);
        }
      }

      let leadRows: any[];
      try {
        leadRows = await fetchAllPaginated((from, to) => query.range(from, to));
      } catch {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to export leads' });
        return;
      }
      if (withFilters && filters.ndaStatus === 'no_nda' && ndaLeadIds !== null) {
        const excludeSet = new Set(ndaLeadIds);
        leadRows = leadRows.filter((l) => !excludeSet.has(l.id));
      }
      if (withFilters && filters.linkedinOutreach === 'no_linkedin' && linkedinLeadIds !== null) {
        const excludeSet = new Set(linkedinLeadIds);
        leadRows = leadRows.filter((l) => !excludeSet.has(l.id));
      }

      if (leadRows.length === 0) {
        toast({ title: 'Nothing to export', description: 'No leads matched.' });
        return;
      }

      const leadIds = leadRows.map((l) => l.id);

      // Resolve owners and countries (for the base columns)
      const ownerIds = [...new Set(leadRows.map((l) => l.owner_id).filter(Boolean))] as string[];
      let ownerMap: Record<string, { full_name: string | null }> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ownerIds);
        ownerMap = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = { full_name: p.full_name }; return acc; }, {} as Record<string, { full_name: string | null }>);
      }
      const hqIds = leadRows.map((l) => l.hq_country_id).filter(Boolean) as string[];
      const allCountryIds = [...new Set([...hqIds, ...leadRows.flatMap((l) => l.country_ids ?? [])])] as string[];
      let countryMap: Record<string, { name: string; code: string }> = {};
      if (allCountryIds.length > 0) {
        const { data: countryRows } = await supabase.from('countries').select('id, name, code').in('id', allCountryIds);
        countryMap = (countryRows ?? []).reduce((acc, c) => { acc[c.id] = { name: c.name, code: c.code }; return acc; }, {} as Record<string, { name: string; code: string }>);
      }

      // Pull all related data for the matching lead set in parallel
      const [activitiesRes, followUpsRes, tasksRes, documentsRes] = await Promise.all([
        supabase
          .from('lead_activities')
          .select('id, lead_id, activity_type, description, created_at, user_id')
          .in('lead_id', leadIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('follow_ups')
          .select('id, lead_id, reminder_type, scheduled_at, is_completed, notes, user_id')
          .in('lead_id', leadIds)
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('tasks')
          .select('id, lead_id, title, description, priority, due_date, is_completed, assignee_id')
          .in('lead_id', leadIds)
          .order('due_date', { ascending: true }),
        supabase
          .from('lead_documents' as any)
          .select('id, lead_id, document_type, custom_name, file_name, uploaded_at')
          .in('lead_id', leadIds)
          .order('uploaded_at', { ascending: false }),
      ]);

      const activitiesByLead: Record<string, any[]> = {};
      for (const row of (activitiesRes.data ?? [])) {
        (activitiesByLead[row.lead_id] ||= []).push(row);
      }
      const followUpsByLead: Record<string, any[]> = {};
      for (const row of (followUpsRes.data ?? [])) {
        (followUpsByLead[row.lead_id] ||= []).push(row);
      }
      const tasksByLead: Record<string, any[]> = {};
      for (const row of (tasksRes.data ?? [])) {
        (tasksByLead[row.lead_id] ||= []).push(row);
      }
      const documentsByLead: Record<string, any[]> = {};
      // documentsRes.data may be null if the query failed silently (e.g. RLS) — guard it
      for (const row of (((documentsRes as any).data ?? []) as any[])) {
        (documentsByLead[row.lead_id] ||= []).push(row);
      }

      const formatActivity = (a: any) =>
        `[${safeFormat(a.created_at, 'yyyy-MM-dd HH:mm', '?')} ${String(a.activity_type ?? '').toUpperCase()}] ${(a.description ?? '').replace(/\s+/g, ' ').trim()}`;
      const formatFollowUp = (f: any) =>
        `[${f.is_completed ? 'Done' : 'Pending'} ${safeFormat(f.scheduled_at, 'yyyy-MM-dd HH:mm', '?')}] ${f.reminder_type ?? ''}${f.notes ? ` — ${String(f.notes).replace(/\s+/g, ' ').trim()}` : ''}`;
      const formatTask = (t: any) =>
        `[${t.is_completed ? 'Done' : 'Open'}${t.priority ? ` · ${t.priority}` : ''}${t.due_date ? ` · due ${safeFormat(t.due_date, 'yyyy-MM-dd', '?')}` : ''}] ${t.title ?? ''}${t.description ? ` — ${String(t.description).replace(/\s+/g, ' ').trim()}` : ''}`;
      const formatDoc = (d: any) =>
        `${d.file_name ?? d.custom_name ?? 'document'} (${d.document_type ?? 'file'}${d.uploaded_at ? `, ${safeFormat(d.uploaded_at, 'yyyy-MM-dd', '?')}` : ''})`;

      const headers = [
        'Lead ID', 'Company', 'Website', 'Status',
        'Contact Name', 'Contact Designation', 'Email', 'Phone',
        'Additional Contacts',
        'Score', 'HQ Country', 'Served Countries',
        'Vendor Types',
        'Warehouse Available', 'Warehouse Location', 'Warehouse Notes', 'Warehouse Price', 'Warehouse Currency',
        'Owner', 'Notes', 'Created', 'Last Updated',
        'Activities Count', 'Last Activity At', 'Last Activity Type', 'Last Activity Description', 'All Activities',
        'Follow-ups Count', 'Open Follow-ups', 'Next Follow-up At', 'All Follow-ups',
        'Tasks Count', 'Open Tasks Count', 'Next Task Due', 'All Tasks',
        'Documents Count', 'All Documents',
      ];

      const rows = leadRows.map((l) => {
        const owner = l.owner_id ? ownerMap[l.owner_id] ?? null : null;
        const hq = l.hq_country_id ? countryMap[l.hq_country_id] ?? null : null;
        const countries = (l.country_ids ?? []).map((id: string) => countryMap[id]).filter(Boolean) as { name: string; code: string }[];
        const acts = activitiesByLead[l.id] ?? [];
        const fus = followUpsByLead[l.id] ?? [];
        const tks = tasksByLead[l.id] ?? [];
        const docs = documentsByLead[l.id] ?? [];

        const lastActivity = acts[0];
        const openFollowUps = fus.filter((f) => !f.is_completed);
        const openTasks = tks.filter((t) => !t.is_completed);
        const nextFollowUp = openFollowUps[0];
        const nextTask = openTasks.find((t) => t.due_date) ?? openTasks[0];

        const warehousePrice =
          l.warehouse_price != null && l.warehouse_price !== ''
            ? Number(l.warehouse_price).toFixed(2)
            : '';

        return [
          l.id,
          l.company_name,
          l.website ?? '',
          l.status?.name ?? '',
          l.contact_name ?? '',
          l.contact_designation ?? '',
          l.email ?? '',
          l.phone ?? '',
          formatAdditionalContacts(l.additional_contacts),
          l.lead_score ?? '',
          hq?.name ?? '',
          countries.map((c) => c.name).join('; ') || '',
          (l.vendor_types ?? []).join('; ') || '',
          l.warehouse_available != null ? (l.warehouse_available ? 'Yes' : 'No') : '',
          l.warehouse_location ?? '',
          l.warehouse_notes ?? '',
          warehousePrice,
          warehousePrice ? (l.warehouse_currency ?? 'USD') : '',
          owner?.full_name ?? '',
          l.notes ?? '',
          safeFormat(l.created_at, 'PPp', '-'),
          safeFormat(l.updated_at, 'PPp', '-'),
          acts.length,
          lastActivity ? safeFormat(lastActivity.created_at, 'PPp', '-') : '',
          lastActivity?.activity_type ?? '',
          lastActivity ? String(lastActivity.description ?? '').replace(/\s+/g, ' ').trim() : '',
          acts.map(formatActivity).join(' | '),
          fus.length,
          openFollowUps.length,
          nextFollowUp ? safeFormat(nextFollowUp.scheduled_at, 'PPp', '-') : '',
          fus.map(formatFollowUp).join(' | '),
          tks.length,
          openTasks.length,
          nextTask?.due_date ? safeFormat(nextTask.due_date, 'PP', '-') : '',
          tks.map(formatTask).join(' | '),
          docs.length,
          docs.map(formatDoc).join(' | '),
        ];
      });

      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-complete-${withFilters ? 'filtered-' : ''}export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Complete export ready',
        description: `${leadRows.length} lead(s) exported with full history.`,
      });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Export failed', description: err?.message ?? 'Unknown error' });
    } finally {
      setExportingAll(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !isAdmin) return;
    setDeleting(true);
    const { error } = await supabase.from('leads').delete().in('id', [...selectedIds]);
    setDeleting(false);
    setDeleteDialogOpen(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Leads deleted', description: `${selectedIds.size} lead(s) have been removed.` });
    setSelectedIds(new Set());
    fetchLeads();
  };

  const scanDuplicates = async () => {
    setDupOpen(true);
    setDupLoading(true);
    try {
      const rows = await fetchAllPaginated<{ id: string; company_name: string; website: string | null }>((from, to) =>
        supabase.from('leads').select('id, company_name, website').range(from, to)
      );
      setDupPairs(findDuplicatePairs(rows));
    } finally {
      setDupLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className={`flex gap-0 min-h-0 ${sidePanelLead ? 'h-[calc(100vh-4rem)]' : ''}`}>
        {/* Main content */}
        <div className={`flex flex-col space-y-8 min-w-0 transition-all duration-300 ${sidePanelLead ? 'flex-1 overflow-y-auto pr-2' : 'flex-1'}`}>
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="animate-fade-in-up">
              <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Leads</h1>
              <p className="text-muted-foreground mt-1.5">Manage and track your sales leads</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => void scanDuplicates()}>
                <Copy className="h-4 w-4" />
                Find duplicates
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2" disabled={exportingAll}>
                    {exportingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {exportingAll ? 'Exporting...' : 'Export'}
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Export Options</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => exportCsv(false)} disabled={leads.length === 0}>
                    <FileText className="h-4 w-4 mr-2 shrink-0" />
                    <div>
                      <div className="font-medium">Current page</div>
                      <div className="text-xs text-muted-foreground">{leads.length} lead(s) visible</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAllLeads(true)} disabled={totalCount === 0 || exportingAll}>
                    <Filter className="h-4 w-4 mr-2 shrink-0" />
                    <div>
                      <div className="font-medium">All filtered results</div>
                      <div className="text-xs text-muted-foreground">{totalCount} lead(s) matching filters</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportAllLeads(false)} disabled={exportingAll}>
                    <Download className="h-4 w-4 mr-2 shrink-0" />
                    <div>
                      <div className="font-medium">All leads</div>
                      <div className="text-xs text-muted-foreground">Ignore active filters</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Complete Export</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => exportCompleteData(true)} disabled={totalCount === 0 || exportingAll}>
                    <Database className="h-4 w-4 mr-2 shrink-0" />
                    <div>
                      <div className="font-medium">Filtered + history</div>
                      <div className="text-xs text-muted-foreground">Every field, activities, tasks, follow-ups, documents</div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportCompleteData(false)} disabled={exportingAll}>
                    <Database className="h-4 w-4 mr-2 shrink-0" />
                    <div>
                      <div className="font-medium">All leads + history</div>
                      <div className="text-xs text-muted-foreground">Full export of every lead and related data</div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button className="gap-2 gradient-primary" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Lead
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { id: '', label: 'All' },
              { id: 'sla_breach', label: `SLA breached`, count: queueCounts.breach },
              { id: 'sla_warning', label: `SLA due soon`, count: queueCounts.warning },
              { id: 'unassigned', label: 'Unassigned', count: queueCounts.unassigned },
              { id: 'overdue_followup', label: 'Overdue follow-up', count: queueCounts.overdueFu },
              { id: 'overdue_task', label: 'Overdue task', count: queueCounts.overdueTask },
              { id: 'no_next_step', label: 'No next step', count: queueCounts.noNext },
            ].map((chip) => (
              <Button
                key={chip.id || 'all'}
                size="sm"
                variant={queueView === chip.id ? 'default' : 'outline'}
                className={cn('h-8 rounded-full', queueView === chip.id && 'gradient-primary')}
                onClick={() => {
                  setQueueView(chip.id);
                  setPage(1);
                  const next = new URLSearchParams(searchParams);
                  if (chip.id) next.set('view', chip.id);
                  else next.delete('view');
                  setSearchParams(next, { replace: true });
                }}
              >
                {chip.label}
                {'count' in chip && chip.count != null ? (
                  <span className="ml-1.5 text-[11px] opacity-80">{chip.count}</span>
                ) : null}
              </Button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full">
              <LeadsFilters filters={filters} onFiltersChange={handleFiltersChange} ownerOptions={ownerOptions} />
            </div>
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-muted-foreground" />
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[120px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk actions toolbar */}
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <span className="text-sm font-medium">{selectedIds.size} selected</span>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => setBulkAction('status')} className="gap-1">
                  <Tag className="h-4 w-4" />
                  Update status
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => setBulkAction('owner')} className="gap-1">
                  <UserPlus className="h-4 w-4" />
                  Assign owner
                </Button>
              )}
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => setBulkAction('followup')} className="gap-1">
                  <Calendar className="h-4 w-4" />
                  Schedule follow-up
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => exportCsv(true)} className="gap-1">
                <Download className="h-4 w-4" />
                Export selected
              </Button>
              {isAdmin && (
                <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Clear
              </Button>
            </div>
          )}

          {/* Table */}
          <LeadsTable
            leads={leads}
            loading={loading}
            onRefresh={fetchLeads}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onLeadClick={(lead) => setSidePanelLead((prev) => prev?.id === lead.id ? null : lead)}
            emptyMessage={
              queueView === 'sla_breach'
                ? 'No SLA breaches.'
                : queueView === 'sla_warning'
                  ? 'No leads approaching SLA.'
                  : queueView === 'no_next_step'
                    ? 'Every open lead has a follow-up or task.'
                    : queueView === 'overdue_followup'
                      ? 'No overdue follow-ups.'
                      : queueView === 'overdue_task'
                        ? 'No overdue tasks on leads.'
                        : queueView
                          ? 'No leads match this view.'
                          : 'No leads found. Add your first lead to get started!'
            }
            activeleadId={sidePanelLead?.id}
          />
        </div>

        {/* Side panel */}
        {sidePanelLead && (
          <div className="w-[400px] shrink-0 border-l border-border overflow-hidden flex flex-col animate-in slide-in-from-right duration-200">
            <LeadSidePanel
              lead={sidePanelLead}
              onClose={() => setSidePanelLead(null)}
              onLeadUpdated={fetchLeads}
            />
          </div>
        )}
      </div>

      <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} onSuccess={fetchLeads} />
      <LeadImportDialog open={importOpen} onOpenChange={setImportOpen} onSuccess={fetchLeads} />
      <BulkActionsDialog
        open={bulkAction !== null}
        onOpenChange={(open) => !open && setBulkAction(null)}
        action={bulkAction ?? 'status'}
        leadIds={[...selectedIds]}
        onSuccess={bulkUpdateSuccess}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} lead(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected leads and all associated data (activities, tasks, follow-ups, documents). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Possible duplicates</DialogTitle>
            <DialogDescription>
              Same website host or company name. Open both records — this does not merge them.
            </DialogDescription>
          </DialogHeader>
          {dupLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Scanning…</p>
          ) : dupPairs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No matching pairs found.</p>
          ) : (
            <ul className="space-y-2">
              {dupPairs.slice(0, 80).map((p) => (
                <li key={`${p.a.id}-${p.b.id}`} className="rounded-lg border border-border/80 p-3 text-sm">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                    {p.reason === 'website' ? `Website · ${p.key}` : `Company · ${p.key}`}
                  </p>
                  <div className="flex flex-col gap-1">
                    <Link to={`/leads/${p.a.id}`} className="text-primary hover:underline truncate">{p.a.company_name}</Link>
                    <Link to={`/leads/${p.b.id}`} className="text-primary hover:underline truncate">{p.b.company_name}</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
