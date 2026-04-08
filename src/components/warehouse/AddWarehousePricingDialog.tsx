import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
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
import { Loader2, Check, MapPin, Building2, DollarSign, FileCheck, Search, Receipt } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRateToUsd, convertToUsd } from '@/lib/fx-rates';
import { FX_CURRENCY_OPTIONS, defaultCurrencyForCountryCode } from '@/lib/country-currencies';
import type { CountryRow } from '@/lib/warehouse-bulk-regions';
import { BULK_REGION_PRESETS, regionGroupKeysForPreset, togglePresetSelection } from '@/lib/warehouse-bulk-regions';
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
  { key: 'partner', label: 'Partner', title: 'Partner landed cost', description: 'What you pay the warehouse partner. Amounts convert to USD for storage when needed.' },
  { key: 'client', label: 'Client', title: 'Client pricing (USD, tax included)', description: 'Pay-as-you-go vs subscription ($1499/year plan). Same column layout as your external cost sheet.' },
  { key: 'finish', label: 'Finish', title: 'Quote & save', description: 'Validity dates, notes, and confirm (one row per country).' },
] as const;

function clientColumnName(k: WarehouseVendorChargeKey): string {
  return `client_${k}`;
}

function clientSubColumnName(k: WarehouseVendorChargeKey): string {
  return `client_sub_${k}`;
}

