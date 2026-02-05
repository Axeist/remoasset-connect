import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { LeadsTable } from '@/components/leads/LeadsTable';
import { LeadsFilters, type LeadsFiltersState } from '@/components/leads/LeadsFilters';
import { LeadFormDialog } from '@/components/leads/LeadFormDialog';
import { BulkActionsDialog } from '@/components/leads/BulkActionsDialog';
import { Button } from '@/components/ui/button';
import { Plus, Download, ArrowUpDown, UserPlus, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Lead } from '@/types/lead';

const PAGE_SIZE = 10;
type SortField = 'company_name' | 'created_at' | 'lead_score' | 'contact_name';
type SortOrder = 'asc' | 'desc';

export default function Leads() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'status' | 'owner' | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [ownerOptions, setOwnerOptions] = useState<{ id: string; full_name: string | null }[]>([]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [filters, setFilters] = useState<LeadsFiltersState>({
    search: searchParams.get('search') ?? '',
    status: '',
    country: '',
    owner: searchParams.get('owner') ?? '',
    scoreMin: 0,
    scoreMax: 100,
  });
  const { toast } = useToast();

  useEffect(() => {
    const search = searchParams.get('search');
    const owner = searchParams.get('owner');
    setFilters((f) => ({
      ...f,
      ...(search != null ? { search: search ?? '' } : {}),
      ...(owner != null ? { owner: owner ?? '' } : {}),
    }));
  }, [searchParams]);

  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id');
      if (roles?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', roles.map((r) => r.user_id));
        setOwnerOptions((profiles ?? []).map((p) => ({ id: p.user_id, full_name: p.full_name })));
      }
    })();
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [filters, page, sortBy, sortOrder]);

  const handleFiltersChange = (newFilters: LeadsFiltersState) => {
    setFilters(newFilters);
    setPage(1);
  };

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase
      .from('leads')
      .select(
        `
        id,
        company_name,
        contact_name,
        email,
        phone,
        lead_score,
        created_at,
        owner_id,
        status:lead_statuses(name, color),
        country:countries(name, code)
      `,
        { count: 'exact' }
      )
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

    if (filters.search) {
      query = query.or(`company_name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }
    if (filters.status) query = query.eq('status_id', filters.status);
    if (filters.country) query = query.eq('country_id', filters.country);
    if (filters.owner === 'unassigned') query = query.is('owner_id', null);
    else if (filters.owner) query = query.eq('owner_id', filters.owner);
    query = query.gte('lead_score', filters.scoreMin).lte('lead_score', filters.scoreMax);

    const { data: rawData, error, count } = await query;

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to fetch leads' });
      setLoading(false);
      return;
    }

    const data = (rawData ?? []) as (Lead & { owner_id?: string | null })[];
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

    const leadsWithOwner = data.map((l) => ({
      ...l,
      owner: l.owner_id ? ownerMap[l.owner_id] ?? null : null,
    }));
    setLeads(leadsWithOwner);
    setTotalCount(count ?? 0);
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

  const exportCsv = (selectedOnly?: boolean) => {
    const toExport = selectedOnly && selectedIds.size > 0
      ? leads.filter((l) => selectedIds.has(l.id))
      : leads;
    const headers = ['Company', 'Contact', 'Email', 'Phone', 'Status', 'Score', 'Country', 'Created'];
    const rows = toExport.map((l) => [
      l.company_name,
      l.contact_name ?? '',
      l.email ?? '',
      l.phone ?? '',
      l.status?.name ?? '',
      l.lead_score ?? '',
      l.country?.name ?? '',
      new Date(l.created_at).toLocaleDateString(),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${toExport.length} lead(s) exported.` });
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground mt-1">Manage and track your sales leads</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2" onClick={() => exportCsv(false)} disabled={totalCount === 0}>
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button className="gap-2 gradient-primary" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Filters */}
        <LeadsFilters filters={filters} onFiltersChange={handleFiltersChange} ownerOptions={ownerOptions} />

        {/* Bulk actions toolbar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/50 border">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => setBulkAction('status')} className="gap-1">
              <Tag className="h-4 w-4" />
              Update status
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkAction('owner')} className="gap-1">
              <UserPlus className="h-4 w-4" />
              Assign owner
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportCsv(true)} className="gap-1">
              <Download className="h-4 w-4" />
              Export selected
            </Button>
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
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          onPageChange={setPage}
        />

        <LeadFormDialog open={formOpen} onOpenChange={setFormOpen} onSuccess={fetchLeads} />
        <BulkActionsDialog
          open={bulkAction !== null}
          onOpenChange={(open) => !open && setBulkAction(null)}
          action={bulkAction ?? 'status'}
          leadIds={[...selectedIds]}
          onSuccess={bulkUpdateSuccess}
        />
      </div>
    </AppLayout>
  );
}
