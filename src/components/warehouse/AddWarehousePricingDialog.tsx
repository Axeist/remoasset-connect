import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, MapPin, Building2, DollarSign, Users, FileCheck, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRateToUsd, convertToUsd } from '@/lib/fx-rates';
import { FX_CURRENCY_OPTIONS, defaultCurrencyForCountryCode } from '@/lib/country-currencies';
import type { CountryRow } from '@/lib/warehouse-bulk-regions';
import { BULK_REGION_PRESETS, togglePresetSelection } from '@/lib/warehouse-bulk-regions';
import type { WarehouseVendorPricing } from '@/types/procurement';

export type WarehouseVendorChargeKey =
  | 'box_procurement_charges'
  | 'box_custom_printing_charges'
  | 'shipping_to_employee'
  | 'retrieve_from_employee'
  | 'storage_charge'
  | 'qc_charges'
  | 'repair_upgrade_charges'
  | 'redeployment_charges';

const CHARGE_FIELDS: { key: WarehouseVendorChargeKey; label: string; sheetHint?: string }[] = [
  { key: 'box_procurement_charges', label: 'Box procurement', sheetHint: 'Logistics / materials' },
  { key: 'box_custom_printing_charges', label: 'Box custom printing', sheetHint: 'Branding' },
  { key: 'shipping_to_employee', label: 'Ship to employee', sheetHint: 'Outbound logistics' },
  { key: 'retrieve_from_employee', label: 'Retrieve from employee', sheetHint: 'Inbound / offloading' },
  { key: 'storage_charge', label: 'Storage / device', sheetHint: 'Per device warehousing' },
  { key: 'qc_charges', label: 'Quality checks', sheetHint: 'QC, labeling, repack' },
  { key: 'repair_upgrade_charges', label: 'Repair / upgrade', sheetHint: 'Use 0 + notes if custom quote' },
  { key: 'redeployment_charges', label: 'Redeployment', sheetHint: 'Prep + ship' },
];

const WIZARD_STEPS = [
  { key: 'vendor', label: 'Vendor', title: 'Warehouse vendor', description: 'Choose the partner this tariff belongs to.' },
  { key: 'countries', label: 'Locations', title: 'Serviceable countries', description: 'Multi-select where they operate. Use region shortcuts to bulk-add.' },
  { key: 'landing', label: 'Landing', title: 'Vendor landing cost', description: 'Enter amounts in local currency or USD; we convert to USD for storage.' },
  { key: 'client', label: 'Client', title: 'Client-side pricing (USD)', description: 'Your bundle to clients — USD only, parallel line items.' },
  { key: 'finish', label: 'Finish', title: 'Quote & review', description: 'Validity dates, notes, and save (one row per country).' },
] as const;

function clientColumnName(k: WarehouseVendorChargeKey): string {
  return `client_${k}`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editItem?: WarehouseVendorPricing | null;
}

