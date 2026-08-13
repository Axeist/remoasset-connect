import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  formatPublicPrice,
  formatTokenCount,
  formatUsdCost,
  invokeMrpLookup,
  clearLookupHistory,
  deleteLookupHistory,
  loadLookupHistory,
  saveLookupHistory,
  type MrpLookupHistoryRow,
  type MrpLookupRequest,
  type MrpLookupResponse,
} from '@/lib/mrp-lookup';
import { Copy, Loader2, Search, Sparkles, Tag } from 'lucide-react';

const SEARCH_STEPS = [
  'Searching Google Shopping…',
  'Checking public list / MRP pages…',
  'Matching specs with AI…',
];

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

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
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
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
    setSelectedHistoryId(null);
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
    setSelectedHistoryId(row.id);
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

  const lowestIsNearby = result?.summary.range_basis === 'nearby';

  const usage = result?.token_usage;
  const totalTokens = (usage?.input_tokens || 0) + (usage?.output_tokens || 0);

  const specChips = useMemo(
    () =>
      categoryCfg.fields
        .map((key) => ({ key, label: DEVICE_FIELD_LABELS[key].label, value: specs[key] }))
        .filter((c): c is { key: DeviceSpecFieldKey; label: string; value: string } => Boolean(c.value?.trim())),
    [categoryCfg.fields, specs],
  );

  const extraMarkets = markets.filter((m) => !LOOKUP_MARKETS.some((f) => f.code === m.code));

  const copyRange = async () => {
    if (!rangeText) return;
    try {
      await navigator.clipboard.writeText(`${brand} ${model} public low–high (${countryName}): ${rangeText}`);
      toast({ title: 'Copied price range' });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 animate-fade-in-up">
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-md shadow-primary/25">
            <Tag className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold tracking-tight">Price Lookup</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Street and list prices from major stores first, then local vendors.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            <div className="rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm card-shadow overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Market</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {LOOKUP_MARKETS.map((m) => (
                      <button
                        key={m.code}
                        type="button"
                        onClick={() => handleCountryChange(m.code)}
                        className={`shrink-0 h-8 px-2.5 rounded-full text-xs font-semibold cursor-pointer transition-colors duration-200 ${
                          countryCode === m.code
                            ? 'gradient-primary text-white shadow-sm'
                            : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <span className="mr-1.5" aria-hidden>{flagEmoji(m.code)}</span>
                        {m.name}
                      </button>
                    ))}
                    {extraMarkets.length > 0 && (
                      <Select
                        value={extraMarkets.some((m) => m.code === countryCode) ? countryCode : undefined}
                        onValueChange={handleCountryChange}
                      >
                        <SelectTrigger className="h-8 w-[140px] shrink-0 rounded-full text-xs">
                          <SelectValue placeholder="More…" />
                        </SelectTrigger>
                        <SelectContent>
                          {extraMarkets.map((m) => (
                            <SelectItem key={`${m.code}-${m.name}`} value={m.code}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <Tabs value={entryMode} onValueChange={(v) => setEntryMode(v as 'paste' | 'manual')}>
                  <TabsList className="grid w-full grid-cols-2 h-10 bg-muted/50 p-1 rounded-xl">
                    <TabsTrigger value="paste" className="rounded-lg text-xs sm:text-sm">Paste from client</TabsTrigger>
                    <TabsTrigger value="manual" className="rounded-lg text-xs sm:text-sm">Build manually</TabsTrigger>
                  </TabsList>

                  <TabsContent value="paste" className="mt-4 space-y-3">
                    <Textarea
                      value={pasteText}
                      onChange={(e) => {
                        setPasteText(e.target.value);
                        const parsed = parseDeviceLine(e.target.value);
                        setParsePreview(parsed ? parsedSummary(parsed) : '');
                      }}
                      placeholder={'Apple MacBook Air M5 — 15" · M5 · 16GB · 512GB'}
                      className="min-h-[96px] rounded-xl text-sm"
                    />
                    {parsePreview && (
                      <p className="text-xs rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-muted-foreground">Read as </span>
                        <span className="font-medium">{parsePreview}</span>
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl h-9 text-xs"
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
                  </TabsContent>

                  <TabsContent value="manual" className="mt-4">
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSearch();
                      }}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Category</Label>
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
                          tooltip="Selecting a model autofills default specs."
                        />
                      </div>

                      {categoryCfg.fields.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Specs</p>
                          <div className="flex flex-wrap gap-1.5">
                            {specChips.map((chip) => (
                              <span key={chip.key} className="h-7 px-2.5 rounded-full bg-muted/80 text-xs font-medium inline-flex items-center">
                                {chip.value}
                              </span>
                            ))}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {categoryCfg.fields.map((key) => {
                              const meta = DEVICE_FIELD_LABELS[key];
                              const options = specOptions(key, brand);
                              if (options.length === 0) {
                                return (
                                  <div key={key} className="space-y-1.5">
                                    <Label className="text-xs">{meta.label}</Label>
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
                    </form>
                  </TabsContent>
                </Tabs>
              </div>

              <div className="border-t border-border/60 px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-muted/30 sticky bottom-0 z-10">
                <p className="text-xs text-muted-foreground flex-1 truncate">
                  {countryName}
                  {brand && model ? ` · ${brand} ${model}` : ''}
                  {specChips.length ? ` · ${specChips.map((c) => c.value).join(' · ')}` : ''}
                </p>
                <Button
                  type="button"
                  className="rounded-xl h-11 px-5 gradient-primary border-0 shadow-md shadow-primary/25 hover:scale-[1.02] transition-transform cursor-pointer w-full sm:w-auto"
                  disabled={loading}
                  onClick={entryMode === 'paste' ? handlePasteSearch : handleSearch}
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {loading ? 'Searching…' : 'Find public prices'}
                </Button>
              </div>
            </div>

            {loading && (
              <div className="rounded-2xl border border-border/70 bg-card/70 p-6 animate-fade-in-up">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Search className="h-5 w-5 text-primary animate-pulse" />
                  </div>
                  <div>
                    <p className="font-display font-semibold">Checking major stores in {countryName}</p>
                    <p className="text-sm text-muted-foreground">{SEARCH_STEPS[searchStep]}</p>
                  </div>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full w-2/3 rounded-full bg-primary animate-pulse" />
                </div>
              </div>
            )}

            {result && !loading && (
              <div className="space-y-4 animate-fade-in-up">
                <div className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white card-shadow-lg gradient-primary">
                  <p className="text-xs uppercase tracking-wider text-white/80 font-semibold">
                    {countryName}
                    {lowestIsNearby ? ' · nearby configs' : ''}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-white/75">Lowest street</p>
                      <p className="text-2xl sm:text-3xl font-display font-bold tabular-nums mt-1">
                        {result.summary.range_from != null
                          ? formatPublicPrice(result.summary.range_from, result.summary.currency, countryCode)
                          : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white/75">Highest list</p>
                      <p className="text-2xl sm:text-3xl font-display font-bold tabular-nums mt-1">
                        {result.summary.range_to != null
                          ? formatPublicPrice(result.summary.range_to, result.summary.currency, countryCode)
                          : '—'}
                      </p>
                    </div>
                  </div>
                  {result.summary.range_from != null && result.summary.range_to != null && (
                    <div className="mt-4 h-1.5 rounded-full bg-white/20 overflow-hidden">
                      <div className="h-full w-full rounded-full bg-white/70" />
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
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
                        className="rounded-lg h-8 bg-white/20 hover:bg-white/30 text-white border-0 cursor-pointer ml-auto"
                        onClick={copyRange}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                      </Button>
                    )}
                  </div>
                </div>

                <PriceResultGroups
                  results={result.results}
                  countryCode={countryCode}
                  countryName={countryName}
                  queries={result.search_queries_used}
                />

                <p className="text-[11px] text-muted-foreground px-1">
                  {formatUsdCost(usage?.total_cost_usd ?? 0)}
                  {usage?.model ? ` · ${usage.model.replace(/^claude-/, '').split('-20')[0]}` : ''}
                  {totalTokens ? ` · ${formatTokenCount(totalTokens)} tokens` : ''}
                  {result.search_queries_used?.length ? ` · ${result.search_queries_used.length} queries` : ''}
                </p>
              </div>
            )}
          </div>

          <LookupHistoryPanel
            rows={history}
            loading={historyLoading}
            selectedId={selectedHistoryId}
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
