import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  DEVICE_CATEGORIES,
  DEVICE_CATEGORY_CONFIG,
  DEVICE_FIELD_LABELS,
  type DeviceCategory,
  type DeviceSpecFieldKey,
} from '@/constants/device-categories';
import {
  LOOKUP_MARKETS,
  PRICE_TYPE_LABEL,
  formatPriceRange,
  formatPublicPrice,
  formatTokenCount,
  formatUsdCost,
  invokeMrpLookup,
  type MrpLookupResponse,
  type PublicPriceType,
} from '@/lib/mrp-lookup';
import { cn } from '@/lib/utils';
import {
  ArrowRight, Copy, Cpu, DollarSign, ExternalLink, Globe2, Loader2,
  Search, Sparkles, Tag, Zap,
} from 'lucide-react';

const PRICE_BADGE: Record<PublicPriceType, string> = {
  mrp: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
  msrp: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
  list: 'bg-sky-500/15 text-sky-700 border-sky-500/25 dark:text-sky-300',
  street: 'bg-amber-500/15 text-amber-800 border-amber-500/25 dark:text-amber-300',
  unknown: 'bg-muted text-muted-foreground border-border',
};

const SEARCH_STEPS = [
  'Searching Google Shopping…',
  'Checking public list / MRP pages…',
  'Matching specs with AI…',
];

