import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatVendorTypeLabel } from '@/lib/vendorTypes';
import {
  Globe2, Search, Building2, User, Mail, Phone, FileText, ExternalLink,
  ShieldCheck, DollarSign, Star, X, ZoomIn, ZoomOut, RotateCcw,
  MapPin, ChevronRight, ChevronDown, Warehouse,
} from 'lucide-react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { REGIONS } from '@/components/leads/LeadsFilters';
import {
  buildCodeToRegion,
  countryCodesMatch,
  isCountryVisibleInFilters,
  mergeVendorCountries,
  vendorMatchesCountryFilters,
  vendorMatchesRegionFilters,
} from '@/lib/region-filters';
import {
  isCountrySelectedInFilters,
  vendorMatchesDocFilters,
  vendorMatchesNdaFilters,
  vendorMatchesOwnerFilters,
  vendorMatchesVendorTypeFilters,
  vendorMatchesWarehouseFilters,
} from '@/lib/vendor-directory-filters';
import { FilterMultiSelect, toggleInList } from '@/components/vendors/FilterMultiSelect';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const MAP_ID_TO_ALPHA2: Record<string, string> = {
  '4': 'AF', '8': 'AL', '12': 'DZ', '20': 'AD', '24': 'AO', '32': 'AR', '36': 'AU', '40': 'AT', '44': 'BS', '48': 'BH', '50': 'BD', '52': 'BB', '64': 'BT', '68': 'BO', '70': 'BA', '72': 'BW', '76': 'BR', '96': 'BN', '100': 'BG', '104': 'MM', '108': 'BI', '116': 'KH', '120': 'CM', '124': 'CA', '140': 'CF', '144': 'LK', '148': 'TD', '152': 'CL', '156': 'CN', '158': 'TW', '170': 'CO', '178': 'CG', '180': 'CD', '188': 'CR', '191': 'HR', '192': 'CU', '196': 'CY', '204': 'BJ', '208': 'DK', '212': 'DM', '214': 'DO', '218': 'EC', '222': 'SV', '226': 'GQ', '231': 'ET', '232': 'ER', '233': 'EE', '234': 'FO', '242': 'FJ', '246': 'FI', '250': 'FR', '268': 'GE', '266': 'GA', '270': 'GM', '275': 'PS', '276': 'DE', '288': 'GH', '296': 'KI', '300': 'GR', '304': 'GL', '308': 'GD', '316': 'GU', '320': 'GT', '324': 'GN', '328': 'GY', '332': 'HT', '336': 'VA', '340': 'HN', '348': 'HU', '352': 'IS', '356': 'IN', '360': 'ID', '368': 'IQ', '372': 'IE', '376': 'IL', '380': 'IT', '384': 'CI', '388': 'JM', '392': 'JP', '398': 'KZ', '400': 'JO', '404': 'KE', '408': 'KP', '410': 'KR', '414': 'KW', '417': 'KG', '418': 'LA', '422': 'LB', '426': 'LS', '428': 'LV', '430': 'LR', '434': 'LY', '440': 'LT', '442': 'LU', '450': 'MG', '454': 'MW', '458': 'MY', '462': 'MV', '466': 'ML', '470': 'MT', '478': 'MR', '480': 'MU', '484': 'MX', '492': 'MC', '496': 'MN', '498': 'MD', '504': 'MA', '508': 'MZ', '512': 'OM', '516': 'NA', '520': 'NR', '524': 'NP', '528': 'NL', '548': 'VU', '554': 'NZ', '558': 'NI', '562': 'NE', '566': 'NG', '578': 'NO', '583': 'FM', '584': 'MH', '585': 'PW', '586': 'PK', '591': 'PA', '598': 'PG', '600': 'PY', '604': 'PE', '608': 'PH', '616': 'PL', '620': 'PT', '624': 'GW', '626': 'TL', '634': 'QA', '642': 'RO', '643': 'RU', '646': 'RW', '682': 'SA', '686': 'SN', '688': 'RS', '690': 'SC', '694': 'SL', '702': 'SG', '703': 'SK', '704': 'VN', '705': 'SI', '706': 'SO', '710': 'ZA', '716': 'ZW', '724': 'ES', '728': 'SS', '729': 'SD', '748': 'SZ', '752': 'SE', '756': 'CH', '760': 'SY', '764': 'TH', '768': 'TG', '776': 'TO', '780': 'TT', '784': 'AE', '788': 'TN', '792': 'TR', '795': 'TM', '798': 'TV', '800': 'UG', '804': 'UA', '807': 'MK', '818': 'EG', '826': 'GB', '834': 'TZ', '840': 'US', '854': 'BF', '858': 'UY', '860': 'UZ', '862': 'VE', '882': 'WS', '887': 'YE', '894': 'ZM',
};
MAP_ID_TO_ALPHA2['826'] = 'UK';

