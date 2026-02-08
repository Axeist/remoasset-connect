import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe2, TrendingUp } from 'lucide-react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { useState } from 'react';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// World-atlas TopoJSON uses numeric ISO 3166-1 id (e.g. "826", "356"); our DB uses 2-letter codes.
// Map: numeric id (string) -> alpha-2 code used in our countries table.
const MAP_ID_TO_ALPHA2: Record<string, string> = {
  '4': 'AF', '8': 'AL', '12': 'DZ', '20': 'AD', '24': 'AO', '32': 'AR', '36': 'AU', '40': 'AT', '44': 'BS', '48': 'BH', '50': 'BD', '52': 'BB', '64': 'BT', '68': 'BO', '70': 'BA', '72': 'BW', '76': 'BR', '96': 'BN', '100': 'BG', '104': 'MM', '108': 'BI', '116': 'KH', '120': 'CM', '124': 'CA', '140': 'CF', '144': 'LK', '148': 'TD', '152': 'CL', '156': 'CN', '158': 'TW', '170': 'CO', '178': 'CG', '180': 'CD', '188': 'CR', '191': 'HR', '192': 'CU', '196': 'CY', '204': 'BJ', '208': 'DK', '212': 'DM', '214': 'DO', '218': 'EC', '222': 'SV', '226': 'GQ', '231': 'ET', '232': 'ER', '233': 'EE', '234': 'FO', '242': 'FJ', '246': 'FI', '250': 'FR', '268': 'GE', '266': 'GA', '270': 'GM', '275': 'PS', '276': 'DE', '288': 'GH', '296': 'KI', '300': 'GR', '304': 'GL', '308': 'GD', '316': 'GU', '320': 'GT', '324': 'GN', '328': 'GY', '332': 'HT', '336': 'VA', '340': 'HN', '348': 'HU', '352': 'IS', '356': 'IN', '360': 'ID', '368': 'IQ', '372': 'IE', '376': 'IL', '380': 'IT', '384': 'CI', '388': 'JM', '392': 'JP', '398': 'KZ', '400': 'JO', '404': 'KE', '408': 'KP', '410': 'KR', '414': 'KW', '417': 'KG', '418': 'LA', '422': 'LB', '426': 'LS', '428': 'LV', '430': 'LR', '434': 'LY', '440': 'LT', '442': 'LU', '450': 'MG', '454': 'MW', '458': 'MY', '462': 'MV', '466': 'ML', '470': 'MT', '478': 'MR', '480': 'MU', '484': 'MX', '492': 'MC', '496': 'MN', '498': 'MD', '504': 'MA', '508': 'MZ', '512': 'OM', '516': 'NA', '520': 'NR', '524': 'NP', '528': 'NL', '548': 'VU', '554': 'NZ', '558': 'NI', '562': 'NE', '566': 'NG', '578': 'NO', '583': 'FM', '584': 'MH', '585': 'PW', '586': 'PK', '591': 'PA', '598': 'PG', '600': 'PY', '604': 'PE', '608': 'PH', '616': 'PL', '620': 'PT', '624': 'GW', '626': 'TL', '634': 'QA', '642': 'RO', '643': 'RU', '646': 'RW', '682': 'SA', '686': 'SN', '688': 'RS', '690': 'SC', '694': 'SL', '702': 'SG', '703': 'SK', '704': 'VN', '705': 'SI', '706': 'SO', '710': 'ZA', '716': 'ZW', '724': 'ES', '728': 'SS', '729': 'SD', '748': 'SZ', '752': 'SE', '756': 'CH', '760': 'SY', '764': 'TH', '768': 'TG', '776': 'TO', '780': 'TT', '784': 'AE', '788': 'TN', '792': 'TR', '795': 'TM', '798': 'TV', '800': 'UG', '804': 'UA', '807': 'MK', '818': 'EG', '826': 'GB', '834': 'TZ', '840': 'US', '854': 'BF', '858': 'UY', '860': 'UZ', '862': 'VE', '882': 'WS', '887': 'YE', '894': 'ZM',
};
// DB uses "UK" for United Kingdom; map both GB and UK for 826
MAP_ID_TO_ALPHA2['826'] = 'UK';

interface CountryData {
  countryCode: string;
  countryName: string;
  totalLeads: number;
  statusBreakdown: { statusName: string; count: number; color: string }[];
}

interface WorldDemographicsProps {
  data: CountryData[];
  loading?: boolean;
}

/** Resolve map geography id (numeric string, e.g. "826" or "036") to our DB country code (alpha-2). */
function getCountryCodeFromGeo(geo: any): string {
  const rawId = geo.id != null ? String(geo.id).trim() : '';
  const id = rawId.replace(/^0+/, '') || rawId; // "036" -> "36"
  const alpha2 = MAP_ID_TO_ALPHA2[id] || MAP_ID_TO_ALPHA2[rawId] || geo.properties?.ISO_A2;
  return alpha2 ? alpha2.toUpperCase() : '';
}

