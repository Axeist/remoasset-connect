import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllPaginated } from '@/lib/supabasePaginate';
import { isClosedStatusName } from '@/lib/rfq';
import { formatVendorTypeLabel, VENDOR_TYPE_VALUES } from '@/lib/vendorTypes';
import { Globe2, Search, Warehouse, Megaphone, Building2 } from 'lucide-react';

type Country = { id: string; name: string; code: string; region: string | null };
type Vendor = {
  id: string;
  company_name: string;
  country_ids: string[] | null;
  hq_country_id: string | null;
  vendor_types: string[] | null;
  warehouse_available: boolean | null;
  status?: { name: string } | null;
};

export default function CsmHome() {
  const [search, setSearch] = useState('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [openRfqs, setOpenRfqs] = useState(0);
  const [openRequests, setOpenRequests] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: countryRows }, vendorRows, rfqRes, reqRes] = await Promise.all([
        supabase.from('countries').select('id, name, code, region').order('name'),
        fetchAllPaginated<Vendor>((from, to) =>
          supabase
            .from('leads')
            .select('id, company_name, country_ids, hq_country_id, vendor_types, warehouse_available, status:lead_statuses(name)')
            .range(from, to)
        ),
        supabase.from('rfqs' as never).select('id', { count: 'exact', head: true }).in('status', ['sent', 'bidding', 'draft']),
        supabase.from('client_requests' as never).select('id', { count: 'exact', head: true }).neq('status', 'completed'),
      ]);
      setCountries((countryRows ?? []) as Country[]);
      setVendors(
        (vendorRows ?? []).filter((v) => isClosedStatusName((v.status as { name?: string } | null)?.name)),
      );
      setOpenRfqs(rfqRes.count ?? 0);
      setOpenRequests(reqRes.count ?? 0);
      setLoading(false);
    })();
  }, []);

  const q = search.trim().toLowerCase();
  const filteredCountries = useMemo(
    () =>
      countries.filter((c) => {
        if (!q) return true;
        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || (c.region ?? '').toLowerCase().includes(q);
      }),
    [countries, q],
  );

  const vendorsInCountry = (countryId: string) =>
    vendors.filter((v) => v.hq_country_id === countryId || (v.country_ids ?? []).includes(countryId));

  const selected = filteredCountries[0] && q ? filteredCountries[0] : null;
  const selectedVendors = selected ? vendorsInCountry(selected.id) : vendors;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">CSM workspace</h1>
          <p className="text-muted-foreground mt-1">
            Check whether we have a closed-won vendor in a country, then jump into RFQ, pricing, or clients.
          </p>
        </div>

        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search country, code, or region…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Closed-won vendors</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{loading ? '—' : selectedVendors.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Warehouse</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{loading ? '—' : selectedVendors.filter((v) => v.warehouse_available).length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Open RFQs</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{loading ? '—' : openRfqs}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Open client requests</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{loading ? '—' : openRequests}</CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="gap-2"><Link to="/csm/coverage"><Globe2 className="h-4 w-4" />Country coverage</Link></Button>
          <Button asChild variant="outline" className="gap-2"><Link to="/vendors"><Building2 className="h-4 w-4" />Vendor directory</Link></Button>
          <Button asChild variant="outline" className="gap-2"><Link to="/rfq"><Megaphone className="h-4 w-4" />RFQ hub</Link></Button>
          <Button asChild variant="outline" className="gap-2"><Link to="/clients"><Warehouse className="h-4 w-4" />Clients</Link></Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selected ? `${selected.name} vendors` : 'Countries with vendors'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(selected ? [selected] : filteredCountries)
              .map((c) => {
                const list = vendorsInCountry(c.id);
                if (!selected && list.length === 0 && q) return null;
                if (!selected && !q && list.length === 0) return null;
                const types = [...new Set(list.flatMap((v) => v.vendor_types ?? []))];
                return (
                  <div key={c.id} className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                    <div>
                      <p className="font-medium text-sm">{c.name} <span className="text-muted-foreground font-normal">{c.code}{c.region ? ` · ${c.region}` : ''}</span></p>
                      <p className="text-xs text-muted-foreground">
                        {list.length} vendor{list.length === 1 ? '' : 's'}
                        {types.length ? ` · ${types.map(formatVendorTypeLabel).join(', ')}` : ''}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="ghost"><Link to="/vendors">Open</Link></Button>
                  </div>
                );
              })}
            {!loading && filteredCountries.length === 0 && (
              <p className="text-sm text-muted-foreground">No countries match that search.</p>
            )}
          </CardContent>
        </Card>

        {selected && (
          <p className="text-xs text-muted-foreground">
            Types we cover here: {VENDOR_TYPE_VALUES.map(formatVendorTypeLabel).join(', ')}.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