function getCountryCodeFromGeo(geo: any): string {
  const rawId = geo.id != null ? String(geo.id).trim() : '';
  const id = rawId.replace(/^0+/, '') || rawId;
  const alpha2 = MAP_ID_TO_ALPHA2[id] || MAP_ID_TO_ALPHA2[rawId];
  return alpha2 ? alpha2.toUpperCase() : '';
}

interface VendorContact { name: string; email: string; phone: string; designation: string; }

interface VendorLead {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  lead_score: number | null;
  vendor_types: string[] | null;
  warehouse_available?: boolean;
  additional_contacts?: VendorContact[] | null;
  hq_country_id: string | null;
  hq_country?: { name: string; code: string } | null;
  country_ids: string[];
  countries?: { name: string; code: string }[] | null;
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

const NDA_FILTER_OPTIONS = [
  { value: 'has_nda', label: 'NDA Signed' },
  { value: 'no_nda', label: 'No NDA' },
] as const;

const DOC_FILTER_OPTIONS = [
  { value: 'has_pricing', label: 'Has Pricing' },
  { value: 'has_docs', label: 'Has Documents' },
  { value: 'no_docs', label: 'No Documents' },
] as const;

const WAREHOUSE_FILTER_OPTIONS = [
  { value: 'yes', label: 'Has Warehouse' },
  { value: 'no', label: 'No Warehouse' },
] as const;

const REGION_FILTER_OPTIONS = REGIONS.map((r) => ({ value: r.value, label: r.label }));

export function VendorDirectory() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const { toast } = useToast();

