import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeviceSpecForm, SectionHeader, type DeviceSpecValues } from '@/components/shared/DeviceSpecForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Tag, Check, Package, UserRound } from 'lucide-react';
import { discountVsMrp } from '@/lib/mrp-insights';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import type { VendorDevicePricing } from '@/types/procurement';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editItem?: VendorDevicePricing | null;
}

const WIZARD_STEPS = [
  { key: 'scope', label: 'Scope', title: 'Country & vendor', description: 'Which market and supplier this quote applies to.' },
  { key: 'device', label: 'Device', title: 'Device configuration', description: 'Specs, add-ons, and quantity for this RFP line.' },
  { key: 'quote', label: 'Quote', title: 'Pricing & dates', description: 'Vendor price, MRP, and quote validity.' },
  { key: 'finish', label: 'Finish', title: 'Notes & save', description: 'Optional notes, then save this pricing row.' },
] as const;

export function AddDevicePricingDialog({ open, onOpenChange, onSuccess, editItem }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [allVendors, setAllVendors] = useState<{ id: string; company_name: string; country_ids: string[] }[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string; code: string }[]>([]);

  const [countryId, setCountryId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [mrpUsd, setMrpUsd] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [quoteValidityDate, setQuoteValidityDate] = useState('');

  const [deviceSpec, setDeviceSpec] = useState<DeviceSpecValues>({
    brand: '', device_model: '', processor: '', display_size: '',
    ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
  });

  const lastStepIndex = WIZARD_STEPS.length - 1;

  const resetForm = () => {
    setCountryId(''); setVendorId(''); setPriceUsd(''); setMrpUsd('');
    setQuoteDate(new Date().toISOString().slice(0, 10)); setQuoteValidityDate('');
    setDeviceSpec({
      brand: '', device_model: '', processor: '', display_size: '',
      ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
    });
  };

  useEffect(() => {
    if (!open) return;
    supabase.from('leads').select('id, company_name, country_ids').order('company_name').then(({ data }) => {
      if (data) setAllVendors(data as any);
    });
    supabase.from('countries').select('id, name, code').order('name').then(({ data }) => {
      if (data) setCountries(data);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (editItem) {
      setCountryId(editItem.country_id);
      setVendorId(editItem.vendor_id);
      setPriceUsd(String(editItem.price_usd));
      setMrpUsd(editItem.mrp_usd != null ? String(editItem.mrp_usd) : '');
      setQuoteDate(editItem.quote_date);
      setQuoteValidityDate(editItem.quote_validity_date || '');
      setDeviceSpec({
        brand: editItem.brand, device_model: editItem.device_model,
        processor: editItem.processor, display_size: editItem.display_size,
        ram: editItem.ram, storage: editItem.storage,
        gpu: editItem.gpu || '', os: editItem.os || '',
        quantity: editItem.quantity, addons: editItem.addons || [],
        notes: editItem.notes || '',
      });
    } else {
      resetForm();
    }
  }, [editItem, open]);

  const vendorsForCountry = countryId
    ? allVendors.filter((v) => Array.isArray(v.country_ids) && v.country_ids.includes(countryId))
    : allVendors;

  const handleCountryChange = (id: string) => {
    setCountryId(id);
    setVendorId('');
  };

  const handleSave = async () => {
    if (!countryId || !vendorId || !deviceSpec.brand || !deviceSpec.device_model ||
        !deviceSpec.processor || !deviceSpec.display_size || !deviceSpec.ram ||
        !deviceSpec.storage || !priceUsd) {
      toast({ title: 'Missing fields', description: 'Please fill all required fields.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      vendor_id: vendorId,
      country_id: countryId,
      brand: deviceSpec.brand,
      device_model: deviceSpec.device_model,
      processor: deviceSpec.processor,
      display_size: deviceSpec.display_size,
      ram: deviceSpec.ram,
      storage: deviceSpec.storage,
      gpu: deviceSpec.gpu || null,
      os: deviceSpec.os || null,
      addons: deviceSpec.addons as any,
      price_usd: parseFloat(priceUsd),
      mrp_usd: (() => {
        const m = parseFloat(mrpUsd);
        return Number.isNaN(m) ? null : m;
      })(),
      quantity: deviceSpec.quantity,
      quote_date: quoteDate,
      quote_validity_date: quoteValidityDate || null,
      notes: deviceSpec.notes || null,
      ...(editItem ? {} : { created_by: user?.id }),
    };

    const { error } = editItem
      ? await supabase.from('vendor_device_pricing' as any).update(payload).eq('id', editItem.id)
      : await supabase.from('vendor_device_pricing' as any).insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editItem ? 'Pricing updated' : 'Pricing added', description: `${deviceSpec.brand} ${deviceSpec.device_model} saved.` });
      onOpenChange(false);
      onSuccess();
      resetForm();
    }
  };

  const selectedCountryName = countries.find((c) => c.id === countryId)?.name;

  const mrpInsight = useMemo(() => {
    const m = parseFloat(mrpUsd);
    const p = parseFloat(priceUsd);
    return discountVsMrp(m, p);
  }, [mrpUsd, priceUsd]);

  const validateDevice = () => {
    if (!deviceSpec.brand || !deviceSpec.device_model || !deviceSpec.processor ||
        !deviceSpec.display_size || !deviceSpec.ram || !deviceSpec.storage) {
      toast({ title: 'Missing device details', description: 'Fill all required spec fields before continuing.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 0) {
      if (!countryId) {
        toast({ title: 'Select a country', variant: 'destructive' });
        return;
      }
      if (!vendorId) {
        toast({ title: 'Select a vendor', variant: 'destructive' });
        return;
      }
    }
    if (step === 1 && !validateDevice()) return;
    if (step === 2) {
      if (!priceUsd?.trim()) {
        toast({ title: 'Vendor quote required', description: 'Enter the quote amount in USD before continuing.', variant: 'destructive' });
        return;
      }
    }
    setStep((s) => Math.min(s + 1, lastStepIndex));
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const meta = WIZARD_STEPS[step];
  const isEdit = Boolean(editItem);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(92vh,880px)] max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-full sm:rounded-xl">
        <DialogHeader className="shrink-0 space-y-4 border-b border-border/60 px-6 pb-4 pr-14 pt-6">
          <div>
            <DialogTitle className="text-xl">{isEdit ? 'Edit device pricing' : 'Add device pricing'}</DialogTitle>
            <DialogDescription className="mt-1.5 text-sm">
              Step-by-step vendor RFP line — same flow as client requests.
            </DialogDescription>
          </div>

          <nav aria-label="Form progress" className="flex gap-1.5 sm:gap-2">
            {WIZARD_STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { if (i < step) setStep(i); }}
                  disabled={i > step}
                  className={cn(
                    'min-w-0 flex-1 rounded-lg px-1.5 py-2 text-left transition-colors sm:px-3 sm:py-2.5',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    i <= step ? 'cursor-pointer hover:bg-muted/80' : 'cursor-not-allowed opacity-50',
                    active && 'bg-primary/10 ring-1 ring-primary/30',
                  )}
                >
                  <div
                    className={cn(
                      'mb-2 h-1 rounded-full transition-colors',
                      done ? 'bg-primary' : active ? 'bg-primary/70' : 'bg-muted',
                    )}
                  />
                  <div className="flex items-center gap-1">
                    {done && <Check className="hidden h-3 w-3 shrink-0 text-primary sm:block" aria-hidden />}
                    <span
                      className={cn(
                        'truncate text-[10px] font-semibold uppercase tracking-wide sm:text-xs',
                        active && 'text-primary',
                      )}
                    >
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
          aria-label="Wizard step content"
        >
          <div className="space-y-6 px-6 py-5 pb-8">
            {step === 0 && (
              <div className="animate-in fade-in-0 duration-200 space-y-6">
                <SectionHeader number={1} title="Country & vendor" subtitle="Quote region and supplier" />
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Country <span className="text-destructive">*</span></Label>
                    <Select value={countryId} onValueChange={handleCountryChange}>
                      <SelectTrigger className="h-11 rounded-[10px]"><SelectValue placeholder="Select country first" /></SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Vendor <span className="text-destructive">*</span></Label>
                    <Select value={vendorId} onValueChange={setVendorId} disabled={!countryId}>
                      <SelectTrigger className="h-11 rounded-[10px]">
                        <SelectValue placeholder={countryId ? `Vendors in ${selectedCountryName}` : 'Select country first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {vendorsForCountry.length === 0 ? (
                          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                            No vendors found for this country
                          </div>
                        ) : (
                          vendorsForCountry.map((v) => (
                            <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {countryId && (
                      <p className="text-xs text-muted-foreground">
                        {vendorsForCountry.length} vendor{vendorsForCountry.length !== 1 ? 's' : ''} serve {selectedCountryName}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="animate-in fade-in-0 duration-200 space-y-6">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Structured specifications</span>
                </div>
                <DeviceSpecForm values={deviceSpec} onChange={setDeviceSpec} sectionNumberStart={2} addonsMode="dialog" hideNotes />
              </div>
            )}

            {step === 2 && (
              <div className="animate-in fade-in-0 duration-200 space-y-6">
                <SectionHeader number={4} title="Pricing & quote" subtitle="Amounts and validity" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Card className="overflow-hidden rounded-xl border-border/90 shadow-sm">
                    <CardContent className="space-y-3 p-4 sm:p-5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vendor quote (USD) <span className="text-destructive">*</span></Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={priceUsd}
                          onChange={(e) => setPriceUsd(e.target.value)}
                          className="h-11 rounded-[10px] pl-7 text-base tabular-nums"
                          placeholder="0.00"
                        />
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="overflow-hidden rounded-xl border-border/90 shadow-sm">
                    <CardContent className="space-y-3 p-4 sm:p-5">
                      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">MRP / list (USD)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={mrpUsd}
                          onChange={(e) => setMrpUsd(e.target.value)}
                          className="h-11 rounded-[10px] pl-7 text-base tabular-nums"
                          placeholder="Optional"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">Compare vendor quote vs typical list / MRP.</p>
                    </CardContent>
                  </Card>
                  <div className="space-y-2 sm:col-span-1">
                    <Label className="text-sm font-medium">Quote date</Label>
                    <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="h-11 rounded-[10px]" />
                  </div>
                  <div className="space-y-2 sm:col-span-1">
                    <Label className="text-sm font-medium">Quote validity date</Label>
                    <Input type="date" value={quoteValidityDate} onChange={(e) => setQuoteValidityDate(e.target.value)} className="h-11 rounded-[10px]" />
                  </div>
                </div>
                {mrpInsight && (
                  <Card className="border-primary/25 bg-primary/5 shadow-none rounded-xl">
                    <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                      <Tag className="h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">vs MRP</p>
                        <p className="text-xs text-muted-foreground">
                          Quote is <span className="font-medium text-foreground">{mrpInsight.pctOffMrp.toFixed(1)}%</span> below list
                          {' '}(save ${mrpInsight.savingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })})
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="animate-in fade-in-0 duration-200 space-y-6">
                <div className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm sm:p-5">
                  <p className="font-medium text-foreground">Recap</p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li><span className="font-medium text-foreground">Vendor:</span> {allVendors.find((v) => v.id === vendorId)?.company_name ?? '—'} · {selectedCountryName ?? '—'}</li>
                    <li><span className="font-medium text-foreground">Device:</span> {deviceSpec.brand} {deviceSpec.device_model}{deviceSpec.quantity > 1 ? ` ×${deviceSpec.quantity}` : ''}</li>
                    <li><span className="font-medium text-foreground">Quote:</span> {priceUsd ? `$${Number(priceUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'} {mrpUsd ? `· MRP $${Number(mrpUsd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    Additional notes
                  </Label>
                  <Textarea
                    value={deviceSpec.notes}
                    onChange={(e) => setDeviceSpec({ ...deviceSpec, notes: e.target.value })}
                    placeholder="Requirements, preferences, or instructions…"
                    rows={6}
                    className="min-h-[140px] resize-y rounded-[10px] text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex shrink-0 flex-row items-center justify-between gap-3 border-t border-border/60 px-6 py-4 sm:gap-4">
          <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={handleBack} className="rounded-lg">
                Back
              </Button>
            )}
            {step < lastStepIndex ? (
              <Button type="button" onClick={handleNext} className="min-w-[7.5rem] rounded-lg">
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={handleSave} disabled={saving} className="min-w-[7.5rem] rounded-lg gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEdit ? 'Update pricing' : 'Add pricing'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