export function AddWarehousePricingDialog({ open, onOpenChange, onSuccess, editItem }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isEdit = Boolean(editItem);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [allVendors, setAllVendors] = useState<{ id: string; company_name: string; country_ids: string[]; vendor_types: string[] | null; warehouse_available: boolean | null }[]>([]);
  const [countries, setCountries] = useState<CountryRow[]>([]);

  const [vendorId, setVendorId] = useState('');
  const [selectedCountryIds, setSelectedCountryIds] = useState<Set<string>>(new Set());
  const [countrySearch, setCountrySearch] = useState('');

  const [landingCurrency, setLandingCurrency] = useState('USD');
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxDate, setFxDate] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);

  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [quoteValidityDate, setQuoteValidityDate] = useState('');
  const [notes, setNotes] = useState('');
  const [charges, setCharges] = useState<Record<string, string>>(() =>
    Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));
  const [clientCharges, setClientCharges] = useState<Record<string, string>>(() =>
    Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));

  const lastStepIndex = WIZARD_STEPS.length - 1;

  const warehouseVendorsAll = useMemo(
    () => allVendors.filter(
      (v) => (Array.isArray(v.vendor_types) && v.vendor_types.includes('warehouse')) || v.warehouse_available,
    ),
    [allVendors],
  );

  const resetForm = useCallback(() => {
    setVendorId('');
    setSelectedCountryIds(new Set());
    setCountrySearch('');
    setLandingCurrency('USD');
    setFxRate(null);
    setFxDate(null);
    setFxError(null);
    setQuoteDate(new Date().toISOString().slice(0, 10));
    setQuoteValidityDate('');
    setNotes('');
    setCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));
    setClientCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));
  }, []);

  useEffect(() => {
    if (!open) return;
    supabase.from('leads')
      .select('id, company_name, country_ids, vendor_types, warehouse_available')
      .order('company_name')
      .then(({ data }) => {
        if (data) setAllVendors(data as any);
 });
    supabase.from('countries').select('id, name, code, region').order('name').then(({ data }) => {
      if (data) setCountries(data as CountryRow[]);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (editItem) {
      setVendorId(editItem.vendor_id);
      setSelectedCountryIds(new Set(editItem.country_id ? [editItem.country_id] : []));
      setQuoteDate(editItem.quote_date || new Date().toISOString().slice(0, 10));
      setQuoteValidityDate(editItem.quote_validity_date || '');
      setNotes(editItem.notes || '');
      setLandingCurrency('USD');
      setFxRate(1);
      setCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, String((editItem as any)[f.key] ?? 0)])));
      setClientCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => {
        const ck = clientColumnName(f.key);
        return [f.key, String((editItem as any)[ck] ?? 0)];
      })));
    } else {
      resetForm();
    }
  }, [editItem, open, resetForm]);

  const refreshFx = useCallback(async (currency: string) => {
    if (currency === 'USD') {
      setFxRate(1);
      setFxDate(new Date().toISOString().slice(0, 10));
      setFxError(null);
      return;
    }
    setFxLoading(true);
    setFxError(null);
    try {
      const { rate, date } = await getRateToUsd(currency);
      setFxRate(rate);
      setFxDate(date);
    } catch (e: any) {
      setFxRate(null);
      setFxError(e?.message || 'Could not load exchange rate');
      toast({ title: 'FX unavailable', description: 'Try USD or refresh. You can still enter landing amounts in USD.', variant: 'destructive' });
    } finally {
      setFxLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!open || step !== 2) return;
    refreshFx(landingCurrency);
  }, [open, step, landingCurrency, refreshFx]);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q));
  }, [countries, countrySearch]);

  const groupedCountries = useMemo(() => {
    const m = new Map<string, CountryRow[]>();
    for (const c of filteredCountries) {
      const r = c.region || 'Other';
      if (!m.has(r)) m.set(r, []);
      m.get(r)!.push(c);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredCountries]);

  const fxMultiplier = landingCurrency === 'USD' ? 1 : (fxRate ?? 0);

  const vendorUsdPreview = useMemo(() => {
    const mult = landingCurrency === 'USD' ? 1 : (fxRate ?? 0);
    const out: Record<string, number> = {};
    CHARGE_FIELDS.forEach((f) => {
      const v = parseFloat(charges[f.key]) || 0;
      out[f.key] = mult ? v * mult : 0;
    });
    return out;
  }, [charges, landingCurrency, fxRate]);

  const vendorGrandUsd = useMemo(
    () => CHARGE_FIELDS.reduce((s, f) => s + (vendorUsdPreview[f.key] || 0), 0),
    [vendorUsdPreview],
  );

  const clientGrand = useMemo(
    () => CHARGE_FIELDS.reduce((s, f) => s + (parseFloat(clientCharges[f.key]) || 0), 0),
    [clientCharges],
  );

  const toggleCountry = (id: string) => {
    setSelectedCountryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkToggle = (presetId: string) => {
    setSelectedCountryIds((prev) => togglePresetSelection(prev, countries, presetId));
  };

  const handleNext = () => {
    if (step === 0) {
      if (!vendorId) {
        toast({ title: 'Select a vendor', variant: 'destructive' });
        return;
      }
    }
    if (step === 1 && selectedCountryIds.size === 0) {
      toast({ title: 'Select at least one country', variant: 'destructive' });
      return;
    }
    if (step === 2) {
      if (landingCurrency !== 'USD' && (fxRate == null || fxRate <= 0)) {
        toast({ title: 'Wait for FX rate', description: 'Refresh the rate or switch to USD.', variant: 'destructive' });
        return;
      }
    }
    setStep((s) => Math.min(s + 1, lastStepIndex));
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const buildPayloadRow = (country_id: string | null, includeCreatedBy: boolean) => {
    const mult = landingCurrency === 'USD' ? 1 : (fxRate ?? 1);
    const row: Record<string, unknown> = {
      vendor_id: vendorId,
      country_id,
      quote_date: quoteDate,
      quote_validity_date: quoteValidityDate || null,
      currency: 'USD',
      ...(includeCreatedBy ? { created_by: user?.id } : {}),
    };
    CHARGE_FIELDS.forEach((f) => {
      const local = parseFloat(charges[f.key]) || 0;
      row[f.key] = landingCurrency === 'USD' ? local : convertToUsd(local, mult);
      row[clientColumnName(f.key)] = parseFloat(clientCharges[f.key]) || 0;
    });
    const fxLine =
      landingCurrency !== 'USD' && fxRate != null
        ? `Vendor landing entered in ${landingCurrency}; stored USD @ ${fxRate.toFixed(6)} (Frankfurter / ECB ref ${fxDate || '—'}).`
        : '';
    const parts = [notes?.trim(), fxLine].filter(Boolean);
    row.notes = parts.length ? parts.join('\n') : null;
    return row;
  };

  const handleSave = async () => {
    if (!vendorId) {
      toast({ title: 'Vendor required', variant: 'destructive' });
      return;
    }
    if (!isEdit && selectedCountryIds.size === 0) {
      toast({ title: 'Select countries', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (isEdit && editItem) {
        const payload = buildPayloadRow(editItem.country_id || null, false);
        const { error } = await supabase.from('warehouse_vendor_pricing' as any).update(payload).eq('id', editItem.id);
        if (error) throw error;
        toast({ title: 'Pricing updated' });
      } else {
        const ids = [...selectedCountryIds];
        const rows = ids.map((cid) => buildPayloadRow(cid, true));
        const { error } = await supabase.from('warehouse_vendor_pricing' as any).insert(rows);
        if (error) throw error;
        toast({ title: 'Pricing added', description: `${rows.length} row(s) created.` });
      }
      onOpenChange(false);
      onSuccess();
      resetForm();
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const meta = WIZARD_STEPS[step];
  const stepIcons = [Building2, MapPin, DollarSign, Users, FileCheck];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(92vh,900px)] max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-full sm:rounded-xl">
        <DialogHeader className="shrink-0 space-y-4 border-b border-border/60 px-6 pb-4 pr-14 pt-6">
          <div>
            <DialogTitle className="text-xl">{isEdit ? 'Edit warehouse pricing' : 'Add warehouse pricing'}</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm">
              Wizard: vendor → countries → vendor landing (FX) → client USD → save.
            </DialogDescription>
          </div>

          <nav aria-label="Form progress" className="flex gap-1.5 sm:gap-2">
            {WIZARD_STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const Icon = stepIcons[i];
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { if (i < step) setStep(i); }}
                  disabled={i > step}
                  className={cn(
                    'min-w-0 flex-1 rounded-lg px-1.5 py-2 text-left transition-colors sm:px-2 sm:py-2.5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    i <= step ? 'cursor-pointer hover:bg-muted/80' : 'cursor-not-allowed opacity-50',
                    active && 'bg-primary/10 ring-1 ring-primary/30',
                  )}
                >
                  <div className={cn('mb-1.5 h-1 rounded-full transition-colors', done ? 'bg-primary' : active ? 'bg-primary/70' : 'bg-muted')} />
                  <div className="flex items-center gap-1">
                    <Icon className="hidden h-3 w-3 shrink-0 text-primary sm:block" aria-hidden />
                    {done && <Check className="h-3 w-3 text-primary sm:hidden" aria-hidden />}
                    <span className={cn('truncate text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]', active && 'text-primary')}>
                      {s.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </nav>

          <div>
            <h2 className="text-lg font-semibold tracking-tight">{meta.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{meta.description}</p>
          </div>
        </DialogHeader>

        <div
          className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]"
          role="region"
          aria-label="Wizard step"
        >
          <div className="space-y-6 px-6 py-5 pb-8">
            {step === 0 && (
              <div className="space-y-4 animate-in fade-in-0 duration-200">
                <Label className="text-sm font-medium">Warehouse vendor <span className="text-destructive">*</span></Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger className="h-11 rounded-[10px]">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseVendorsAll.length === 0 ? (
                      <div className="px-2 py-4 text-center text-sm text-muted-foreground">No warehouse vendors in directory</div>
                    ) : (
                      warehouseVendorsAll.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Tagged as warehouse in vendor types or with warehouse available on the lead.</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4 animate-in fade-in-0 duration-200">
                {!isEdit && (
                  <div className="flex flex-wrap gap-2">
                    {BULK_REGION_PRESETS.map((p) => (
                      <Button key={p.id} type="button" variant="secondary" size="sm" className="h-8 rounded-lg text-xs" onClick={() => handleBulkToggle(p.id)} title={p.description}>
                        {p.label}
                      </Button>
                    ))}
                    <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg text-xs" onClick={() => setSelectedCountryIds(new Set(countries.map((c) => c.id)))}>
                      All countries
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg text-xs" onClick={() => setSelectedCountryIds(new Set())}>
                      Clear
                    </Button>
                  </div>
                )}
                {isEdit && (
                  <p className="text-sm text-muted-foreground">Editing a single country row. To add more countries, create a new pricing entry.</p>
                )}
                <Input placeholder="Search countries…" value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} className="h-10 rounded-[10px]" />
                <p className="text-xs text-muted-foreground">{selectedCountryIds.size} selected</p>
                <div className="max-h-[min(42vh,360px)] space-y-4 overflow-y-auto rounded-xl border border-border/80 bg-muted/20 p-3">
                  {groupedCountries.map(([region, list]) => (
                    <div key={region}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{region}</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {list.map((c) => (
                          <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:bg-muted/60">
                            <Checkbox checked={selectedCountryIds.has(c.id)} onCheckedChange={() => toggleCountry(c.id)} disabled={isEdit} />
                            <span className="text-sm">{c.name}</span>
                            <span className="text-xs text-muted-foreground">{c.code}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in-0 duration-200">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="space-y-2 sm:flex-1">
                    <Label className="text-sm font-medium">Landing amounts currency</Label>
                    <Select value={landingCurrency} onValueChange={setLandingCurrency}>
                      <SelectTrigger className="h-11 rounded-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {FX_CURRENCY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!isEdit && (() => {
                      const picked = countries
                        .filter((c) => selectedCountryIds.has(c.id))
                        .sort((a, b) => a.name.localeCompare(b.name))[0];
                      const sug = picked ? defaultCurrencyForCountryCode(picked.code) : null;
                      if (!picked || !sug || sug === landingCurrency) return null;
                      return (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => setLandingCurrency(sug)}
                        >
                          Suggested for {picked.name}: {sug}
                        </button>
                      );
                    })()}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="rounded-lg shrink-0" onClick={() => refreshFx(landingCurrency)} disabled={fxLoading || landingCurrency === 'USD'}>
                    {fxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh rate'}
                  </Button>
                </div>
                <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
                  {landingCurrency === 'USD' ? (
                    <span>Amounts are stored in USD as entered.</span>
                  ) : fxError ? (
                    <span className="text-destructive">{fxError}</span>
                  ) : fxRate != null ? (
                    <span>
                      <span className="font-medium">1 {landingCurrency} = {fxRate.toFixed(6)} USD</span>
                      {fxDate && <span className="text-muted-foreground"> · ECB/ref {fxDate}</span>}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Loading rate…</span>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {CHARGE_FIELDS.map((f) => {
                    const localV = parseFloat(charges[f.key]) || 0;
                    const usdV = vendorUsdPreview[f.key] || 0;
                    return (
                      <div key={f.key} className="rounded-xl border border-border/80 bg-card/40 p-3">
                        <Label className="text-xs font-medium leading-tight">{f.label}</Label>
                        {f.sheetHint && <p className="text-[10px] text-muted-foreground mb-1">{f.sheetHint}</p>}
                        <div className="relative mt-1.5">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{landingCurrency === 'USD' ? '$' : '¤'}</span>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={charges[f.key]}
                            onChange={(e) => setCharges((p) => ({ ...p, [f.key]: e.target.value }))}
                            className="h-10 rounded-[10px] pl-8 text-sm tabular-nums"
                          />
                        </div>
                        {landingCurrency !== 'USD' && fxMultiplier > 0 && (
                          <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                            ≈ ${usdV.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between border-t border-border/60 pt-3 text-sm">
                  <span className="font-medium">Vendor landing total (USD)</span>
                  <span className="text-lg font-bold tabular-nums">${vendorGrandUsd.toFixed(2)}</span>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-in fade-in-0 duration-200">
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200/90">
                  <Tags className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Client bundle is <strong className="text-foreground">USD only</strong> — aligned with your warehouse cost sheet (Pay-as-you-go vs subscription style bundles you quote to clients).</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CHARGE_FIELDS.map((f) => (
                    <div key={f.key} className="rounded-xl border border-border/80 p-3">
                      <Label className="text-xs font-medium">{f.label} (USD)</Label>
                      <div className="relative mt-1.5">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={clientCharges[f.key]}
                          onChange={(e) => setClientCharges((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="h-10 rounded-[10px] pl-7 text-sm tabular-nums"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t pt-2 text-sm">
                  <span className="font-medium">Client bundle total (USD)</span>
                  <span className="text-lg font-bold tabular-nums text-primary">${clientGrand.toFixed(2)}</span>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5 animate-in fade-in-0 duration-200">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Quote date</Label>
                    <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="h-11 rounded-[10px]" />
                  </div>
                  <div className="space-y-2">
                    <Label>Quote validity</Label>
                    <Input type="date" value={quoteValidityDate} onChange={(e) => setQuoteValidityDate(e.target.value)} className="h-11 rounded-[10px]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="rounded-[10px]" placeholder="Internal context, PO refs, custom repair handling…" />
                </div>

                <div className="overflow-hidden rounded-xl border border-border/80">
                  <div className="grid grid-cols-3 gap-0 bg-muted/50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Service</span>
                    <span className="text-right">Landing (USD)</span>
                    <span className="text-right">Client (USD)</span>
                  </div>
                  <div className="divide-y divide-border/60">
                    {CHARGE_FIELDS.map((f) => (
                      <div key={f.key} className="grid grid-cols-3 gap-2 px-3 py-2 text-sm">
                        <span>{f.label}</span>
                        <span className="text-right tabular-nums">${(vendorUsdPreview[f.key] || 0).toFixed(2)}</span>
                        <span className="text-right tabular-nums font-medium">${(parseFloat(clientCharges[f.key]) || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-3 gap-2 bg-primary/5 px-3 py-2.5 text-sm font-bold">
                      <span>Total</span>
                      <span className="text-right tabular-nums">${vendorGrandUsd.toFixed(2)}</span>
                      <span className="text-right tabular-nums">${clientGrand.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                {!isEdit && (
                  <p className="text-xs text-muted-foreground">
                    Saving creates <strong>{selectedCountryIds.size}</strong> row{selectedCountryIds.size !== 1 ? 's' : ''} (vendor + country) with the same landing and client figures.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-border/60 px-6 py-4">
          <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => onOpenChange(false)}>Cancel</Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" className="rounded-lg" onClick={handleBack}>Back</Button>
            )}
            {step < lastStepIndex ? (
              <Button type="button" className="rounded-lg min-w-[7.5rem]" onClick={handleNext}>Continue</Button>
            ) : (
              <Button type="button" className="rounded-lg min-w-[7.5rem] gap-1.5" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Update' : 'Save pricing'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