  const [vendors, setVendors] = useState<VendorLead[]>([]);
  const [documents, setDocuments] = useState<VendorDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [regionFilters, setRegionFilters] = useState<string[]>([]);
  const [countryFilters, setCountryFilters] = useState<string[]>([]);
  const [vendorTypeFilters, setVendorTypeFilters] = useState<string[]>([]);
  const [ndaFilters, setNdaFilters] = useState<string[]>([]);
  const [ownerFilters, setOwnerFilters] = useState<string[]>([]);
  const [warehouseFilters, setWarehouseFilters] = useState<string[]>([]);
  const [docFilters, setDocFilters] = useState<string[]>([]);
  const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});

  const [countries, setCountries] = useState<{ id: string; name: string; code: string; region: string | null }[]>([]);
  const [statuses, setStatuses] = useState<{ id: string; name: string; color: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; full_name: string | null }[]>([]);

  const [mapPosition, setMapPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });

  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([
        supabase.from('countries').select('id, name, code, region').order('name'),
        supabase.from('lead_statuses').select('id, name, color, sort_order').order('sort_order'),
      ]);
      if (cRes.data) setCountries(cRes.data);
      if (sRes.data) setStatuses(sRes.data);

      const { data: roles } = await supabase.from('user_roles').select('user_id');
      if (roles?.length) {
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', roles.map((r) => r.user_id));
        setOwners((profiles ?? []).map((p) => ({ id: p.user_id, full_name: p.full_name })));
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const wonStatusIds = statuses
      .filter((s) => STATUS_WON_NAMES.includes(s.name.toLowerCase()))
      .map((s) => s.id);

    let query = supabase
      .from('leads')
      .select(`
        id, company_name, contact_name, email, phone, website, lead_score,
        vendor_types, warehouse_available, additional_contacts, hq_country_id, country_ids, owner_id, created_at,
        status:lead_statuses(name, color)
      `)
      .order('company_name');

    if (wonStatusIds.length > 0) {
      query = query.in('status_id', wonStatusIds);
    }

    const { data: leads } = await query;

    const rawLeads = (leads ?? []) as unknown as VendorLead[];
    const ownerIds = [...new Set(rawLeads.map((l) => l.owner_id).filter(Boolean))] as string[];
    let ownerMap: Record<string, { full_name: string | null }> = {};
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', ownerIds);
      ownerMap = (profiles ?? []).reduce((acc, p) => { acc[p.user_id] = { full_name: p.full_name }; return acc; }, {} as Record<string, { full_name: string | null }>);
    }

    const hqIds = rawLeads.map((l) => l.hq_country_id).filter(Boolean) as string[];
    const allCountryIds = [...new Set([...hqIds, ...rawLeads.flatMap((l) => l.country_ids ?? [])])] as string[];
    let vendorCountryMap: Record<string, { name: string; code: string }> = {};
    if (allCountryIds.length > 0) {
      const { data: cRows } = await supabase.from('countries').select('id, name, code').in('id', allCountryIds);
      vendorCountryMap = (cRows ?? []).reduce((acc: Record<string, { name: string; code: string }>, c: { id: string; name: string; code: string }) => { acc[c.id] = { name: c.name, code: c.code }; return acc; }, {});
    }

    const enriched = rawLeads.map((l) => ({
      ...l,
      owner: l.owner_id ? ownerMap[l.owner_id] ?? null : null,
      hq_country: l.hq_country_id ? vendorCountryMap[l.hq_country_id] ?? null : null,
      countries: (l.country_ids ?? []).map((id: string) => vendorCountryMap[id]).filter(Boolean),
    }));

    const { data: docs } = await supabase
      .from('lead_documents')
      .select('id, lead_id, document_type, custom_name, file_path, file_name');

    setVendors(enriched);
    setDocuments((docs ?? []) as unknown as VendorDoc[]);
    setExpandedCountries({});
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

  const codeToRegion = useMemo(() => buildCodeToRegion(countries), [countries]);

  const countryFilterOpts = useMemo(
    () => ({ regionFilters, countryFilters, codeToRegion }),
    [regionFilters, countryFilters, codeToRegion],
  );

  const isCountryVisible = useCallback(
    (code: string) => isCountryVisibleInFilters(code, countryFilterOpts),
    [countryFilterOpts],
  );

  const countriesInSelectedRegions = useMemo(() => {
    if (regionFilters.length === 0) return countries;
    return countries.filter((c) => c.region != null && regionFilters.includes(c.region));
  }, [countries, regionFilters]);

  const regionOnlyFilterOpts = useMemo(
    () => ({ regionFilters, countryFilters: [] as string[], codeToRegion }),
    [regionFilters, codeToRegion],
  );

  const ownerFilterOptions = useMemo(
    () => [
      { value: '__unassigned__', label: 'Unassigned' },
      ...owners.map((o) => ({ value: o.id, label: o.full_name || 'Unnamed' })),
    ],
    [owners],
  );

  const vendorTypeFilterOptions = useMemo(
    () => allVendorTypes.map((t) => ({ value: t, label: formatVendorTypeLabel(t) })),
    [allVendorTypes],
  );

  const toggleCountryFilterCode = useCallback((code: string) => {
    setCountryFilters((prev) => {
      const exists = prev.some((f) => countryCodesMatch(f, code));
      return exists ? prev.filter((f) => !countryCodesMatch(f, code)) : [...prev, code];
    });
  }, []);

  const vendorPassesFilters = useCallback(
    (v: VendorLead, opts: { includeCountry: boolean }) => {
      if (search) {
        const q = search.toLowerCase();
        const textFields = [v.company_name, v.contact_name, v.email, v.owner?.full_name]
          .filter(Boolean)
          .some((f) => f!.toLowerCase().includes(q));
        const geoFields = mergeVendorCountries(v.countries, v.hq_country).some(
          (c) =>
            (c.name && c.name.toLowerCase().includes(q))
            || (c.code && c.code.toLowerCase().includes(q)),
        );
        if (!textFields && !geoFields) return false;
      }
      const operatingCodes = mergeVendorCountries(v.countries, v.hq_country).map((c) => c.code);
      if (regionFilters.length > 0 && !vendorMatchesRegionFilters(operatingCodes, regionFilters, codeToRegion)) {
        return false;
      }
      if (opts.includeCountry && countryFilters.length > 0 && !vendorMatchesCountryFilters(operatingCodes, countryFilters)) {
        return false;
      }
      if (!vendorMatchesOwnerFilters(v, ownerFilters)) return false;
      if (!vendorMatchesVendorTypeFilters(v, vendorTypeFilters)) return false;
      if (!vendorMatchesWarehouseFilters(v, warehouseFilters)) return false;
      if (!vendorMatchesNdaFilters(v.id, ndaFilters, docsByLead)) return false;
      if (!vendorMatchesDocFilters(v.id, docFilters, docsByLead)) return false;
      return true;
    },
    [
      search,
      regionFilters,
      countryFilters,
      ownerFilters,
      vendorTypeFilters,
      warehouseFilters,
      ndaFilters,
      docFilters,
      docsByLead,
      codeToRegion,
    ],
  );

  const filteredVendors = useMemo(
    () => vendors.filter((v) => vendorPassesFilters(v, { includeCountry: true })),
    [vendors, vendorPassesFilters],
  );

  const vendorsForCountryPicker = useMemo(
    () => vendors.filter((v) => vendorPassesFilters(v, { includeCountry: false })),
    [vendors, vendorPassesFilters],
  );

  const countryStats = useMemo((): CountryStats[] => {
    const map: Record<string, { name: string; count: number }> = {};
    filteredVendors.forEach((v) => {
      mergeVendorCountries(v.countries, v.hq_country).forEach((c) => {
        const code = c.code.toUpperCase();
        if (!code || !isCountryVisible(code)) return;
        if (!map[code]) map[code] = { name: c.name, count: 0 };
        map[code].count++;
      });
    });
    return Object.entries(map)
      .filter(([, d]) => d.count > 0)
      .map(([code, d]) => ({ code, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [filteredVendors, isCountryVisible]);

  const countryStatsForPicker = useMemo((): CountryStats[] => {
    const map: Record<string, { name: string; count: number }> = {};
    const isVisibleForPicker = (code: string) => isCountryVisibleInFilters(code, regionOnlyFilterOpts);
    vendorsForCountryPicker.forEach((v) => {
      mergeVendorCountries(v.countries, v.hq_country).forEach((c) => {
        const code = c.code.toUpperCase();
        if (!code || !isVisibleForPicker(code)) return;
        if (!map[code]) map[code] = { name: c.name, count: 0 };
        map[code].count++;
      });
    });
    return Object.entries(map)
      .filter(([, d]) => d.count > 0)
      .map(([code, d]) => ({ code, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [vendorsForCountryPicker, regionOnlyFilterOpts]);

  const countryFilterOptions = useMemo(
    () => countryStatsForPicker.map((c) => ({ value: c.code, label: `${c.name} (${c.count})` })),
    [countryStatsForPicker],
  );

  const countryStatsMap = useMemo(() => {
    const map: Record<string, number> = {};
    countryStats.forEach((c) => {
      map[c.code] = c.count;
      if (c.code === 'UK') map['GB'] = c.count;
      if (c.code === 'GB') map['UK'] = c.count;
    });
    return map;
  }, [countryStats]);

  const maxVendors = Math.max(...countryStats.map((c) => c.count), 1);

  const getCountryColor = useCallback((geo: any) => {
    const code = getCountryCodeFromGeo(geo);
    if (!code || !(code in countryStatsMap)) return 'var(--map-no-leads)';
    const count = countryStatsMap[code];
    if (!count || count === 0) return 'var(--map-no-leads)';
    const intensity = count / maxVendors;
    if (intensity > 0.75) return 'hsl(var(--primary))';
    if (intensity > 0.5) return 'hsl(var(--primary) / 0.8)';
    if (intensity > 0.25) return 'hsl(var(--primary) / 0.55)';
    return 'hsl(var(--primary) / 0.35)';
  }, [countryStatsMap, maxVendors]);

  const getTooltipContent = useCallback((geo: any) => {
    const code = getCountryCodeFromGeo(geo);
    const name = geo.properties?.name || geo.properties?.NAME || 'Unknown';
    if (!code || !(code in countryStatsMap)) return `${name}: No vendors`;
    const count = countryStatsMap[code];
    return count > 0 ? `${name}: ${count} vendor${count !== 1 ? 's' : ''}` : `${name}: No vendors`;
  }, [countryStatsMap]);

  const handleCountryClick = useCallback((geo: any) => {
    const code = getCountryCodeFromGeo(geo);
    if (code && code in countryStatsMap && countryStatsMap[code] > 0) {
      toggleCountryFilterCode(code);
    }
  }, [countryStatsMap, toggleCountryFilterCode]);

  const handleViewDoc = async (doc: VendorDoc) => {
    const { data, error } = await supabase.storage.from('lead-documents').createSignedUrl(doc.file_path, 120);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener');
  };

  const activeFilterCount = [
    search,
    regionFilters.length > 0,
    countryFilters.length > 0,
    vendorTypeFilters.length > 0,
    ndaFilters.length > 0,
    ownerFilters.length > 0,
    warehouseFilters.length > 0,
    docFilters.length > 0,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearch('');
    setRegionFilters([]);
    setCountryFilters([]);
    setVendorTypeFilters([]);
    setNdaFilters([]);
    setOwnerFilters([]);
    setWarehouseFilters([]);
    setDocFilters([]);
  };

  const withNda = filteredVendors.filter((v) => (docsByLead[v.id] ?? []).some((d) => d.document_type === 'nda'));
  const withPricing = filteredVendors.filter((v) => (docsByLead[v.id] ?? []).some((d) => d.document_type === 'pricing' || d.document_type === 'quotation'));
  const withWarehouse = filteredVendors.filter((v) => v.warehouse_available);

  const vendorsByCountry = useMemo(() => {
    const groups: { country: string; code: string; vendors: VendorLead[] }[] = [];
    const map: Record<string, VendorLead[]> = {};
    const nameMap: Record<string, string> = {};
    filteredVendors.forEach((v) => {
      const vendorCountries = mergeVendorCountries(v.countries, v.hq_country);
      const visible = vendorCountries.filter((c) => isCountryVisible(c.code));
      if (visible.length === 0) {
        if (regionFilters.length === 0 && countryFilters.length === 0) {
          const code = '__none__';
          if (!map[code]) { map[code] = []; nameMap[code] = 'Unknown'; }
          map[code].push(v);
        }
      } else {
        visible.forEach((c) => {
          const code = c.code.toUpperCase();
          if (!map[code]) { map[code] = []; nameMap[code] = c.name; }
          if (!map[code].find((x) => x.id === v.id)) map[code].push(v);
        });
      }
    });
    Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([code, vendors]) => groups.push({ country: nameMap[code], code, vendors }));
    return groups;
  }, [filteredVendors, isCountryVisible, regionFilters, countryFilters]);

  const toggleCountry = useCallback((code: string) => {
    setExpandedCountries((prev) => ({ ...prev, [code]: !prev[code] }));
  }, []);

  const expandAll = useCallback(() => {
    const all: Record<string, boolean> = {};
    vendorsByCountry.forEach((g) => { all[g.code] = true; });
    setExpandedCountries(all);
  }, [vendorsByCountry]);

  const collapseAll = useCallback(() => setExpandedCountries({}), []);

  return (
    <div className="space-y-6">
      {/* KPI Widgets */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{filteredVendors.length}</p>
              <p className="text-xs text-muted-foreground">Closed / Won Vendors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{withWarehouse.length}</p>
              <p className="text-xs text-muted-foreground">Warehouse Available</p>
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
              <CardDescription className="mt-1">Click countries on the map to add or remove them from the filter</CardDescription>
            </div>
            {countryFilters.length > 0 && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setCountryFilters([])}>
                <MapPin className="h-3.5 w-3.5" />
                {countryFilters.length === 1
                  ? (countries.find((c) => countryCodesMatch(c.code, countryFilters[0]))?.name
                    ?? countriesInSelectedRegions.find((c) => countryCodesMatch(c.code, countryFilters[0]))?.name
                    ?? countryFilters[0])
                  : `${countryFilters.length} countries`}
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
                      const isSelected = isCountrySelectedInFilters(code, countryFilters);
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

          <div className="flex flex-wrap gap-2 mt-4">
            {countryStats.slice(0, 20).map((c) => (
              <button
                key={c.code}
                onClick={() => toggleCountryFilterCode(c.code)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all',
                  isCountrySelectedInFilters(c.code, countryFilters)
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
              <Input placeholder="Search company, contact, email, or country…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
            </div>
            <FilterMultiSelect
              emptyLabel="All Regions"
              selected={regionFilters}
              options={REGION_FILTER_OPTIONS}
              onToggle={(v) => {
                setRegionFilters((prev) => toggleInList(prev, v));
                setCountryFilters([]);
              }}
              onClear={() => { setRegionFilters([]); setCountryFilters([]); }}
              clearLabel="Clear regions"
              className="min-w-[140px]"
            />
            <FilterMultiSelect
              emptyLabel="All Countries"
              selected={countryFilters}
              options={countryFilterOptions}
              onToggle={toggleCountryFilterCode}
              onClear={() => setCountryFilters([])}
              clearLabel="Clear countries"
              className="min-w-[160px]"
              contentClassName="w-[260px]"
              maxListHeight="max-h-[320px]"
            />
            <FilterMultiSelect
              emptyLabel="All Owners"
              selected={ownerFilters}
              options={ownerFilterOptions}
              onToggle={(v) => setOwnerFilters((prev) => toggleInList(prev, v))}
              onClear={() => setOwnerFilters([])}
              clearLabel="Clear owners"
              className="min-w-[140px]"
              maxListHeight="max-h-[320px]"
            />
            {allVendorTypes.length > 0 && (
              <FilterMultiSelect
                emptyLabel="All Types"
                selected={vendorTypeFilters}
                options={vendorTypeFilterOptions}
                onToggle={(v) => setVendorTypeFilters((prev) => toggleInList(prev, v))}
                onClear={() => setVendorTypeFilters([])}
                clearLabel="Clear types"
                className="min-w-[130px]"
              />
            )}
            <FilterMultiSelect
              emptyLabel="All NDA"
              selected={ndaFilters}
              options={[...NDA_FILTER_OPTIONS]}
              onToggle={(v) => setNdaFilters((prev) => toggleInList(prev, v))}
              onClear={() => setNdaFilters([])}
              clearLabel="Clear NDA"
              className="min-w-[120px]"
            />
            <FilterMultiSelect
              emptyLabel="All Documents"
              selected={docFilters}
              options={[...DOC_FILTER_OPTIONS]}
              onToggle={(v) => setDocFilters((prev) => toggleInList(prev, v))}
              onClear={() => setDocFilters([])}
              clearLabel="Clear documents"
              className="min-w-[150px]"
            />
            <FilterMultiSelect
              emptyLabel="All Warehouse"
              selected={warehouseFilters}
              options={[...WAREHOUSE_FILTER_OPTIONS]}
              onToggle={(v) => setWarehouseFilters((prev) => toggleInList(prev, v))}
              onClear={() => setWarehouseFilters([])}
              clearLabel="Clear warehouse"
              className="min-w-[150px]"
            />
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vendor Table grouped by country */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
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
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">{vendorsByCountry.length} countr{vendorsByCountry.length !== 1 ? 'ies' : 'y'}</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs h-7">Expand All</Button>
              <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs h-7">Collapse All</Button>
            </div>
          </div>

          {vendorsByCountry.map((group) => {
            const isExpanded = expandedCountries[group.code] ?? false;
            return (
            <Card key={group.code} className="overflow-hidden">
              <button
                onClick={() => toggleCountry(group.code)}
                className="flex items-center justify-between gap-3 bg-muted/40 px-5 py-3 border-b w-full text-left hover:bg-muted/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">{group.country}</h3>
                  <Badge variant="secondary" className="text-xs">{group.vendors.length} vendor{group.vendors.length !== 1 ? 's' : ''}</Badge>
                  {group.vendors.some((v) => v.hq_country?.code?.toUpperCase() === group.code) && (
                    <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">
                      HQ of {group.vendors.filter((v) => v.hq_country?.code?.toUpperCase() === group.code).length}
                    </span>
                  )}
                </div>
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', isExpanded && 'rotate-180')} />
              </button>

              {isExpanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-2.5 text-left">Company</th>
                      <th className="px-4 py-2.5 text-left">Contact</th>
                      <th className="px-4 py-2.5 text-left">Type</th>
                      <th className="px-4 py-2.5 text-left">Owner</th>
                      <th className="px-4 py-2.5 text-center">Score</th>
                      <th className="px-4 py-2.5 text-left">Documents</th>
                      <th className="px-4 py-2.5 text-center w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {group.vendors.map((v) => {
                      const docs = docsByLead[v.id] ?? [];
                      const ndaDocs = docs.filter((d) => d.document_type === 'nda');
                      const pricingDocs = docs.filter((d) => d.document_type === 'pricing' || d.document_type === 'quotation');
                      const otherDocs = docs.filter((d) => d.document_type !== 'nda' && d.document_type !== 'pricing' && d.document_type !== 'quotation');
                      const isHq = v.hq_country?.code?.toUpperCase() === group.code;

                      return (
                        <tr key={v.id} className="group/row hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 max-w-[220px]">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <button onClick={() => navigate(`/leads/${v.id}`)} className="text-left font-semibold text-foreground hover:text-primary transition-colors truncate">
                                {v.company_name}
                              </button>
                              {isHq && (
                                <span className="shrink-0 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-primary/15 text-primary border border-primary/25">HQ</span>
                              )}
                            </div>
                            {v.website && (
                              <a href={v.website.startsWith('http') ? v.website : `https://${v.website}`} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-primary/70 hover:text-primary hover:underline truncate flex items-center gap-1 mt-0.5" onClick={(e) => e.stopPropagation()}>
                                <Globe2 className="h-3 w-3 shrink-0" />{v.website.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-[220px]">
                            {v.contact_name && <p className="text-foreground text-xs font-medium truncate">{v.contact_name}</p>}
                            {v.email && <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5"><Mail className="h-3 w-3 shrink-0" />{v.email}</p>}
                            {v.phone && <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3 shrink-0" />{v.phone}</p>}
                            {Array.isArray(v.additional_contacts) && v.additional_contacts.length > 0 && (
                              <p className="text-[10px] text-primary/70 mt-1 font-medium">+{v.additional_contacts.length} more contact{v.additional_contacts.length !== 1 ? 's' : ''}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-[180px]">
                            <div className="flex flex-wrap gap-1">
                              {(v.vendor_types ?? []).map((t) => (
                                <span key={t} className="inline-flex items-center rounded-md bg-primary/8 border border-primary/20 px-2 py-0.5 text-[11px] font-semibold text-primary whitespace-nowrap">{formatVendorTypeLabel(t)}</span>
                              ))}
                              {(!v.vendor_types || v.vendor_types.length === 0) && <span className="text-xs text-muted-foreground/40">—</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {v.owner?.full_name ? <span className="text-xs font-medium text-foreground">{v.owner.full_name}</span> : <span className="text-xs text-muted-foreground/40">Unassigned</span>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {v.lead_score != null && v.lead_score > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-600 dark:text-amber-400"><Star className="h-3 w-3 fill-current" />{v.lead_score}</span>
                            ) : <span className="text-xs text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-4 py-3 max-w-[280px]">
                            {docs.length === 0 ? (
                              <span className="text-xs text-muted-foreground/40 italic">None</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {ndaDocs.map((d) => (
                                  <button key={d.id} onClick={() => handleViewDoc(d)} className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20 transition-all">
                                    <ShieldCheck className="h-3 w-3" />{d.custom_name || 'NDA'}<ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                  </button>
                                ))}
                                {pricingDocs.map((d) => (
                                  <button key={d.id} onClick={() => handleViewDoc(d)} className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all">
                                    <DollarSign className="h-3 w-3" />{d.custom_name || 'Pricing'}<ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                  </button>
                                ))}
                                {otherDocs.map((d) => (
                                  <button key={d.id} onClick={() => handleViewDoc(d)} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-all">
                                    <FileText className="h-3 w-3" />{d.custom_name || d.file_name}<ExternalLink className="h-2.5 w-2.5 opacity-50" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover/row:opacity-100 transition-opacity" onClick={() => navigate(`/leads/${v.id}`)}>
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