export function WorldDemographics({ data, loading }: WorldDemographicsProps) {
  const [tooltipContent, setTooltipContent] = useState('');

  // Create a map of country codes to data (our DB uses 2-letter codes, e.g. UK, IN, SG, AE)
  const countryMap = data.reduce((acc, country) => {
    const code = country.countryCode.toUpperCase();
    acc[code] = country;
    return acc;
  }, {} as Record<string, CountryData>);

  const maxLeads = Math.max(...data.map(c => c.totalLeads), 1);

  // Get color intensity based on lead count
  const getCountryColor = (geo: any) => {
    const countryCode = getCountryCodeFromGeo(geo);
    const countryData = countryCode ? countryMap[countryCode] : null;
    
    if (!countryData || countryData.totalLeads === 0) {
      return '#f5f5f5';
    }

    const intensity = countryData.totalLeads / maxLeads;
    
    // Use a gradient from light to dark primary color
    if (intensity > 0.75) return 'hsl(var(--primary))';
    if (intensity > 0.5) return 'hsl(var(--primary) / 0.7)';
    if (intensity > 0.25) return 'hsl(var(--primary) / 0.4)';
    return 'hsl(var(--primary) / 0.2)';
  };

  const getTooltipContent = (geo: any) => {
    const countryCode = getCountryCodeFromGeo(geo);
    const countryData = countryCode ? countryMap[countryCode] : null;
    const countryName = geo.properties?.name || geo.properties?.NAME || 'Unknown';

    if (!countryData || countryData.totalLeads === 0) {
      return `${countryName}: No leads`;
    }

    const statusInfo = countryData.statusBreakdown
      .map(s => `${s.statusName}: ${s.count}`)
      .join(', ');

    return `${countryName}: ${countryData.totalLeads} leads\n${statusInfo}`;
  };

  if (loading) {
    return (
      <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display">
            <Globe2 className="h-5 w-5" />
            World Demographics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center bg-muted/30 rounded-lg animate-pulse">
            <Globe2 className="h-12 w-12 text-muted-foreground/30" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const topCountries = [...data]
    .sort((a, b) => b.totalLeads - a.totalLeads)
    .slice(0, 5);

  return (
    <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 font-display">
              <Globe2 className="h-5 w-5" />
              World Demographics
            </CardTitle>
            <CardDescription>Lead distribution by country and status</CardDescription>
          </div>
          <Badge variant="secondary" className="gap-1 w-fit">
            <TrendingUp className="h-3 w-3" />
            {data.reduce((sum, c) => sum + c.totalLeads, 0)} Total Leads
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* World Map */}
        <div className="relative w-full h-[400px] bg-muted/10 rounded-lg overflow-hidden border border-border/50">
          <ComposableMap
            projectionConfig={{
              scale: 147,
            }}
            className="w-full h-full"
          >
            <ZoomableGroup center={[0, 20]} zoom={1}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const isoCode = geo.properties.ISO_A3 || geo.id;
                    const countryData = countryMap[isoCode];
                    
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getCountryColor(geo)}
                        stroke="#ffffff"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: 'none' },
                          hover: {
                            fill: countryData && countryData.totalLeads > 0 
                              ? 'hsl(var(--accent))' 
                              : '#e5e5e5',
                            outline: 'none',
                            cursor: countryData && countryData.totalLeads > 0 ? 'pointer' : 'default',
                          },
                          pressed: { outline: 'none' },
                        }}
                        onMouseEnter={() => {
                          setTooltipContent(getTooltipContent(geo));
                        }}
                        onMouseLeave={() => {
                          setTooltipContent('');
                        }}
                        data-tooltip-id="world-map-tooltip"
                        data-tooltip-content={getTooltipContent(geo)}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
          <Tooltip
            id="world-map-tooltip"
            place="top"
            className="!bg-popover !text-popover-foreground !border !border-border !rounded-lg !px-3 !py-2 !text-sm !opacity-100 !shadow-lg"
            style={{
              whiteSpace: 'pre-line',
              zIndex: 1000,
            }}
          />
        </div>

        {/* Top Countries List */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Top Countries</h4>
          <div className="space-y-2">
            {topCountries.map((country, idx) => (
              <div
                key={country.countryCode}
                className="flex items-center justify-between p-3 rounded-lg bg-accent/10 border border-border/50 hover:bg-accent/20 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{country.countryName}</p>
                    <div className="flex items-center gap-2 mt-1 overflow-x-auto scrollbar-thin">
                      {country.statusBreakdown.map((status) => (
                        <Badge
                          key={status.statusName}
                          style={{ backgroundColor: status.color }}
                          className="text-white border-0 text-xs shrink-0"
                        >
                          {status.statusName}: {status.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 ml-3">
                  {country.totalLeads} leads
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--primary) / 0.2)' }} />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--primary) / 0.5)' }} />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: 'hsl(var(--primary))' }} />
            <span>High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
