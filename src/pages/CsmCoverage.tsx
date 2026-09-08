import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { isClosedStatusName } from '@/lib/rfq';
import { formatVendorTypeLabel } from '@/lib/vendorTypes';
import { REGIONS } from '@/components/leads/LeadsFilters';

type Country = { id: string; name: string; code: string; region: string | null };
type Vendor = {
  id: string;
  country_ids: string[] | null;
  hq_country_id: string | null;
  vendor_types: string[] | null;
  warehouse_available: boolean | null;
  status?: { name: string } | null;
};
type Rfq = { country_id: string | null; status: string | null };

export default function CsmCoverage() {
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: countryRows }, vendorRows, { data: rfqRows }] = await Promise.all([
        supabase.from('countries').select('id, name, code, region').order('name'),
        fetchAllPaginated<Vendor>((from, to) =>
          supabase
            .from('leads')
            .select('id, country_ids, hq_country_id, vendor_types, warehouse_available, status:lead_statuses(name)')
            .range(from, to)
        ),
        supabase.from('rfqs' as never).select('country_id, status'),
      ]);
      setCountries((countryRows ?? []) as Country[]);
      setVendors((vendorRows ?? []).filter((v) => isClosedStatusName((v.status as { name?: string } | null)?.name)));
      setRfqs((rfqRows ?? []) as Rfq[]);
      setLoading(false);
    })();
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return countries
      .filter((c) => !region || c.region === region)
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .map((c) => {
        const list = vendors.filter((v) => v.hq_country_id === c.id || (v.country_ids ?? []).includes(c.id));
        const types = [...new Set(list.flatMap((v) => v.vendor_types ?? []))];
        const warehouse = list.filter((v) => v.warehouse_available).length;
        const rfqCount = rfqs.filter((r) => r.country_id === c.id && !['cancelled', 'expired'].includes(r.status ?? '')).length;
        return { ...c, vendorCount: list.length, types, warehouse, rfqCount };
      })
      .filter((r) => r.vendorCount > 0 || r.rfqCount > 0 || q.length > 0);
  }, [countries, vendors, rfqs, search, region]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Country coverage</h1>
            <p className="text-muted-foreground mt-1">Closed-won procurement vendors by country, warehouse, and RFQ activity.</p>
          </div>
          <Button asChild variant="outline"><Link to="/csm">Back to CSM home</Link></Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Filter countries…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">All regions</option>
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Country</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Vendors</TableHead>
                <TableHead>Types</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>RFQs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">No coverage rows.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name} <span className="text-muted-foreground font-normal">{r.code}</span></TableCell>
                    <TableCell>{r.region ?? '—'}</TableCell>
                    <TableCell>{r.vendorCount}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.types.length === 0 ? '—' : r.types.map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px]">{formatVendorTypeLabel(t)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{r.warehouse}</TableCell>
                    <TableCell>{r.rfqCount}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
