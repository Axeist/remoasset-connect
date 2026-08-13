import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SpecCombobox } from '@/components/shared/SpecCombobox';
import { LookupHistoryPanel } from '@/components/mrp/LookupHistoryPanel';
import { PriceResultGroups } from '@/components/mrp/PriceResultGroups';
import {
  DEVICE_CATEGORIES,
  DEVICE_CATEGORY_CONFIG,
  DEVICE_FIELD_LABELS,
  type DeviceCategory,
  type DeviceSpecFieldKey,
} from '@/constants/device-categories';
import {
  LOOKUP_BRANDS,
  modelsForBrand,
  presetFor,
  sanitizeSpec,
  specOptions,
} from '@/lib/lookup-catalog';
import { parseDeviceLine, parsedSummary } from '@/lib/parse-device-line';
import {
  LOOKUP_MARKETS,
  formatPriceRange,
  formatTokenCount,
  formatUsdCost,
  invokeMrpLookup,
  clearLookupHistory,
  deleteLookupHistory,
  loadLookupHistory,
  saveLookupHistory,
  splitPublicPriceHits,
  type MrpLookupHistoryRow,
  type MrpLookupRequest,
  type MrpLookupResponse,
} from '@/lib/mrp-lookup';
import { Copy, Cpu, DollarSign, Globe2, Loader2, Search, Sparkles, Tag, Zap } from 'lucide-react';

const SEARCH_STEPS = [
  'Searching Google Shopping…',
  'Checking public list / MRP pages…',
  'Matching specs with AI…',
];