export default function MrpLookup() {
  const { toast } = useToast();
  const [category, setCategory] = useState<DeviceCategory>('laptop');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [countryName, setCountryName] = useState('India');
  const [countryCode, setCountryCode] = useState('in');
  const [specs, setSpecs] = useState<Partial<Record<DeviceSpecFieldKey, string>>>({});
  const [markets, setMarkets] = useState(LOOKUP_MARKETS);
  const [loading, setLoading] = useState(false);
  const [searchStep, setSearchStep] = useState(0);
  const [result, setResult] = useState<MrpLookupResponse | null>(null);

  const categoryCfg = DEVICE_CATEGORY_CONFIG[category];

  useEffect(() => {
    supabase.from('countries').select('name, code').order('name').then(({ data }) => {
      if (!data?.length) return;
      const fromDb = data
        .filter((c) => c.name && c.code && String(c.code).length === 2)
        .map((c) => {
          const code = String(c.code).toLowerCase();
          const known = LOOKUP_MARKETS.find((m) => m.code === code);
          return { name: c.name, code, currency: known?.currency || 'USD' };
        });
      if (fromDb.length) {
        const extras = LOOKUP_MARKETS.filter((m) => !fromDb.some((d) => d.code === m.code));
        setMarkets([...fromDb, ...extras].sort((a, b) => a.name.localeCompare(b.name)));
      }
    });
  }, []);

  useEffect(() => {
    if (!loading) return;
    setSearchStep(0);
    const t1 = window.setTimeout(() => setSearchStep(1), 900);
    const t2 = window.setTimeout(() => setSearchStep(2), 1800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [loading]);

  const handleCategoryChange = (next: DeviceCategory) => {
    setCategory(next);
    setSpecs({});
    setResult(null);
  };

  const handleCountryChange = (code: string) => {
    const market = markets.find((m) => m.code === code);
    setCountryCode(code);
    setCountryName(market?.name || code);
  };

  const handleSearch = async () => {
    if (!brand.trim() || !model.trim()) {
      toast({ title: 'Brand and model are required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const filledSpecs = Object.fromEntries(
        Object.entries(specs).filter(([, v]) => v?.trim()),
      ) as Partial<Record<DeviceSpecFieldKey, string>>;
      const data = await invokeMrpLookup({
        category,
        brand: brand.trim(),
        model: model.trim(),
        country: countryName,
        country_code: countryCode,
        specs: filledSpecs,
      });
      setResult(data);
      if (!data.results?.length) {
        toast({
          title: 'No matching public prices',
          description: 'Try a more specific model name or add RAM / storage / chipset.',
        });
      }
    } catch (err) {
      toast({
        title: 'Lookup failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const rangeText = useMemo(() => {
    if (!result) return '';
    return formatPriceRange(
      result.summary.range_from,
      result.summary.range_to,
      result.summary.currency,
      countryCode,
    );
  }, [result, countryCode]);

  const usage = result?.token_usage;
  const totalTokens = (usage?.input_tokens || 0) + (usage?.output_tokens || 0);

  const copyRange = async () => {
    if (!rangeText) return;
    const label = `${brand} ${model} public price range (${countryName}): ${rangeText}`;
    try {
      await navigator.clipboard.writeText(label);
      toast({ title: 'Copied price range' });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm px-6 py-6 animate-fade-in-up">
          <div className="absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(var(--primary)/0.14),transparent)] pointer-events-none" />
          <div className="absolute -top-16 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl animate-float pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/25">
              <Tag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold tracking-tight">Public price lookup</h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">
                Search live listings by brand, model, and specs. We return a
                <strong className="text-foreground font-medium"> from–to public range</strong> with
                site links so your quoted margin stays at or below what customers already see.
              </p>
            </div>
          </div>
        </div>

        <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-1">
          <CardContent className="p-6">
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Device category</Label>
                  <Select value={category} onValueChange={(v) => handleCategoryChange(v as DeviceCategory)}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DEVICE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Country</Label>
                  <Select value={countryCode} onValueChange={handleCountryChange}>
                    <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {markets.map((m) => (
                        <SelectItem key={`${m.code}-${m.name}`} value={m.code}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Brand <span className="text-destructive">*</span></Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder={categoryCfg.brandPlaceholder}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{categoryCfg.modelLabel} <span className="text-destructive">*</span></Label>
                  <Input
                    className="h-10 rounded-xl"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder={categoryCfg.modelPlaceholder}
                  />
                </div>
              </div>

              {categoryCfg.fields.length > 0 && (
                <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Specs · {categoryCfg.specSubtitle}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {categoryCfg.fields.map((key) => {
                      const meta = DEVICE_FIELD_LABELS[key];
                      return (
                        <div key={key} className="space-y-1.5">
                          <Label>{meta.label}</Label>
                          <Input
                            className="h-10 rounded-xl"
                            value={specs[key] || ''}
                            onChange={(e) => setSpecs((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder={meta.placeholder}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="rounded-xl h-11 px-5 gradient-primary border-0 shadow-md shadow-primary/25 hover:scale-[1.02] transition-transform"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {loading ? 'Searching the web…' : 'Find public prices'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {loading && (
          <Card className="rounded-xl border-border/80 overflow-hidden animate-fade-in-up">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Search className="h-5 w-5 text-primary animate-pulse" />
                </div>
                <div>
                  <p className="font-display font-semibold">Scanning public listings</p>
                  <p className="text-sm text-muted-foreground">{SEARCH_STEPS[searchStep]}</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {SEARCH_STEPS.map((step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className={cn(
                      'h-2 flex-1 rounded-full overflow-hidden bg-muted',
                    )}>
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          i < searchStep ? 'w-full bg-primary' : i === searchStep ? 'w-2/3 bg-primary/80 animate-pulse' : 'w-0 bg-primary',
                        )}
                      />
                    </div>
                    <span className={cn(
                      'text-xs w-28 text-right',
                      i <= searchStep ? 'text-foreground font-medium' : 'text-muted-foreground',
                    )}>
                      {i < searchStep ? 'Done' : i === searchStep ? 'Live' : 'Queued'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {result && !loading && (
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl p-6 text-white card-shadow-lg gradient-primary animate-fade-in-up">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 animate-float pointer-events-none" />
              <div className="relative z-10">
                <p className="text-xs uppercase tracking-wider text-white/80 font-semibold">Suggested public range</p>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mt-2">
                  <p className="text-3xl sm:text-4xl font-display font-bold tracking-tight tabular-nums">
                    {rangeText}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/20">
                      {result.summary.listing_count} listing{result.summary.listing_count === 1 ? '' : 's'}
                    </span>
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/20">
                      Confidence {result.summary.confidence}/10
                    </span>
                    {result.summary.range_from != null && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-lg h-8 bg-white/20 hover:bg-white/30 text-white border-0"
                        onClick={copyRange}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-white/80 mt-3 max-w-2xl">
                  Keep the client quote at or below the top of this band. Open a site to confirm the exact configuration.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  icon: DollarSign,
                  label: 'This search cost',
                  value: formatUsdCost(usage?.total_cost_usd ?? 0),
                  hint: usage ? `${formatUsdCost(usage.input_cost_usd ?? 0)} in · ${formatUsdCost(usage.output_cost_usd ?? 0)} out` : 'Claude API spend',
                  delay: 'animate-fade-in-up-delay-1',
                },
                {
                  icon: Zap,
                  label: 'Tokens used',
                  value: formatTokenCount(totalTokens),
                  hint: `${formatTokenCount(usage?.input_tokens ?? 0)} in · ${formatTokenCount(usage?.output_tokens ?? 0)} out`,
                  delay: 'animate-fade-in-up-delay-2',
                },
                {
                  icon: Cpu,
                  label: 'Model',
                  value: usage?.model ? usage.model.replace(/^claude-/, '').split('-20')[0] : '—',
                  hint: usage?.model || 'No AI pass this search',
                  delay: 'animate-fade-in-up-delay-3',
                },
                {
                  icon: Globe2,
                  label: 'Queries',
                  value: String(result.search_queries_used?.length || 0),
                  hint: 'Shopping + web search',
                  delay: 'animate-fade-in-up-delay-4',
                },
              ].map((stat) => (
                <Card
                  key={stat.label}
                  className={cn(
                    'rounded-xl border-border/80 card-shadow animate-inner-card-hover animate-fade-in-up opacity-0',
                    stat.delay,
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <stat.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                    </div>
                    <p className="text-xl font-display font-bold tabular-nums truncate" title={stat.value}>{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 truncate" title={stat.hint}>{stat.hint}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {result.results.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center animate-fade-in-up">
                No matching listings. Add more specs or try another country.
              </p>
            ) : (
              <div className="rounded-xl border border-border/80 bg-card overflow-hidden card-shadow">
                {result.results.map((hit, idx) => (
                  <div
                    key={`${hit.url}-${idx}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 border-b last:border-b-0 border-border/60 hover:bg-primary/[0.04] transition-colors animate-fade-in-up opacity-0"
                    style={{ animationDelay: `${0.08 + idx * 0.05}s`, animationFillMode: 'forwards' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">{hit.retailer}</p>
                        <Badge variant="outline" className={cn('rounded-md text-[10px] uppercase', PRICE_BADGE[hit.price_type])}>
                          {PRICE_TYPE_LABEL[hit.price_type]}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate mt-0.5">{hit.title}</p>
                      {hit.notes && <p className="text-xs text-muted-foreground mt-1">{hit.notes}</p>}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <p className="text-base font-display font-bold tabular-nums">
                        {formatPublicPrice(hit.price, hit.currency, countryCode)}
                      </p>
                      <Button asChild variant="outline" size="sm" className="rounded-lg h-8 group">
                        <a href={hit.url} target="_blank" rel="noopener noreferrer">
                          Open site
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
                          <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
