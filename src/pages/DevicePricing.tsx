import { useState, useEffect, useMemo, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Search, Plus, ArrowUpDown, ArrowUp, ArrowDown, ChevronDown, ChevronRight,
  DollarSign, Globe2, Building2, Laptop, X, Filter, CalendarClock,
} from 'lucide-react';
import { discountVsMrp } from '@/lib/mrp-insights';
import type { VendorDevicePricing } from '@/types/procurement';

type SortKey = 'brand' | 'device_model' | 'price_usd' | 'country' | 'vendor' | 'quote_validity_date';

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const words = query.trim().split(/\s+/).filter(Boolean);
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/60 text-foreground rounded-sm px-0.5">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function quoteStatus(validityDate: string | null): { label: string; variant: 'default' | 'destructive' | 'secondary' } {
  if (!validityDate) return { label: 'No Expiry', variant: 'secondary' };
  const today = new Date().toISOString().slice(0, 10);
  return validityDate >= today
    ? { label: 'Valid', variant: 'default' }
    : { label: 'Expired', variant: 'destructive' };
}

export default function DevicePricing() {
  const { toast } = useToast();
  const [data, setData] = useState<VendorDevicePricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCountry, setFilterCountry] = useState('all');
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterBrand, setFilterBrand] = useState('all');
  const [filterQuoteStatus, setFilterQuoteStatus] = useState<'all' | 'valid' | 'expired'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('brand');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<VendorDevicePricing | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 50;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: rows, error } = await supabase
      .from('vendor_device_pricing' as any)
      .select('*, vendor:leads!vendor_id(company_name), country:countries!country_id(name, code)')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading pricing', description: error.message, variant: 'destructive' });
    } else {
      setData((rows as any) || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const uniqueCountries = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    data.forEach((d) => { if (d.country) map.set(d.country_id, { id: d.country_id, name: d.country.name }); });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const uniqueVendors = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    data.forEach((d) => { if (d.vendor) map.set(d.vendor_id, { id: d.vendor_id, name: d.vendor.company_name }); });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const uniqueBrands = useMemo(() => {
    return [...new Set(data.map((d) => d.brand))].sort();
  }, [data]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const q = search.toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);

    return data.filter((d) => {
      if (filterCountry !== 'all' && d.country_id !== filterCountry) return false;
      if (filterVendor !== 'all' && d.vendor_id !== filterVendor) return false;
      if (filterBrand !== 'all' && d.brand !== filterBrand) return false;
      if (filterQuoteStatus === 'valid' && (!d.quote_validity_date || d.quote_validity_date < today)) return false;
      if (filterQuoteStatus === 'expired' && (!d.quote_validity_date || d.quote_validity_date >= today)) return false;

      if (words.length > 0) {
        const searchable = [
          d.brand, d.device_model, d.processor, d.ram, d.storage,
          d.vendor?.company_name || '', d.country?.name || '',
          d.display_size, d.os || '', d.gpu || '',
        ].join(' ').toLowerCase();
        return words.every((w) => searchable.includes(w));
      }
      return true;
    });
  }, [data, search, filterCountry, filterVendor, filterBrand, filterQuoteStatus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortKey) {
        case 'brand': av = a.brand; bv = b.brand; break;
        case 'device_model': av = a.device_model; bv = b.device_model; break;
        case 'price_usd': av = a.price_usd; bv = b.price_usd; break;
        case 'country': av = a.country?.name || ''; bv = b.country?.name || ''; break;
        case 'vendor': av = a.vendor?.company_name || ''; bv = b.vendor?.company_name || ''; break;
        case 'quote_validity_date': av = a.quote_validity_date || ''; bv = b.quote_validity_date || ''; break;
      }
      const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const paginated = useMemo(() => sorted.slice(page * pageSize, (page + 1) * pageSize), [sorted, page]);
  const totalPages = Math.ceil(sorted.length / pageSize);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) { setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  const clearFilters = () => {
    setFilterCountry('all'); setFilterVendor('all');
    setFilterBrand('all'); setFilterQuoteStatus('all');
  };

  const hasActiveFilters = filterCountry !== 'all' || filterVendor !== 'all' || filterBrand !== 'all' || filterQuoteStatus !== 'all';

  const stats = useMemo(() => {
    const prices = filtered.map((d) => d.price_usd);
    const avgPrice = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const countriesSet = new Set(filtered.map((d) => d.country_id));
    const vendorsSet = new Set(filtered.map((d) => d.vendor_id));
    const withMrp = filtered.filter((d) => d.mrp_usd && d.mrp_usd > 0);
    const pcts = withMrp.map((d) => discountVsMrp(Number(d.mrp_usd), Number(d.price_usd))).filter(Boolean) as { pctOffMrp: number }[];
    const avgPctOff = pcts.length ? pcts.reduce((a, b) => a + b.pctOffMrp, 0) / pcts.length : null;
    const outlier = pcts.length
      ? withMrp
          .map((d) => ({ d, ins: discountVsMrp(Number(d.mrp_usd), Number(d.price_usd)) }))
          .filter((x) => x.ins)
          .sort((a, b) => (b.ins!.pctOffMrp) - (a.ins!.pctOffMrp))[0]
      : null;
    return {
      total: filtered.length,
      avgPrice: avgPrice.toFixed(2),
      countries: countriesSet.size,
      vendors: vendorsSet.size,
      avgPctOff,
      outlierLabel: outlier ? `${outlier.d.brand} ${outlier.d.device_model} (${outlier.ins!.pctOffMrp.toFixed(0)}% off MRP)` : null,
    };
  }, [filtered]);

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Device Pricing</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Search vendor RFP pricing for any device across all countries</p>
          </div>
          <Button onClick={() => { setEditItem(null); setAddOpen(true); }} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Add Pricing
          </Button>
        </div>

        {/* Global Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by device, brand, processor, specs, vendor, or country..."
            className="h-12 pl-12 pr-10 text-base rounded-xl border-2 focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Laptop className="h-3.5 w-3.5" /> Devices
            </div>
            <p className="text-xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Avg Price
            </div>
            <p className="text-xl font-bold">${stats.avgPrice}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <DollarSign className="h-3.5 w-3.5" /> Avg % off MRP
            </div>
            <p className="text-xl font-bold">{stats.avgPctOff != null ? `${stats.avgPctOff.toFixed(0)}%` : '—'}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Globe2 className="h-3.5 w-3.5" /> Countries
            </div>
            <p className="text-xl font-bold">{stats.countries}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
              <Building2 className="h-3.5 w-3.5" /> Vendors
            </div>
            <p className="text-xl font-bold">{stats.vendors}</p>
          </Card>
        </div>
        {stats.outlierLabel && (
          <p className="text-xs text-muted-foreground">Largest discount vs list: {stats.outlierLabel}</p>
        )}

        {/* Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-1.5"
          >
            <Filter className="h-3.5 w-3.5" /> Filters
            {hasActiveFilters && <span className="ml-1 h-4 w-4 rounded-full bg-primary-foreground/20 text-[10px] flex items-center justify-center">!</span>}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
              <X className="h-3.5 w-3.5" /> Clear all
            </Button>
          )}
        </div>

        {showFilters && (
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Select value={filterCountry} onValueChange={(v) => { setFilterCountry(v); setPage(0); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Countries" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {uniqueCountries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterVendor} onValueChange={(v) => { setFilterVendor(v); setPage(0); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Vendors" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {uniqueVendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterBrand} onValueChange={(v) => { setFilterBrand(v); setPage(0); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Brands" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {uniqueBrands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterQuoteStatus} onValueChange={(v: any) => { setFilterQuoteStatus(v); setPage(0); }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Quote Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Quotes</SelectItem>
                  <SelectItem value="valid">Valid Only</SelectItem>
                  <SelectItem value="expired">Expired Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        )}

        {/* Results Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Laptop className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="font-semibold text-lg">No devices found</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  {search ? `No devices match "${search}". Try a different search term.` : 'Add your first device pricing to get started.'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('brand')}>
                          <span className="flex items-center">Brand <SortIcon col="brand" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('device_model')}>
                          <span className="flex items-center">Device Model <SortIcon col="device_model" /></span>
                        </TableHead>
                        <TableHead>Specs</TableHead>
                        <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('price_usd')}>
                          <span className="flex items-center justify-end">Price (USD) <SortIcon col="price_usd" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('country')}>
                          <span className="flex items-center">Country <SortIcon col="country" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('vendor')}>
                          <span className="flex items-center">Vendor <SortIcon col="vendor" /></span>
                        </TableHead>
                        <TableHead className="cursor-pointer select-none" onClick={() => handleSort('quote_validity_date')}>
                          <span className="flex items-center">Quote Status <SortIcon col="quote_validity_date" /></span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((row) => {
                        const qs = quoteStatus(row.quote_validity_date);
                        const isExpanded = expandedId === row.id;
                        return (
                          <TableRowGroup key={row.id}>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setExpandedId(isExpanded ? null : row.id)}
                            >
                              <TableCell className="w-8 pr-0">
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </TableCell>
                              <TableCell className="font-medium">{highlightText(row.brand, search)}</TableCell>
                              <TableCell>{highlightText(row.device_model, search)}</TableCell>
                              <TableCell>
                                <span className="text-xs text-muted-foreground">
                                  {highlightText(row.processor, search)}
                                  {' | '}
                                  {highlightText(row.ram, search)}
                                  {' | '}
                                  {highlightText(row.storage, search)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                                ${Number(row.price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>{highlightText(row.country?.name || '-', search)}</TableCell>
                              <TableCell>{highlightText(row.vendor?.company_name || '-', search)}</TableCell>
                              <TableCell>
                                <Badge variant={qs.variant} className="text-xs">{qs.label}</Badge>
                                {row.quote_validity_date && (
                                  <span className="ml-1.5 text-xs text-muted-foreground">{row.quote_validity_date}</span>
                                )}
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow className="bg-muted/30 hover:bg-muted/30">
                                <TableCell colSpan={8}>
                                  <ExpandedDetails
                                    row={row}
                                    search={search}
                                    onEdit={() => { setEditItem(row); setAddOpen(true); }}
                                  />
                                </TableCell>
                              </TableRow>
                            )}
                          </TableRowGroup>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <span className="text-xs text-muted-foreground">
                      Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
                    </span>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 0}>Prev</Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= totalPages - 1}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AddDevicePricingDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={fetchData}
        editItem={editItem}
      />
    </AppLayout>
  );
}

function TableRowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ExpandedDetails({ row, search, onEdit }: { row: VendorDevicePricing; search: string; onEdit: () => void }) {
  const addons = (row.addons || []) as any[];

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Display</span>
          <p className="font-medium">{highlightText(row.display_size, search)}</p>
        </div>
        {row.gpu && (
          <div>
            <span className="text-muted-foreground text-xs">GPU</span>
            <p className="font-medium">{highlightText(row.gpu, search)}</p>
          </div>
        )}
        {row.os && (
          <div>
            <span className="text-muted-foreground text-xs">OS</span>
            <p className="font-medium">{highlightText(row.os, search)}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground text-xs">Quantity</span>
          <p className="font-medium">{row.quantity}</p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs">Quote Date</span>
          <p className="font-medium">{row.quote_date}</p>
        </div>
        {row.quote_validity_date && (
          <div>
            <span className="text-muted-foreground text-xs">Valid Until</span>
            <p className="font-medium flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              {row.quote_validity_date}
            </p>
          </div>
        )}
      </div>

      {addons.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground font-medium">Add-ons</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {addons.map((a: any, i: number) => (
              <Badge key={i} variant="outline" className="text-xs gap-1">
                {a.type}: {a.model} x{a.qty}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {row.notes && (
        <div>
          <span className="text-xs text-muted-foreground font-medium">Notes</span>
          <p className="text-sm mt-0.5">{row.notes}</p>
        </div>
      )}

      <div className="pt-1">
        <Button variant="outline" size="sm" onClick={onEdit}>Edit Pricing</Button>
      </div>
    </div>
  );
}
