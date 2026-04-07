import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Plus, Users, ChevronRight, X, Globe2, Package, Truck, CheckCircle2, Clock,
} from 'lucide-react';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import type { Client } from '@/types/procurement';

interface ClientWithStats extends Client {
  totalRequests: number;
  fulfilled: number;
  inTransit: number;
  pending: number;
}

export default function Clients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Client | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: clientRows, error: cErr }, { data: requestRows }] = await Promise.all([
      supabase.from('clients' as any)
        .select('*, country:countries!country_id(name, code)')
        .order('created_at', { ascending: false }),
      supabase.from('client_requests' as any)
        .select('client_id, status'),
    ]);

    if (cErr) {
      toast({ title: 'Error', description: cErr.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const statsMap = new Map<string, { total: number; fulfilled: number; inTransit: number; pending: number }>();
    (requestRows || []).forEach((r: any) => {
      const s = statsMap.get(r.client_id) || { total: 0, fulfilled: 0, inTransit: 0, pending: 0 };
      s.total++;
      if (r.status === 'fulfilled') s.fulfilled++;
      else if (r.status === 'in_transit') s.inTransit++;
      else if (r.status === 'pending' || r.status === 'vendor_allocated' || r.status === 'ordered') s.pending++;
      statsMap.set(r.client_id, s);
    });

    const combined: ClientWithStats[] = ((clientRows as any) || []).map((c: any) => {
      const s = statsMap.get(c.id) || { total: 0, fulfilled: 0, inTransit: 0, pending: 0 };
      return { ...c, totalRequests: s.total, fulfilled: s.fulfilled, inTransit: s.inTransit, pending: s.pending };
    });
    setClients(combined);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.country?.name || '').toLowerCase().includes(q) ||
      (c.contact_name || '').toLowerCase().includes(q)
    );
  }, [clients, search]);

  const totals = useMemo(() => ({
    clients: filtered.length,
    requests: filtered.reduce((a, c) => a + c.totalRequests, 0),
    fulfilled: filtered.reduce((a, c) => a + c.fulfilled, 0),
    inTransit: filtered.reduce((a, c) => a + c.inTransit, 0),
  }), [filtered]);

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 px-2 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Track client laptop fulfillment and orders</p>
          </div>
          <Button onClick={() => { setEditItem(null); setAddOpen(true); }} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Add Client
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Users className="h-3.5 w-3.5" /> Clients</div>
            <p className="text-xl font-bold">{totals.clients}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Package className="h-3.5 w-3.5" /> Total Requests</div>
            <p className="text-xl font-bold">{totals.requests}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><CheckCircle2 className="h-3.5 w-3.5" /> Fulfilled</div>
            <p className="text-xl font-bold text-green-600">{totals.fulfilled}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Truck className="h-3.5 w-3.5" /> In Transit</div>
            <p className="text-xl font-bold text-blue-600">{totals.inTransit}</p>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by name, country, or contact..."
            className="h-10 pl-10 pr-10"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="font-semibold text-lg">No clients found</h3>
                <p className="text-sm text-muted-foreground mt-1">{search ? 'Try a different search.' : 'Add your first client to get started.'}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Total Orders</TableHead>
                    <TableHead className="text-center">Fulfilled</TableHead>
                    <TableHead className="text-center">In Transit</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/clients/${c.id}`)}
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        {c.country ? (
                          <span className="flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5 text-muted-foreground" />{c.country.name}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.contact_name || '-'}</TableCell>
                      <TableCell className="text-center"><Badge variant="secondary">{c.totalRequests}</Badge></TableCell>
                      <TableCell className="text-center">
                        {c.fulfilled > 0 ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">{c.fulfilled}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.inTransit > 0 ? <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">{c.inTransit}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.pending > 0 ? <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{c.pending}</Badge> : <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ClientFormDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={fetchData} editItem={editItem} />
    </AppLayout>
  );
}
