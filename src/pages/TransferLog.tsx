import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeFormat } from '@/lib/date';
import { ArrowRightLeft, ExternalLink, Search, Filter, X } from 'lucide-react';

interface TransferRecord {
  id: string;
  lead_id: string;
  from_user_id: string | null;
  to_user_id: string;
  transferred_by: string;
  notes: string | null;
  created_at: string;
}

interface EnrichedTransfer extends TransferRecord {
  lead_name: string | null;
  from_name: string | null;
  to_name: string | null;
  transferred_by_name: string | null;
}

export default function TransferLog() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [transfers, setTransfers] = useState<EnrichedTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<{ id: string; full_name: string | null }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTransfers();
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id');
    if (!roles?.length) return;
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .in('user_id', roles.map((r) => r.user_id));
    setEmployees((profiles ?? []).map((p) => ({ id: p.user_id, full_name: p.full_name })));
  };

  const fetchTransfers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('lead_transfers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setLoading(false);
      return;
    }

    const records = (data ?? []) as TransferRecord[];
    if (records.length === 0) {
      setTransfers([]);
      setLoading(false);
      return;
    }

    const leadIds = [...new Set(records.map((r) => r.lead_id))];
    const userIds = [
      ...new Set(
        records.flatMap((r) => [r.from_user_id, r.to_user_id, r.transferred_by]).filter(Boolean)
      ),
    ] as string[];

    const [{ data: leads }, { data: profiles }] = await Promise.all([
      supabase.from('leads').select('id, company_name').in('id', leadIds),
      supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
    ]);

    const leadMap = (leads ?? []).reduce(
      (acc, l) => { acc[l.id] = l.company_name; return acc; },
      {} as Record<string, string>
    );
    const profileMap = (profiles ?? []).reduce(
      (acc, p) => { acc[p.user_id] = p.full_name; return acc; },
      {} as Record<string, string | null>
    );

    setTransfers(
      records.map((r) => ({
        ...r,
        lead_name: leadMap[r.lead_id] ?? '(deleted)',
        from_name: r.from_user_id ? (profileMap[r.from_user_id] ?? 'Unknown') : 'Unassigned',
        to_name: profileMap[r.to_user_id] ?? 'Unknown',
        transferred_by_name: profileMap[r.transferred_by] ?? 'Unknown',
      }))
    );
    setLoading(false);
  };

  const filtered = transfers.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matches =
        t.lead_name?.toLowerCase().includes(q) ||
        t.from_name?.toLowerCase().includes(q) ||
        t.to_name?.toLowerCase().includes(q) ||
        t.transferred_by_name?.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (employeeFilter !== 'all') {
      if (
        t.from_user_id !== employeeFilter &&
        t.to_user_id !== employeeFilter &&
        t.transferred_by !== employeeFilter
      )
        return false;
    }
    return true;
  });

  const clearFilters = () => {
    setSearchQuery('');
    setEmployeeFilter('all');
  };

  const hasActiveFilters = searchQuery || employeeFilter !== 'all';

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
              Transfer Log
            </h1>
            <p className="text-muted-foreground mt-1">
              Track all lead transfers between team members
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowFilters((p) => !p)}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                !
              </Badge>
            )}
          </Button>
        </div>

        {showFilters && (
          <Card className="card-shadow">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Lead, employee, or notes..."
                      className="pl-9 h-9"
                    />
                  </div>
                </div>
                <div className="min-w-[180px]">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Employee</label>
                  <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All employees</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.full_name || e.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-9">
                    <X className="h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="card-shadow">
          <CardHeader>
            <CardTitle className="text-base">
              {loading ? 'Loading...' : `${filtered.length} transfer${filtered.length !== 1 ? 's' : ''}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                {hasActiveFilters ? 'No transfers match your filters.' : 'No lead transfers yet.'}
              </p>
            ) : (
              <div className="space-y-3">
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/10">
                        <ArrowRightLeft className="h-4 w-4 text-indigo-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => navigate(`/leads/${t.lead_id}`)}
                          className="font-medium text-sm text-foreground hover:text-primary hover:underline inline-flex items-center gap-1"
                        >
                          {t.lead_name}
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{t.from_name}</span>
                        {' \u2192 '}
                        <span className="font-medium text-foreground">{t.to_name}</span>
                        <span className="mx-1.5">&middot;</span>
                        transferred by{' '}
                        <span className="font-medium text-foreground">{t.transferred_by_name}</span>
                      </p>
                      {t.notes && (
                        <p className="text-xs text-muted-foreground italic">
                          &ldquo;{t.notes}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {safeFormat(t.created_at, 'PPp')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
