import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe2, TrendingUp } from 'lucide-react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { useState } from 'react';

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

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

export function WorldDemographics({ data, loading }: WorldDemographicsProps) {
  const [tooltipContent, setTooltipContent] = useState('');

  // Create a map of country codes to data
  const countryMap = data.reduce((acc, country) => {
    acc[country.countryCode.toUpperCase()] = country;
    return acc;
  }, {} as Record<string, CountryData>);

  const maxLeads = Math.max(...data.map(c => c.totalLeads), 1);

  // Get color intensity based on lead count
  const getCountryColor = (geo: any) => {
    const isoCode = geo.properties.ISO_A3 || geo.id;
    const countryData = countryMap[isoCode];
    
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
    const isoCode = geo.properties.ISO_A3 || geo.id;
    const countryData = countryMap[isoCode];
    const countryName = geo.properties.NAME || 'Unknown';

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
