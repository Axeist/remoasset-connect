import { Fragment, useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { CLIENT_REQUEST_SELECT } from '@/lib/client-request-display';
import {
  aggregateWarehouseStorageByClient,
  buildWarehouseStorageEntries,
  warehouseStorageStats,
  type WarehouseClientStorage,
} from '@/lib/warehouse-storage';
import type { Client, ClientRequest } from '@/types/procurement';
import {
  Search, X, Package, Building2, Globe2, Truck, ChevronDown, ChevronRight, ExternalLink, Boxes,
} from 'lucide-react';
import { WarehouseStorageEntryCard } from '@/components/vendors/WarehouseStorageEntryCard';

export function WarehouseStorageTab() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [clientRows, setClientRows] = useState<WarehouseClientStorage[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [requests, clients] = await Promise.all([
        fetchAllPaginated<ClientRequest>(async (from, to) => {
          const { data, error } = await supabase
            .from('client_requests' as any)
            .select(`${CLIENT_REQUEST_SELECT}, client:clients!client_id(id, name, country:countries!country_id(name, code))`)
            .order('created_at', { ascending: false })
            .range(from, to);
          return { data: (data as ClientRequest[]) ?? null, error };
        }),
        fetchAllPaginated<Client>(async (from, to) => {
          const { data, error } = await supabase
            .from('clients' as any)
            .select('*, country:countries!country_id(name, code)')
            .order('name')
            .range(from, to);
          return { data: (data as Client[]) ?? null, error };
        }),
      ]);

      const clientsById = new Map(clients.map((c) => [c.id, c]));
      const entries = buildWarehouseStorageEntries(requests, clientsById);
      setClientRows(aggregateWarehouseStorageByClient(entries));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not load warehouse storage';
      toast({ title: 'Error', description: message, variant: 'destructive' });
      setClientRows([]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clientRows;
    const q = search.toLowerCase();
    return clientRows.filter((row) => {
      const blob = [
        row.clientName,
        row.clientCountry ?? '',
        ...row.entries.map((e) => [
          e.title,
          e.deviceSummary,
          e.warehouseLocation ?? '',
          e.vendorName ?? '',
        ].join(' ')),
      ].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }, [clientRows, search]);

  const stats = useMemo(() => warehouseStorageStats(filtered), [filtered]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by client, device, location, or vendor..."
          className="h-10 pl-10 pr-10"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Package className="h-3.5 w-3.5" /> Stored devices
          </div>
          <p className="text-xl font-bold tabular-nums">{stats.storedDevices}</p>
        </Card>
        <Card className="p-3 border-border/80">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Building2 className="h-3.5 w-3.5" /> Clients
          </div>
          <p className="text-xl font-bold">{stats.clients}</p>
        </Card>
        <Card className="p-3 border-border/80">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Globe2 className="h-3.5 w-3.5" /> Locations
          </div>
          <p className="text-xl font-bold">{stats.locations}</p>
        </Card>
        <Card className="p-3 border-blue-500/20 bg-blue-500/5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
            <Truck className="h-3.5 w-3.5" /> Incoming
          </div>
          <p className="text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">{stats.incomingDevices}</p>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Boxes className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <h3 className="font-semibold text-lg">No stored devices found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                {search
                  ? 'Try a different search.'
                  : 'Devices appear here when fulfillment ships to Remoasset inventory or retrieval requests store at a warehouse.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8" />
                    <TableHead className="text-sm">Client</TableHead>
                    <TableHead className="text-sm">Country</TableHead>
                    <TableHead className="text-sm text-right">Stored</TableHead>
                    <TableHead className="text-sm text-right">Incoming</TableHead>
                    <TableHead className="text-sm text-right">Requests</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const expanded = expandedClientId === row.clientId;
                    return (
                      <Fragment key={row.clientId}>
                        <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setExpandedClientId(expanded ? null : row.clientId)}>
                          <TableCell className="py-3">
                            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell className="font-semibold text-sm py-3.5">{row.clientName}</TableCell>
                          <TableCell className="text-sm py-3.5">{row.clientCountry ?? '—'}</TableCell>
                          <TableCell className="text-right text-base font-bold tabular-nums py-3.5">{row.storedDevices}</TableCell>
                          <TableCell className="text-right text-base tabular-nums text-blue-600 dark:text-blue-400 py-3.5">{row.incomingDevices || '—'}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums py-3.5">{row.entries.length}</TableCell>
                          <TableCell className="py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => { e.stopPropagation(); navigate(`/clients/${row.clientId}`); }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow className="bg-muted/10 hover:bg-muted/10">
                            <TableCell colSpan={7} className="p-3 sm:p-4">
                              <div className="space-y-3">
                                {row.entries.map((entry) => (
                                  <WarehouseStorageEntryCard
                                    key={`${entry.requestId}-${entry.direction}`}
                                    entry={entry}
                                    onOpenClient={() => navigate(`/clients/${row.clientId}`)}
                                  />
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
