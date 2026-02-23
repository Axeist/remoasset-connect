import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Globe2, Search, Building2, User, Mail, Phone, FileText, ExternalLink,
  ShieldCheck, DollarSign, Star, X, TrendingUp, ZoomIn, ZoomOut, RotateCcw,
  Filter, MapPin, ChevronRight,
} from 'lucide-react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const MAP_ID_TO_ALPHA2: Record<string, string> = {
  '4': 'AF', '8': 'AL', '12': 'DZ', '20': 'AD', '24': 'AO', '32': 'AR', '36': 'AU', '40': 'AT', '44': 'BS', '48': 'BH', '50': 'BD', '52': 'BB', '64': 'BT', '68': 'BO', '70': 'BA', '72': 'BW', '76': 'BR', '96': 'BN', '100': 'BG', '104': 'MM', '108': 'BI', '116': 'KH', '120': 'CM', '124': 'CA', '140': 'CF', '144': 'LK', '148': 'TD', '152': 'CL', '156': 'CN', '158': 'TW', '170': 'CO', '178': 'CG', '180': 'CD', '188': 'CR', '191': 'HR', '192': 'CU', '196': 'CY', '204': 'BJ', '208': 'DK', '212': 'DM', '214': 'DO', '218': 'EC', '222': 'SV', '226': 'GQ', '231': 'ET', '232': 'ER', '233': 'EE', '234': 'FO', '242': 'FJ', '246': 'FI', '250': 'FR', '268': 'GE', '266': 'GA', '270': 'GM', '275': 'PS', '276': 'DE', '288': 'GH', '296': 'KI', '300': 'GR', '304': 'GL', '308': 'GD', '316': 'GU', '320': 'GT', '324': 'GN', '328': 'GY', '332': 'HT', '336': 'VA', '340': 'HN', '348': 'HU', '352': 'IS', '356': 'IN', '360': 'ID', '368': 'IQ', '372': 'IE', '376': 'IL', '380': 'IT', '384': 'CI', '388': 'JM', '392': 'JP', '398': 'KZ', '400': 'JO', '404': 'KE', '408': 'KP', '410': 'KR', '414': 'KW', '417': 'KG', '418': 'LA', '422': 'LB', '426': 'LS', '428': 'LV', '430': 'LR', '434': 'LY', '440': 'LT', '442': 'LU', '450': 'MG', '454': 'MW', '458': 'MY', '462': 'MV', '466': 'ML', '470': 'MT', '478': 'MR', '480': 'MU', '484': 'MX', '492': 'MC', '496': 'MN', '498': 'MD', '504': 'MA', '508': 'MZ', '512': 'OM', '516': 'NA', '520': 'NR', '524': 'NP', '528': 'NL', '548': 'VU', '554': 'NZ', '558': 'NI', '562': 'NE', '566': 'NG', '578': 'NO', '583': 'FM', '584': 'MH', '585': 'PW', '586': 'PK', '591': 'PA', '598': 'PG', '600': 'PY', '604': 'PE', '608': 'PH', '616': 'PL', '620': 'PT', '624': 'GW', '626': 'TL', '634': 'QA', '642': 'RO', '643': 'RU', '646': 'RW', '682': 'SA', '686': 'SN', '688': 'RS', '690': 'SC', '694': 'SL', '702': 'SG', '703': 'SK', '704': 'VN', '705': 'SI', '706': 'SO', '710': 'ZA', '716': 'ZW', '724': 'ES', '728': 'SS', '729': 'SD', '748': 'SZ', '752': 'SE', '756': 'CH', '760': 'SY', '764': 'TH', '768': 'TG', '776': 'TO', '780': 'TT', '784': 'AE', '788': 'TN', '792': 'TR', '795': 'TM', '798': 'TV', '800': 'UG', '804': 'UA', '807': 'MK', '818': 'EG', '826': 'GB', '834': 'TZ', '840': 'US', '854': 'BF', '858': 'UY', '860': 'UZ', '862': 'VE', '882': 'WS', '887': 'YE', '894': 'ZM',
};
MAP_ID_TO_ALPHA2['826'] = 'UK';

function getCountryCodeFromGeo(geo: any): string {
  const rawId = geo.id != null ? String(geo.id).trim() : '';
  const id = rawId.replace(/^0+/, '') || rawId;
  const alpha2 = MAP_ID_TO_ALPHA2[id] || MAP_ID_TO_ALPHA2[rawId] || geo.properties?.ISO_A2;
  return alpha2 ? alpha2.toUpperCase() : '';
}