export default function MrpLookup() {
  const { toast } = useToast();
  const { user } = useAuth();
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
  const [history, setHistory] = useState<MrpLookupHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [entryMode, setEntryMode] = useState<'paste' | 'manual'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [parsePreview, setParsePreview] = useState('');

  const categoryCfg = DEVICE_CATEGORY_CONFIG[category];
  const modelOptions = modelsForBrand(brand);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await loadLookupHistory());
    } catch {
      /* table may not exist yet */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

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

  const applyQuery = (q: MrpLookupRequest) => {
    setCategory(q.category);
    setBrand(q.brand);
    setModel(q.model);
    setCountryName(q.country);
    setCountryCode(q.country_code);
    setSpecs(q.specs || {});
  };

  const applyParsedLine = (raw: string) => {
    const parsed = parseDeviceLine(raw);
    if (!parsed) return null;
    setCategory(parsed.category);
    setBrand(parsed.brand);
    setModel(parsed.model);
    setSpecs(parsed.specs);
    setParsePreview(parsedSummary(parsed));
    return parsed;
  };

  const handleCategoryChange = (next: DeviceCategory) => {
    setCategory(next);
    setSpecs({});
    setResult(null);
  };

  const handleBrandChange = (next: string) => {
    setBrand(next);
    setModel('');
    setSpecs({});
    setResult(null);
  };

  const handleModelChange = (next: string) => {
    setModel(next);
    if (brand && next) {
      const preset = presetFor(brand, next);
      const nextSpecs: Partial<Record<DeviceSpecFieldKey, string>> = {};
      for (const key of categoryCfg.fields) {
        const raw = preset[key] || '';
        nextSpecs[key] = sanitizeSpec(key, raw, brand);
      }
      setSpecs(nextSpecs);
    }
  };

  const handleSpecChange = (key: DeviceSpecFieldKey, value: string) => {
    setSpecs((prev) => ({ ...prev, [key]: sanitizeSpec(key, value, brand) }));
  };

  const handleCountryChange = (code: string) => {
    const market = markets.find((m) => m.code === code);
    setCountryCode(code);
    setCountryName(market?.name || code);
  };

  const buildRequest = (): MrpLookupRequest => ({
    category,
    brand: brand.trim(),
    model: model.trim(),
    country: countryName,
    country_code: countryCode,
    specs: Object.fromEntries(
      Object.entries(specs).filter(([, v]) => v?.trim()),
    ) as Partial<Record<DeviceSpecFieldKey, string>>,
  });

  const runLookup = async (req: MrpLookupRequest) => {
    if (!req.brand || !req.model) {
      toast({ title: 'Brand and model are required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const data = await invokeMrpLookup(req);
      setResult(data);
      if (user?.id) {
        try {
          await saveLookupHistory(user.id, req, data);
          await refreshHistory();
        } catch { /* history is optional */ }
      }
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

  const handleSearch = () => runLookup(buildRequest());

  const handlePasteSearch = () => {
    const parsed = applyParsedLine(pasteText);
    if (!parsed) {
      toast({
        title: 'Could not read that line',
        description: 'Include a brand and model, e.g. Lenovo ThinkPad E16 — 16" · 16GB · 256GB',
        variant: 'destructive',
      });
      return;
    }
    runLookup({
      category: parsed.category,
      brand: parsed.brand,
      model: parsed.model,
      country: countryName,
      country_code: countryCode,
      specs: parsed.specs,
    });
  };

  const restoreHistory = (row: MrpLookupHistoryRow) => {
    applyQuery(row.query);
    setResult({
      summary: row.summary,
      results: row.results || [],
      search_queries_used: [],
      token_usage: row.token_usage || undefined,
    });
  };

  const rerunHistory = (row: MrpLookupHistoryRow) => {
    applyQuery(row.query);
    runLookup(row.query);
  };

  const deleteHistory = async (row: MrpLookupHistoryRow) => {
    try {
      await deleteLookupHistory(row.id);
      setHistory((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      toast({
        title: 'Could not delete search',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    }
  };

  const clearHistory = async () => {
    if (!user?.id || !history.length) return;
    if (!window.confirm(`Delete all ${history.length} recent searches?`)) return;
    try {
      await clearLookupHistory(user.id);
      setHistory([]);
    } catch (err) {
      toast({
        title: 'Could not clear history',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
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

  const split = useMemo(
    () => (result ? splitPublicPriceHits(result.results, countryCode) : { marketplaces: [], official: [], others: [] }),
    [result, countryCode],
  );

  const usage = result?.token_usage;
  const totalTokens = (usage?.input_tokens || 0) + (usage?.output_tokens || 0);

  const copyRange = async () => {
    if (!rangeText) return;
    try {
      await navigator.clipboard.writeText(`${brand} ${model} public price range (${countryName}): ${rangeText}`);
      toast({ title: 'Copied price range' });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
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
                Paste a client spec line as-is, or build the device with dropdowns.
                Country still controls which stores we search.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
          <div className="space-y-6 min-w-0">
            <Card className="card-shadow rounded-xl border-border/80 animate-inner-card-hover animate-fade-in-up animate-fade-in-up-delay-1">
              <CardContent className="p-6">
                <div className="space-y-5">
                  <div className="space-y-1.5 max-w-sm">
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

                  <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as 'paste' | 'manual')}>
                    <TabsList className="grid w-full grid-cols-2 h-11 bg-muted/50 p-1 rounded-xl">
                      <TabsTrigger value="paste" className="rounded-lg">Paste from client</TabsTrigger>
                      <TabsTrigger value="manual" className="rounded-lg">Build manually</TabsTrigger>
                    </TabsList>

                    <TabsContent value="paste" className="mt-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label>Device line</Label>
                        <Textarea
                          value={pasteText}
                          onChange={(e) => {
                            setPasteText(e.target.value);
                            const parsed = parseDeviceLine(e.target.value);
                            setParsePreview(parsed ? parsedSummary(parsed) : '');
                          }}
                          placeholder={'Lenovo ThinkPad E16 — 16" · Intel Core Ultra 5 · 16GB · 256GB · Integrated graphics\nApple MacBook Air M5 — 15" · M5 · 32GB · 512GB · Silver'}
                          className="min-h-[110px] rounded-xl text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                          Paste the line the client sent. We read brand, model, screen, chip, RAM, and storage.
                        </p>
                      </div>
                      {parsePreview && (
                        <p className="text-xs rounded-lg border border-border/70 bg-muted/40 px-3 py-2">
                          <span className="text-muted-foreground">Read as </span>
                          <span className="font-medium">{parsePreview}</span>
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="rounded-xl h-11 px-5 gradient-primary border-0 shadow-md shadow-primary/25 hover:scale-[1.02] transition-transform"
                          disabled={loading}
                          onClick={handlePasteSearch}
                        >
                          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                          {loading ? 'Searching the web…' : 'Find public prices'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl h-11"
                          disabled={!pasteText.trim()}
                          onClick={() => {
                            if (!applyParsedLine(pasteText)) {
                              toast({ title: 'Could not read that line', variant: 'destructive' });
                              return;
                            }
                            setEntryMode('manual');
                          }}
                        >
                          Fill manual form
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="manual" className="mt-4">
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
                          <SpecCombobox
                            label="Brand"
                            required
                            value={brand}
                            onChange={handleBrandChange}
                            options={LOOKUP_BRANDS}
                            placeholder="e.g. Apple, Dell, Lenovo"
                          />
                          <SpecCombobox
                            label={categoryCfg.modelLabel}
                            required
                            value={model}
                            onChange={handleModelChange}
                            options={modelOptions}
                            placeholder={categoryCfg.modelPlaceholder}
                            tooltip="Recent models for this brand. Selecting one autofills current default specs."
                          />
                        </div>

                        {categoryCfg.fields.length > 0 && (
                          <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Specs · {categoryCfg.specSubtitle} · CTO options stay in-family
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                              {categoryCfg.fields.map((key) => {
                                const meta = DEVICE_FIELD_LABELS[key];
                                const options = specOptions(key, brand);
                                if (options.length === 0) {
                                  return (
                                    <div key={key} className="space-y-1.5">
                                      <Label>{meta.label}</Label>
                                      <input
                                        className="flex h-10 w-full rounded-[10px] border-[1.5px] border-input bg-background px-3 text-sm"
                                        value={specs[key] || ''}
                                        onChange={(e) => handleSpecChange(key, e.target.value)}
                                        placeholder={meta.placeholder}
                                      />
                                    </div>
                                  );
                                }
                                return (
                                  <SpecCombobox
                                    key={key}
                                    label={meta.label}
                                    value={specs[key] || ''}
                                    onChange={(v) => handleSpecChange(key, v)}
                                    options={options}
                                    placeholder={meta.placeholder}
                                  />
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
                    </TabsContent>
                  </Tabs>
                </div>
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
                        <div className="h-2 flex-1 rounded-full overflow-hidden bg-muted">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${
                              i < searchStep ? 'w-full bg-primary' : i === searchStep ? 'w-2/3 bg-primary/80 animate-pulse' : 'w-0 bg-primary'
                            }`}
                          />
                        </div>
                        <span className={`text-xs w-28 text-right ${i <= searchStep ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
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
                  <div className="relative z-10">
                    <p className="text-xs uppercase tracking-wider text-white/80 font-semibold">Suggested public range</p>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mt-2">
                      <p className="text-3xl sm:text-4xl font-display font-bold tracking-tight tabular-nums">{rangeText}</p>
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
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { icon: DollarSign, label: 'This search cost', value: formatUsdCost(usage?.total_cost_usd ?? 0), hint: 'Claude API spend' },
                    { icon: Zap, label: 'Tokens used', value: formatTokenCount(totalTokens), hint: `${formatTokenCount(usage?.input_tokens ?? 0)} in · ${formatTokenCount(usage?.output_tokens ?? 0)} out` },
                    { icon: Cpu, label: 'Model', value: usage?.model ? usage.model.replace(/^claude-/, '').split('-20')[0] : '—', hint: usage?.model || 'Cached history' },
                    { icon: Globe2, label: 'Queries', value: String(result.search_queries_used?.length || 0), hint: 'Shopping + web search' },
                  ].map((stat) => (
                    <Card key={stat.label} className="rounded-xl border-border/80 card-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <stat.icon className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                        </div>
                        <p className="text-xl font-display font-bold tabular-nums truncate">{stat.value}</p>
                        <p className="text-[11px] text-muted-foreground mt-1 truncate">{stat.hint}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <PriceResultGroups
                  marketplaces={split.marketplaces}
                  official={split.official}
                  others={split.others}
                  countryCode={countryCode}
                />
              </div>
            )}
          </div>

          <LookupHistoryPanel
            rows={history}
            loading={historyLoading}
            onRestore={restoreHistory}
            onRerun={rerunHistory}
            onDelete={deleteHistory}
            onClearAll={clearHistory}
          />
        </div>
      </div>
    </AppLayout>
  );
}