/** Cost-sheet style groups (reference layout: PAYG vs subscription tiers). */
const CLIENT_SHEET_GROUPS: {
  title: string;
  bullets?: string[];
  fields: { key: WarehouseVendorChargeKey; lineLabel?: string }[];
}[] = [
  {
    title: 'IT Asset Logistic Fulfillment Charges',
    bullets: [
      '1. Standard Shipping Charges (Both Ways)',
      '2. Box Procurement Charges',
    ],
    fields: [
      { key: 'shipping_to_employee', lineLabel: 'Ship to employee' },
      { key: 'retrieve_from_employee', lineLabel: 'Retrieve from employee' },
      { key: 'box_procurement_charges', lineLabel: 'Box procurement' },
    ],
  },
  {
    title: 'Box custom printing',
    bullets: ['Branding / custom box artwork'],
    fields: [{ key: 'box_custom_printing_charges', lineLabel: 'Box custom printing' }],
  },
  {
    title: 'Warehouse Storage Cost / Device',
    bullets: ['Per device warehousing'],
    fields: [{ key: 'storage_charge', lineLabel: 'Storage / device' }],
  },
  {
    title: 'Quality Checks',
    bullets: [
      '1. QC Inspection (Visual Check / Serial Number Verification)',
      '2. Sticker Removal',
      '3. Inward Handling',
      '4. Outward Handling / Dispatch Preparation',
      '5. Barcode / Labeling',
      '6. Repacking / Bubble Wrapping',
    ],
    fields: [{ key: 'qc_charges', lineLabel: 'Quality checks' }],
  },
  {
    title: 'Redeployment Charges',
    bullets: ['Prep + ship to next employee'],
    fields: [{ key: 'redeployment_charges', lineLabel: 'Redeployment' }],
  },
  {
    title: 'Repair / Upgradation of Device',
    bullets: ['Use 0 + notes if custom quote'],
    fields: [{ key: 'repair_upgrade_charges', lineLabel: 'Repair / upgrade' }],
  },
];

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
  /** Last region bulk action for pill highlight + scroll (cleared when user toggles individual countries). */
  const [regionBulkFocus, setRegionBulkFocus] = useState<string | null>(null);
  const countryListScrollRef = useRef<HTMLDivElement>(null);

  const [landingCurrency, setLandingCurrency] = useState('USD');
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [fxDate, setFxDate] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState<string | null>(null);
  const [fxSource, setFxSource] = useState<string | null>(null);

  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [quoteValidityDate, setQuoteValidityDate] = useState('');
  const [notes, setNotes] = useState('');
  const [charges, setCharges] = useState<Record<string, string>>(() =>
    Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));
  const [clientCharges, setClientCharges] = useState<Record<string, string>>(() =>
    Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));
  const [clientSubCharges, setClientSubCharges] = useState<Record<string, string>>(() =>
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
    setRegionBulkFocus(null);
    setLandingCurrency('USD');
    setFxRate(null);
    setFxDate(null);
    setFxError(null);
    setFxSource(null);
    setQuoteDate(new Date().toISOString().slice(0, 10));
    setQuoteValidityDate('');
    setNotes('');
    setCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));
    setClientCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));
    setClientSubCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));
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
      setRegionBulkFocus(null);
      setQuoteDate(editItem.quote_date || new Date().toISOString().slice(0, 10));
      setQuoteValidityDate(editItem.quote_validity_date || '');
      setNotes(editItem.notes || '');
      setLandingCurrency('USD');
      setFxRate(1);
      setFxSource('USD');
      setFxError(null);
      setCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, String((editItem as any)[f.key] ?? 0)])));
      setClientCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => {
        const ck = clientColumnName(f.key);
        return [f.key, String((editItem as any)[ck] ?? 0)];
      })));
      setClientSubCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => {
        const ck = clientSubColumnName(f.key);
        return [f.key, String((editItem as any)[ck] ?? 0)];
      })));
    } else {
      resetForm();
      setRegionBulkFocus(null);
    }
  }, [editItem, open, resetForm]);

  const scrollCountryListToPreset = useCallback((presetId: string) => {
    const root = countryListScrollRef.current;
    if (!root) return;
    if (presetId === 'all') {
      root.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const keys = regionGroupKeysForPreset(presetId);
    for (const key of keys) {
      const el = root.querySelector(`[data-wh-region="${key}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  }, []);

  const refreshFx = useCallback(async (currency: string) => {
    if (currency === 'USD') {
      setFxRate(1);
      setFxDate(new Date().toISOString().slice(0, 10));
      setFxError(null);
      setFxSource('USD');
      return;
    }
    setFxLoading(true);
    setFxError(null);
    try {
      const { rate, date, source } = await getRateToUsd(currency);
      setFxRate(rate);
      setFxDate(date);
      setFxSource(source);
    } catch (e: any) {
      setFxRate(null);
      setFxSource(null);
      setFxError(e?.message || 'Could not load exchange rate');
      toast({ title: 'FX unavailable', description: 'Switch to USD or tap Refresh. Rates use ECB/OpenExchange fallback.', variant: 'destructive' });
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

  const clientSubGrand = useMemo(
    () => CHARGE_FIELDS.reduce((s, f) => s + (parseFloat(clientSubCharges[f.key]) || 0), 0),
    [clientSubCharges],
  );

  const marginGrand = useMemo(() => clientGrand - vendorGrandUsd, [clientGrand, vendorGrandUsd]);

  const marginPctGrand = useMemo(() => {
    if (vendorGrandUsd <= 0) return null;
    return (marginGrand / vendorGrandUsd) * 100;
  }, [marginGrand, vendorGrandUsd]);

  const marginSubGrand = useMemo(() => clientSubGrand - vendorGrandUsd, [clientSubGrand, vendorGrandUsd]);

  const marginSubPctGrand = useMemo(() => {
    if (vendorGrandUsd <= 0) return null;
    return (marginSubGrand / vendorGrandUsd) * 100;
  }, [marginSubGrand, vendorGrandUsd]);

  const clientSheetTitle = useMemo(() => {
    const names = countries
      .filter((c) => selectedCountryIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => c.name);
    if (isEdit && editItem?.country?.name) {
      return `${editItem.country.name} Warehouse Storage & Shipping Cost | RemoAsset Corp`;
    }
    if (names.length === 0) return 'Warehouse Storage & Shipping Cost | RemoAsset Corp';
    if (names.length === 1) return `${names[0]} Warehouse Storage & Shipping Cost | RemoAsset Corp`;
    if (names.length <= 3) return `${names.join(', ')} — Warehouse Storage & Shipping Cost | RemoAsset Corp`;
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} — Warehouse Storage & Shipping Cost | RemoAsset Corp`;
  }, [countries, selectedCountryIds, isEdit, editItem?.country?.name]);

  const toggleCountry = (id: string) => {
    setRegionBulkFocus(null);
    setSelectedCountryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runAfterPaint = (fn: () => void) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(fn);
    });
  };

  const handleBulkToggle = (presetId: string) => {
    setRegionBulkFocus(presetId);
    setSelectedCountryIds((prev) => togglePresetSelection(prev, countries, presetId));
    runAfterPaint(() => scrollCountryListToPreset(presetId));
  };

  const handleSelectAllCountries = () => {
    setRegionBulkFocus('all');
    setSelectedCountryIds(new Set(countries.map((c) => c.id)));
    runAfterPaint(() => scrollCountryListToPreset('all'));
  };

  const handleClearCountries = () => {
    setRegionBulkFocus('clear');
    setSelectedCountryIds(new Set());
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
      row[clientSubColumnName(f.key)] = parseFloat(clientSubCharges[f.key]) || 0;
    });
    const fxLine =
      landingCurrency !== 'USD' && fxRate != null
        ? `Partner costs entered in ${landingCurrency}; stored USD @ ${fxRate.toFixed(6)} (ref ${fxDate || '—'}).`
        : '';
    const parts = [notes?.trim(), fxLine].filter(Boolean);
    if (fxSource && landingCurrency !== 'USD') {
      parts.push(`FX source: ${fxSource}`);
    }
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
  const stepIcons = [Building2, MapPin, DollarSign, Receipt, FileCheck];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'grid h-[min(92vh,900px)] max-h-[92vh] w-[calc(100vw-1.5rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-full sm:rounded-xl',
          step === 3 ? 'max-w-5xl' : 'max-w-3xl',
        )}
      >
        <DialogHeader className="shrink-0 space-y-4 border-b border-border/60 px-6 pb-4 pr-14 pt-6">
          <div>
            <DialogTitle className="text-xl">{isEdit ? 'Edit warehouse pricing' : 'Add warehouse pricing'}</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm">
              Wizard: vendor → countries → partner cost → client pricing (PAYG + subscription) → save.
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
                    {BULK_REGION_PRESETS.map((p) => {
                      const active = regionBulkFocus === p.id;
                      return (
                        <Button
                          key={p.id}
                          type="button"
                          variant={active ? 'default' : 'secondary'}
                          size="sm"
                          className={cn(
                            'h-8 rounded-full border px-3 text-xs transition-shadow',
                            active && 'shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_4px_hsl(var(--primary))]',
                          )}
                          onClick={() => handleBulkToggle(p.id)}
                          title={p.description}
                        >
                          {p.label}
                        </Button>
                      );
                    })}
                    <Button
                      type="button"
                      variant={regionBulkFocus === 'all' ? 'default' : 'outline'}
                      size="sm"
                      className={cn(
                        'h-8 rounded-full px-3 text-xs',
                        regionBulkFocus === 'all' && 'shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_4px_hsl(var(--primary))]',
                      )}
                      onClick={handleSelectAllCountries}
                    >
                      All countries
                    </Button>
                    <Button
                      type="button"
                      variant={regionBulkFocus === 'clear' ? 'secondary' : 'ghost'}
                      size="sm"
                      className={cn(
                        'h-8 rounded-lg text-xs',
                        regionBulkFocus === 'clear' && 'ring-2 ring-primary/60',
                      )}
                      onClick={handleClearCountries}
                    >
                      Clear
                    </Button>
                  </div>
                )}
                {isEdit && (
                  <p className="text-sm text-muted-foreground">Editing a single country row. To add more countries, create a new pricing entry.</p>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                  <Input
                    placeholder="Search countries by name or code…"
                    value={countrySearch}
                    onChange={(e) => {
                      setCountrySearch(e.target.value);
                      setRegionBulkFocus(null);
                    }}
                    className="h-11 rounded-[10px] pl-10"
                    aria-label="Search countries"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedCountryIds.size}</span> selected
                  {countrySearch.trim() ? (
                    <span className="text-muted-foreground"> · showing {filteredCountries.length} match{filteredCountries.length !== 1 ? 'es' : ''}</span>
                  ) : null}
                </p>
                <div
                  ref={countryListScrollRef}
                  className="max-h-[min(42vh,360px)] space-y-4 overflow-y-auto rounded-xl border border-border/80 bg-muted/20 p-3 scroll-pb-4"
                >
                  {groupedCountries.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No countries match your search.</p>
                  ) : (
                  groupedCountries.map(([region, list]) => (
                    <div key={region} data-wh-region={region}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{region}</p>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {list.map((c) => {
                          const checked = selectedCountryIds.has(c.id);
                          return (
                            <label
                              key={c.id}
                              className={cn(
                                'flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors',
                                checked
                                  ? 'border-primary/40 bg-primary/10 hover:bg-primary/15'
                                  : 'border-transparent hover:bg-muted/60',
                              )}
                            >
                              <Checkbox checked={checked} onCheckedChange={() => toggleCountry(c.id)} disabled={isEdit} />
                              <span className="text-sm font-medium">{c.name}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">{c.code}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in-0 duration-200">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <div className="space-y-2 lg:flex-1">
                    <Label className="text-sm font-medium">Partner quote currency</Label>
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
                  <Button type="button" variant="outline" size="sm" className="h-11 rounded-lg shrink-0 lg:mb-0" onClick={() => refreshFx(landingCurrency)} disabled={fxLoading || landingCurrency === 'USD'}>
                    {fxLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh rate'}
                  </Button>
                </div>
                <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
                  {landingCurrency === 'USD' ? (
                    <span>Partner amounts are entered in USD and stored as shown.</span>
                  ) : fxError ? (
                    <span className="text-destructive">{fxError}</span>
                  ) : fxRate != null ? (
                    <span>
                      <span className="font-medium">1 {landingCurrency} = {fxRate.toFixed(6)} USD</span>
                      {fxDate && <span className="text-muted-foreground"> · {fxDate}</span>}
                      {fxSource && fxSource !== 'USD' && (
                        <span className="text-muted-foreground"> · {fxSource}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Loading rate…</span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter <strong className="text-foreground">partner landed cost</strong> per line. Values are stored in USD (converted using the rate above when needed). Client-facing prices are set in the next step.
                </p>

                <div className="overflow-x-auto rounded-xl border border-border/80 shadow-sm">
                  <table className="w-full min-w-[520px] text-sm caption-bottom">
                    <caption className="sr-only">Partner costs by service</caption>
                    <thead>
                      <tr className="border-b border-border bg-muted/70">
                        <th className="w-[min(55%,320px)] px-3 py-2.5 text-left align-bottom font-semibold">Service</th>
                        <th className="px-2 py-2.5 text-right align-bottom font-semibold whitespace-nowrap">
                          <span className="block">Partner cost</span>
                          <span className="block text-[10px] font-normal text-muted-foreground">{landingCurrency === 'USD' ? 'USD' : `${landingCurrency} → USD`}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {CHARGE_FIELDS.map((f) => {
                        const wUsd = vendorUsdPreview[f.key] || 0;
                        return (
                          <tr key={f.key} className="bg-card/20 hover:bg-muted/25">
                            <td className="px-3 py-2.5 align-top">
                              <div className="font-medium leading-snug">{f.label}</div>
                              {f.sheetHint && (
                                <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{f.sheetHint}</div>
                              )}
                            </td>
                            <td className="px-2 py-2 align-top text-right">
                              <div className="relative ml-auto max-w-[7.5rem]">
                                <span className="pointer-events-none absolute left-2 top-1/2 z-[1] -translate-y-1/2 text-[10px] font-medium text-muted-foreground">
                                  {landingCurrency === 'USD' ? '$' : landingCurrency}
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min={0}
                                  value={charges[f.key]}
                                  onChange={(e) => setCharges((p) => ({ ...p, [f.key]: e.target.value }))}
                                  className={cn(
                                    'h-9 rounded-lg text-right tabular-nums',
                                    landingCurrency === 'USD' ? 'pl-6 pr-2' : 'pl-[2.75rem] pr-2',
                                  )}
                                />
                              </div>
                              {landingCurrency !== 'USD' && fxMultiplier > 0 && (
                                <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                                  stored ${wUsd.toFixed(2)}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-primary/35 bg-primary/10">
                        <td className="px-3 py-3 font-bold">Total partner (USD)</td>
                        <td className="px-2 py-3 text-right font-bold tabular-nums">${vendorGrandUsd.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-in fade-in-0 duration-200">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Client amounts are in <strong className="text-foreground">USD, tax included</strong>. Use the next step for quote dates and notes.
                </p>
                <div className="overflow-x-auto rounded-sm border-2 border-[#1b5e20] shadow-md">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <caption className="sr-only">{clientSheetTitle}</caption>
                    <thead>
                      <tr className="bg-[#2e7d32] text-white">
                        <th
                          colSpan={3}
                          className="border border-[#1b5e20] px-3 py-3 text-center text-sm font-bold leading-snug tracking-tight"
                        >
                          {clientSheetTitle}
                        </th>
                      </tr>
                      <tr className="bg-[#ffeb3b] text-black">
                        <th className="border border-amber-700/40 px-3 py-2.5 text-left align-bottom font-semibold">
                          Description
                        </th>
                        <th className="border border-amber-700/40 px-2 py-2 text-center align-bottom font-semibold">
                          <span className="block">(Pay As You Go)</span>
                          <span className="mt-1 block text-[11px] font-normal normal-case">Costing (USD) Tax Included</span>
                        </th>
                        <th className="border border-amber-700/40 px-2 py-2 text-center align-bottom font-semibold">
                          <span className="block">(Subscription) 1499$/Annum</span>
                          <span className="mt-1 block text-[11px] font-normal normal-case">Costing (USD) Tax Included</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {CLIENT_SHEET_GROUPS.map((group) => (
                        <Fragment key={group.title}>
                          {group.fields.map((line, lineIdx) => (
                            <tr key={`${group.title}-${line.key}`} className="odd:bg-background even:bg-muted/30">
                              <td className="border border-border/80 px-3 py-2 align-top">
                                {lineIdx === 0 && (
                                  <>
                                    <div className="font-bold leading-snug">*{group.title}*</div>
                                    {group.bullets && group.bullets.length > 0 && (
                                      <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-[12px] text-muted-foreground">
                                        {group.bullets.map((b) => (
                                          <li key={b} className="leading-snug">{b}</li>
                                        ))}
                                      </ol>
                                    )}
                                  </>
                                )}
                                {group.fields.length > 1 ? (
                                  <div className={cn('text-[12px] font-medium text-foreground', lineIdx === 0 ? 'mt-2' : 'mt-0 pl-2')}>
                                    {line.lineLabel}
                                  </div>
                                ) : null}
                              </td>
                              <td className="border border-border/80 px-2 py-2 align-top text-right">
                                <div className="relative ml-auto max-w-[6.75rem]">
                                  <span className="pointer-events-none absolute left-2 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={clientCharges[line.key]}
                                    onChange={(e) => setClientCharges((p) => ({ ...p, [line.key]: e.target.value }))}
                                    className="h-9 rounded-md border-amber-900/20 bg-background pl-6 pr-2 text-right text-sm tabular-nums"
                                    placeholder={line.key === 'repair_upgrade_charges' ? '0' : undefined}
                                  />
                                </div>
                                {line.key === 'repair_upgrade_charges' && (
                                  <p className="mt-1 text-[11px] text-muted-foreground">Custom quote — use 0 + notes</p>
                                )}
                              </td>
                              <td className="border border-border/80 px-2 py-2 align-top text-right">
                                <div className="relative ml-auto max-w-[6.75rem]">
                                  <span className="pointer-events-none absolute left-2 top-1/2 z-[1] -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min={0}
                                    value={clientSubCharges[line.key]}
                                    onChange={(e) => setClientSubCharges((p) => ({ ...p, [line.key]: e.target.value }))}
                                    className="h-9 rounded-md border-amber-900/20 bg-background pl-6 pr-2 text-right text-sm tabular-nums"
                                    placeholder={line.key === 'repair_upgrade_charges' ? '0' : undefined}
                                  />
                                </div>
                                {line.key === 'repair_upgrade_charges' && (
                                  <p className="mt-1 text-[11px] text-muted-foreground">Custom quote — use 0 + notes</p>
                                )}
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#ffeb3b]/50 font-bold text-black">
                        <td className="border border-amber-800/30 px-3 py-2.5">Total (USD)</td>
                        <td className="border border-amber-800/30 px-2 py-2.5 text-right tabular-nums">${clientGrand.toFixed(2)}</td>
                        <td className="border border-amber-800/30 px-2 py-2.5 text-right tabular-nums">${clientSubGrand.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
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

                <div className="overflow-x-auto rounded-xl border border-border/80">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b bg-muted/60">
                        <th className="px-3 py-2 text-left font-semibold">Service</th>
                        <th className="px-3 py-2 text-right font-semibold">Partner (USD)</th>
                        <th className="px-3 py-2 text-right font-semibold">PAYG (USD)</th>
                        <th className="px-3 py-2 text-right font-semibold">Subscription (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {CHARGE_FIELDS.map((f) => {
                        const w = vendorUsdPreview[f.key] || 0;
                        const payg = parseFloat(clientCharges[f.key]) || 0;
                        const sub = parseFloat(clientSubCharges[f.key]) || 0;
                        return (
                          <tr key={f.key}>
                            <td className="px-3 py-2">{f.label}</td>
                            <td className="px-3 py-2 text-right tabular-nums">${w.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">${payg.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">${sub.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-primary/30 bg-primary/5 font-bold">
                        <td className="px-3 py-2.5">Total</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">${vendorGrandUsd.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">${clientGrand.toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">${clientSubGrand.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!isEdit && (
                  <p className="text-xs text-muted-foreground">
                    Saving creates <strong>{selectedCountryIds.size}</strong> row{selectedCountryIds.size !== 1 ? 's' : ''} (vendor + country) with the same partner and client figures.
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