interface VendorLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  lead_score: number | null;
  vendor_types: string[] | null;
  country_id: string | null;
  country?: { name: string; code: string } | null;
  status?: { name: string; color: string } | null;
  owner?: { full_name: string | null } | null;
  owner_id: string | null;
  created_at: string;
}

interface VendorDoc {
  id: string;
  lead_id: string;
  document_type: string;
  custom_name: string | null;
  file_path: string;
  file_name: string;
}

interface CountryStats {
  code: string;
  name: string;
  count: number;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.35;

const STATUS_WON_NAMES = ['won', 'closed won', 'closed-won'];

export default function Vendors() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';

  const [vendors, setVendors] = useState<VendorLead[]>([]);
  const [documents, setDocuments] = useState<VendorDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('');
  const [ndaFilter, setNdaFilter] = useState('');

  const [countries, setCountries] = useState<{ id: string; name: string; code: string }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string; name: string; color: string }[]>([]);

  const [mapPosition, setMapPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });

  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([
        supabase.from('countries').select('id, name, code').order('name'),
        supabase.from('lead_statuses').select('id, name, color, sort_order').order('sort_order'),
      ]);
      if (cRes.data) setCountries(cRes.data);
      if (sRes.data) setStatuses(sRes.data);
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const wonStatusNames = statuses
      .filter((s) => STATUS_WON_NAMES.includes(s.name.toLowerCase()))
      .map((s) => s.id);

    const { data: leads } = await supabase
      .from('leads')
      .select(`
        id, company_name, contact_name, email, phone, website, lead_score,
        vendor_types, country_id, owner_id, created_at,
        status:lead_statuses(name, color),
        country:countries(name, code)
      `)
      .order('company_name');

    const { data: docs } = await supabase
      .from('lead_documents')
      .select('id, lead_id, document_type, custom_name, file_path, file_name');

    setVendors((leads ?? []) as unknown as VendorLead[]);
    setDocuments((docs ?? []) as unknown as VendorDoc[]);
    setLoading(false);
  }, [statuses]);

  useEffect(() => {
    if (statuses.length > 0) fetchData();
  }, [fetchData, statuses]);

  const docsByLead = useMemo(() => {
    const map: Record<string, VendorDoc[]> = {};
    documents.forEach((d) => {
      if (!map[d.lead_id]) map[d.lead_id] = [];
      map[d.lead_id].push(d);
    });
    return map;
  }, [documents]);

  const allVendorTypes = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => v.vendor_types?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (search) {
        const q = search.toLowerCase();
        const match = [v.company_name, v.contact_name, v.email]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (countryFilter && v.country?.code !== countryFilter) return false;
      if (statusFilter && v.status?.name !== statusFilter) return false;
      if (vendorTypeFilter && !(v.vendor_types ?? []).includes(vendorTypeFilter)) return false;
      if (ndaFilter) {
        const docs = docsByLead[v.id] ?? [];
        const hasNda = docs.some((d) => d.document_type === 'nda');
        if (ndaFilter === 'has_nda' && !hasNda) return false;
        if (ndaFilter === 'no_nda' && hasNda) return false;
      }
      return true;
    });
  }, [vendors, search, countryFilter, statusFilter, vendorTypeFilter, ndaFilter, docsByLead]);

  const countryStats = useMemo((): CountryStats[] => {
    const map: Record<string, { name: string; count: number }> = {};
    filteredVendors.forEach((v) => {
      if (v.country) {
        const code = v.country.code.toUpperCase();
        if (!map[code]) map[code] = { name: v.country.name, count: 0 };
        map[code].count++;
      }
    });
    return Object.entries(map)
      .map(([code, d]) => ({ code, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [filteredVendors]);

  const countryStatsMap = useMemo(() => {
    const map: Record<string, number> = {};
    countryStats.forEach((c) => { map[c.code] = c.count; });
    return map;
  }, [countryStats]);

  const maxVendors = Math.max(...countryStats.map((c) => c.count), 1);

  const getCountryColor = useCallback((geo: any) => {
    const code = getCountryCodeFromGeo(geo);
    const count = countryStatsMap[code] ?? 0;
    if (count === 0) return 'var(--map-no-leads)';
    const intensity = count / maxVendors;
    if (intensity > 0.75) return 'hsl(var(--primary))';
    if (intensity > 0.5) return 'hsl(var(--primary) / 0.8)';
    if (intensity > 0.25) return 'hsl(var(--primary) / 0.55)';
    return 'hsl(var(--primary) / 0.35)';
  }, [countryStatsMap, maxVendors]);

  const getTooltipContent = useCallback((geo: any) => {
    const code = getCountryCodeFromGeo(geo);
    const name = geo.properties?.name || geo.properties?.NAME || 'Unknown';
    const count = countryStatsMap[code] ?? 0;
    return count > 0 ? `${name}: ${count} vendor${count !== 1 ? 's' : ''}` : `${name}: No vendors`;
  }, [countryStatsMap]);

  const handleCountryClick = useCallback((geo: any) => {
    const code = getCountryCodeFromGeo(geo);
    if (countryStatsMap[code]) {
      setCountryFilter((prev) => (prev === code ? '' : code));
    }
  }, [countryStatsMap]);

  const handleViewDoc = async (doc: VendorDoc) => {
    const { data, error } = await supabase.storage.from('lead-documents').createSignedUrl(doc.file_path, 120);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const activeFilterCount = [search, countryFilter, statusFilter, vendorTypeFilter, ndaFilter].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setCountryFilter('');
    setStatusFilter('');
    setVendorTypeFilter('');
    setNdaFilter('');
  };

  const wonVendors = filteredVendors.filter((v) => STATUS_WON_NAMES.includes((v.status?.name ?? '').toLowerCase()));
  const withNda = filteredVendors.filter((v) => (docsByLead[v.id] ?? []).some((d) => d.document_type === 'nda'));
  const withPricing = filteredVendors.filter((v) => (docsByLead[v.id] ?? []).some((d) => d.document_type === 'pricing'));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight">Vendors</h1>
            <p className="text-muted-foreground mt-1">Onboarded vendors worldwide — documents, pricing & insights at a glance</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 text-sm">
              <Building2 className="h-3.5 w-3.5" />
              {filteredVendors.length} vendor{filteredVendors.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="gap-1.5 text-sm">
              <Globe2 className="h-3.5 w-3.5" />
              {countryStats.length} countr{countryStats.length !== 1 ? 'ies' : 'y'}
            </Badge>
          </div>
        </div>

        {/* KPI Widgets */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredVendors.length}</p>
                <p className="text-xs text-muted-foreground">Total Vendors</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{wonVendors.length}</p>
                <p className="text-xs text-muted-foreground">Closed / Won</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{withNda.length}</p>
                <p className="text-xs text-muted-foreground">NDA Signed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{withPricing.length}</p>
                <p className="text-xs text-muted-foreground">Pricing Available</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* World Map */}
        <Card className="[--map-no-leads:hsl(var(--muted))] [--map-stroke:hsl(var(--border))]">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe2 className="h-5 w-5" />
                  Vendor Distribution
                </CardTitle>
                <CardDescription className="mt-1">Click a country to filter vendors from that region</CardDescription>
              </div>
              {countryFilter && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCountryFilter('')}>
                  <MapPin className="h-3.5 w-3.5" />
                  {countries.find((c) => c.code === countryFilter)?.name ?? countryFilter}
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative w-full h-[420px] rounded-xl overflow-hidden border border-border bg-muted/20">
              <ComposableMap projectionConfig={{ scale: 165 }} className="w-full h-full">
                <ZoomableGroup
                  center={mapPosition.coordinates}
                  zoom={mapPosition.zoom}
                  onMoveEnd={setMapPosition}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                >
                  <Geographies geography={geoUrl}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const code = getCountryCodeFromGeo(geo);
                        const isSelected = countryFilter === code;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={isSelected ? 'hsl(var(--accent))' : getCountryColor(geo)}
                            stroke="hsl(var(--border))"
                            strokeWidth={isSelected ? 1.5 : 0.65}
                            onClick={() => handleCountryClick(geo)}
                            style={{
                              default: { outline: 'none', transition: 'fill 0.2s ease' },
                              hover: {
                                fill: (countryStatsMap[code] ?? 0) > 0 ? 'hsl(var(--accent))' : 'hsl(var(--muted))',
                                outline: 'none',
                                cursor: (countryStatsMap[code] ?? 0) > 0 ? 'pointer' : 'default',
                                filter: 'brightness(1.08)',
                              },
                              pressed: { outline: 'none' },
                            }}
                            data-tooltip-id="vendor-map-tooltip"
                            data-tooltip-content={getTooltipContent(geo)}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>

              <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 rounded-lg border bg-card/95 p-1 shadow-lg backdrop-blur-sm">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMapPosition((p) => ({ ...p, zoom: Math.min(p.zoom * ZOOM_STEP, MAX_ZOOM) }))}>
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMapPosition((p) => ({ ...p, zoom: Math.max(p.zoom / ZOOM_STEP, MIN_ZOOM) }))}>
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMapPosition({ coordinates: [0, 20], zoom: 1 })}>
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Tooltip
                id="vendor-map-tooltip"
                place="top"
                className="!bg-popover !text-popover-foreground !border !border-border !rounded-lg !px-3 !py-2 !text-sm !opacity-100 !shadow-lg"
                style={{ whiteSpace: 'pre-line', zIndex: 1000 }}
              />
            </div>

            {/* Country pills below map */}
            <div className="flex flex-wrap gap-2 mt-4">
              {countryStats.slice(0, 20).map((c) => (
                <button
                  key={c.code}
                  onClick={() => setCountryFilter((prev) => (prev === c.code ? '' : c.code))}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all',
                    countryFilter === c.code
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-foreground border-border hover:border-primary/40'
                  )}
                >
                  {c.name}
                  <span className="font-bold">{c.count}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search vendors..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
              <Select value={countryFilter || '__all__'} onValueChange={(v) => setCountryFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[180px] h-10">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Countries</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter || '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[160px] h-10">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allVendorTypes.length > 0 && (
                <Select value={vendorTypeFilter || '__all__'} onValueChange={(v) => setVendorTypeFilter(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="w-[160px] h-10">
                    <SelectValue placeholder="Vendor Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Types</SelectItem>
                    {allVendorTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={ndaFilter || '__all__'} onValueChange={(v) => setNdaFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[150px] h-10">
                  <SelectValue placeholder="NDA Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All NDA</SelectItem>
                  <SelectItem value="has_nda">NDA Signed</SelectItem>
                  <SelectItem value="no_nda">No NDA</SelectItem>
                </SelectContent>
              </Select>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                  Clear ({activeFilterCount})
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Vendor Cards */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        ) : filteredVendors.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No vendors found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredVendors.map((v) => {
              const docs = docsByLead[v.id] ?? [];
              const ndaDocs = docs.filter((d) => d.document_type === 'nda');
              const pricingDocs = docs.filter((d) => d.document_type === 'pricing');
              const otherDocs = docs.filter((d) => d.document_type !== 'nda' && d.document_type !== 'pricing');

              return (
                <Card
                  key={v.id}
                  className="group transition-all duration-200 hover:shadow-lg hover:border-primary/30 cursor-pointer"
                  onClick={() => navigate(`/leads/${v.id}`)}
                >
                  <CardContent className="p-5">
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary shrink-0" />
                          <h3 className="font-semibold text-foreground truncate">{v.company_name}</h3>
                        </div>
                        {v.contact_name && (
                          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            {v.contact_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {v.status && (
                          <Badge className="border-0 text-white text-xs" style={{ backgroundColor: v.status.color }}>
                            {v.status.name}
                          </Badge>
                        )}
                        {v.lead_score != null && v.lead_score > 0 && (
                          <Badge variant="secondary" className="text-xs font-bold tabular-nums">
                            {v.lead_score}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
                      {v.country && (
                        <span className="flex items-center gap-1">
                          <Globe2 className="h-3 w-3" />
                          {v.country.name}
                        </span>
                      )}
                      {v.email && (
                        <span className="flex items-center gap-1 truncate max-w-[180px]">
                          <Mail className="h-3 w-3" />
                          {v.email}
                        </span>
                      )}
                      {v.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {v.phone}
                        </span>
                      )}
                    </div>

                    {/* Vendor types */}
                    {v.vendor_types && v.vendor_types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {v.vendor_types.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] font-normal">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Documents row */}
                    {docs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                        {ndaDocs.map((d) => (
                          <button
                            key={d.id}
                            onClick={(e) => { e.stopPropagation(); handleViewDoc(d); }}
                            className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
                          >
                            <ShieldCheck className="h-3 w-3" />
                            {d.custom_name || 'NDA'}
                          </button>
                        ))}
                        {pricingDocs.map((d) => (
                          <button
                            key={d.id}
                            onClick={(e) => { e.stopPropagation(); handleViewDoc(d); }}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                          >
                            <DollarSign className="h-3 w-3" />
                            {d.custom_name || 'Pricing'}
                          </button>
                        ))}
                        {otherDocs.map((d) => (
                          <button
                            key={d.id}
                            onClick={(e) => { e.stopPropagation(); handleViewDoc(d); }}
                            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                          >
                            <FileText className="h-3 w-3" />
                            {d.custom_name || d.file_name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Open link */}
                    <div className="flex items-center justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs text-primary flex items-center gap-1">
                        View details <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
