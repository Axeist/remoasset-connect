import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Plus, Warehouse, X, DollarSign, Globe2, Building2, Edit,
} from 'lucide-react';
import { AddWarehousePricingDialog } from '@/components/warehouse/AddWarehousePricingDialog';
import type { WarehouseVendorPricing } from '@/types/procurement';

const CHARGE_COLS: { key: keyof WarehouseVendorPricing; label: string; short: string }[] = [
  { key: 'box_procurement_charges', label: 'Box Procurement', short: 'Box Proc.' },
  { key: 'box_custom_printing_charges', label: 'Box Custom Print', short: 'Box Print' },
  { key: 'shipping_to_employee', label: 'Ship to Employee', short: 'Ship Out' },
  { key: 'retrieve_from_employee', label: 'Retrieve from Employee', short: 'Retrieve' },
  { key: 'storage_charge', label: 'Storage', short: 'Storage' },
  { key: 'qc_charges', label: 'QC', short: 'QC' },
  { key: 'repair_upgrade_charges', label: 'Repair/Upgrade', short: 'Repair' },
  { key: 'redeployment_charges', label: 'Redeployment', short: 'Redeploy' },
];

function quoteStatus(validityDate: string | null): { label: string; variant: 'default' | 'destructive' | 'secondary' } {
  if (!validityDate) return { label: 'No Expiry', variant: 'secondary' };
  const today = new Date().toISOString().slice(0, 10);
  return validityDate >= today
    ? { label: 'Valid', variant: 'default' }
    : { label: 'Expired', variant: 'destructive' };
}

export default function WarehousePricing() {
  const { toast } = useToast();
  const [data, setData] = useState<WarehouseVendorPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<WarehouseVendorPricing | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('warehouse_vendor_pricing' as any)
      .select('*, vendor:leads!vendor_id(company_name), country:countries!country_id(name, code)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setData((rows as any) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((d) =>
      (d.vendor?.company_name || '').toLowerCase().includes(q) ||
      (d.country?.name || '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const stats = useMemo(() => {
    const avgTotal = filtered.length ? filtered.reduce((a, d) => a + Number(d.grand_total), 0) / filtered.length : 0;
    const vendors = new Set(filtered.map((d) => d.vendor_id)).size;
    const countries = new Set(filtered.filter((d) => d.country_id).map((d) => d.country_id)).size;
    return { total: filtered.length, avgTotal: avgTotal.toFixed(2), vendors, countries };
  }, [filtered]);

  return (
    <AppLayout>
      <div className="max-w-[1600px] mx-auto space-y-4 sm:space-y-6 px-2 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Warehouse Pricing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Warehouse vendor partner service charges (all in USD)</p>
          </div>
          <Button onClick={() => { setEditItem(null); setAddOpen(true); }} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Add Pricing
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Warehouse className="h-3.5 w-3.5" /> Entries</div>
            <p className="text-xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><DollarSign className="h-3.5 w-3.5" /> Avg Total</div>
            <p className="text-xl font-bold">${stats.avgTotal}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Building2 className="h-3.5 w-3.5" /> Vendors</div>
            <p className="text-xl font-bold">{stats.vendors}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Globe2 className="h-3.5 w-3.5" /> Countries</div>
            <p className="text-xl font-bold">{stats.countries}</p>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by vendor or country..."
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
                <Warehouse className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="font-semibold text-lg">No warehouse pricing found</h3>
                <p className="text-sm text-muted-foreground mt-1">{search ? 'Try a different search.' : 'Add your first warehouse vendor pricing.'}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10">Vendor</TableHead>
                      <TableHead>Country</TableHead>
                      {CHARGE_COLS.map((col) => (
                        <TableHead key={col.key} className="text-right whitespace-nowrap text-xs">{col.short}</TableHead>
                      ))}
                      <TableHead className="text-right font-bold">Grand Total</TableHead>
                      <TableHead>Quote Status</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const qs = quoteStatus(row.quote_validity_date);
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium sticky left-0 bg-background z-10">{row.vendor?.company_name || '-'}</TableCell>
                          <TableCell>{row.country?.name || '-'}</TableCell>
                          {CHARGE_COLS.map((col) => (
                            <TableCell key={col.key} className="text-right tabular-nums text-sm">
                              ${Number((row as any)[col.key]).toFixed(2)}
                            </TableCell>
                          ))}
                          <TableCell className="text-right tabular-nums font-bold text-sm">
                            ${Number(row.grand_total).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={qs.variant} className="text-xs">{qs.label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditItem(row); setAddOpen(true); }}>
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddWarehousePricingDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={fetchData} editItem={editItem} />
    </AppLayout>
  );
}
