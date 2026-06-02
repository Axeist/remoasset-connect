import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DeviceSpecForm, SectionHeader, type DeviceSpecValues } from '@/components/shared/DeviceSpecForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { clientRequestProfit } from '@/lib/client-request-pricing';
import { discountVsMrp, quotedPctOfMrp } from '@/lib/mrp-insights';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, Package, UserRound, CreditCard, Tag, Check } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
}

const WIZARD_STEPS = [
  { key: 'scope', label: 'Scope', title: 'Delivery & vendor', description: 'Where this ships from and who supplies it.' },
  { key: 'device', label: 'Device', title: 'Device & specs', description: 'Model, configuration, and summary line for reports.' },
  { key: 'recipient', label: 'Recipient', title: 'Employee or inventory', description: 'End-user shipping details or hold at Remoasset.' },
  { key: 'financials', label: 'Money', title: 'Payment & pricing', description: 'Client payment and USD amounts (optional until you have quotes).' },
  { key: 'finish', label: 'Finish', title: 'Notes & submit', description: 'Internal notes, then create the request.' },
] as const;

function buildDeviceSummary(v: DeviceSpecValues): string {
  const parts = [
    `${v.brand} ${v.device_model}`.trim(),
    v.processor,
    v.ram,
    v.storage,
    v.display_size,
    v.gpu && `GPU: ${v.gpu}`,
    v.os && v.os,
  ].filter(Boolean);
  return parts.join(', ');
}

export function AddRequestDialog({ open, onOpenChange, onSuccess, clientId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [allVendors, setAllVendors] = useState<{ id: string; company_name: string; country_ids: string[] }[]>([]);

  const [countryId, setCountryId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [deviceSummary, setDeviceSummary] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeAddress, setEmployeeAddress] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [shipToInventory, setShipToInventory] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [clientPaymentDate, setClientPaymentDate] = useState('');
  const [quotedUsd, setQuotedUsd] = useState('');
  const [wireCostUsd, setWireCostUsd] = useState('');
  const [procurementUsd, setProcurementUsd] = useState('');
  const [mrpUsd, setMrpUsd] = useState('');

  const [deviceSpec, setDeviceSpec] = useState<DeviceSpecValues>({
    brand: '', device_model: '', processor: '', display_size: '',
    ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
  });

  const lastStepIndex = WIZARD_STEPS.length - 1;

  useEffect(() => {
    if (!open) return;
    supabase.from('countries').select('id, name').order('name').then(({ data }) => {
      if (data) setCountries(data);
    });
    supabase.from('leads').select('id, company_name, country_ids').order('company_name').then(({ data }) => {
      if (data) setAllVendors(data as any);
    });
  }, [open]);

  useEffect(() => {
    if (open) {
      setStep(0);
      setCountryId(''); setVendorId(''); setExpectedDeliveryDate('');
      setDeviceSummary(''); setEmployeeName(''); setEmployeeAddress(''); setEmployeePhone('');
      setShipToInventory(false); setPaymentStatus('unpaid'); setClientPaymentDate('');
      setQuotedUsd(''); setWireCostUsd(''); setProcurementUsd(''); setMrpUsd('');
      setDeviceSpec({
        brand: '', device_model: '', processor: '', display_size: '',
        ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
      });
    }
  }, [open]);

  useEffect(() => {
    if (shipToInventory) {
      setEmployeeName('');
      setEmployeePhone('');
      setEmployeeAddress('Remoasset Inventory');
    } else {
      setEmployeeAddress((a) => (a === 'Remoasset Inventory' ? '' : a));
    }
  }, [shipToInventory]);

  const profitInfo = useMemo(() => {
    const p = parseFloat(procurementUsd);
    const q = parseFloat(quotedUsd);
    return clientRequestProfit(p, q);
  }, [procurementUsd, quotedUsd]);

  const wireParsed = useMemo(() => {
    const w = parseFloat(wireCostUsd);
    return Number.isNaN(w) ? null : w;
  }, [wireCostUsd]);

  const mrpQuotedInsight = useMemo(() => {
    const m = parseFloat(mrpUsd);
    const q = parseFloat(quotedUsd);
    if (Number.isNaN(m) || m <= 0 || Number.isNaN(q)) return null;
    return { offList: discountVsMrp(m, q), pctOfMrp: quotedPctOfMrp(m, q) };
  }, [mrpUsd, quotedUsd]);

  const mrpProcurementInsight = useMemo(() => {
    const m = parseFloat(mrpUsd);
    const p = parseFloat(procurementUsd);
    if (Number.isNaN(m) || m <= 0 || Number.isNaN(p)) return null;
    return discountVsMrp(m, p);
  }, [mrpUsd, procurementUsd]);

  const vendorsForCountry = countryId
    ? allVendors.filter((v) => Array.isArray(v.country_ids) && v.country_ids.includes(countryId))
    : allVendors;

  const handleCountryChange = (id: string) => {
    setCountryId(id);
    setVendorId('');
  };

  const selectedCountryName = countries.find((c) => c.id === countryId)?.name;

  const fillSummaryFromSpecs = () => {
    const built = buildDeviceSummary(deviceSpec);
    if (!built.replace(/,/g, '').trim()) {
      toast({ title: 'Fill device fields first', variant: 'destructive' });
      return;
    }
    setDeviceSummary(built);
  };

  const parseMoney = (s: string) => {
    const n = parseFloat(s);
    return Number.isNaN(n) ? null : n;
  };

  const validateDeviceStep = () => {
    if (!deviceSpec.brand || !deviceSpec.device_model || !deviceSpec.processor ||
        !deviceSpec.display_size || !deviceSpec.ram || !deviceSpec.storage) {
      toast({ title: 'Missing device details', description: 'Fill all required spec fields before continuing.', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 0 && !countryId) {
      toast({ title: 'Select a country', description: 'Country is required for this request.', variant: 'destructive' });
      return;
    }
    if (step === 1 && !validateDeviceStep()) return;
    setStep((s) => Math.min(s + 1, lastStepIndex));
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSave = async () => {
    if (!countryId || !deviceSpec.brand || !deviceSpec.device_model || !deviceSpec.processor ||
        !deviceSpec.display_size || !deviceSpec.ram || !deviceSpec.storage) {
      toast({ title: 'Missing fields', description: 'Please fill country and all required device details.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    const summaryToSave = deviceSummary.trim() || buildDeviceSummary(deviceSpec) || null;

    const payload = {
      client_id: clientId,
      request_type: 'fulfillment',
      country_id: countryId,
      vendor_id: vendorId || null,
      expected_delivery_date: expectedDeliveryDate || null,
      brand: deviceSpec.brand,
      device_model: deviceSpec.device_model,
      quantity: deviceSpec.quantity,
      processor: deviceSpec.processor,
      display_size: deviceSpec.display_size,
      ram: deviceSpec.ram,
      storage: deviceSpec.storage,
      gpu: deviceSpec.gpu || null,
      os: deviceSpec.os || null,
      addons: deviceSpec.addons as any,
      device_summary: summaryToSave,
      employee_name: shipToInventory ? null : (employeeName.trim() || null),
      employee_address: employeeAddress.trim() || null,
      employee_phone: shipToInventory ? null : (employeePhone.trim() || null),
      payment_status: paymentStatus,
      client_payment_date: clientPaymentDate || null,
      client_price_usd: parseMoney(quotedUsd),
      wire_cost_usd: parseMoney(wireCostUsd),
      vendor_price_usd: parseMoney(procurementUsd),
      mrp_usd: parseMoney(mrpUsd),
      notes: deviceSpec.notes || null,
      created_by: user?.id,
    };

    const { error } = await supabase.from('client_requests' as any).insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Request added', description: `${deviceSpec.brand} ${deviceSpec.device_model} request created.` });
      onOpenChange(false);
      onSuccess();
    }
  };

  const meta = WIZARD_STEPS[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(92vh,880px)] max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-full sm:rounded-xl">
        <DialogHeader className="px-6 pt-6 pb-4 pr-14 space-y-4 shrink-0 border-b border-border/60">
          <div>
            <DialogTitle className="text-xl">Device fulfillment request</DialogTitle>
            <DialogDescription className="text-sm mt-1.5">
              New device procurement — step-by-step, one section at a time.
            </DialogDescription>
          </div>

          {/* Step rail */}
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
                    'flex-1 min-w-0 rounded-lg px-1.5 py-2 sm:px-3 sm:py-2.5 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    i <= step ? 'cursor-pointer hover:bg-muted/80' : 'cursor-not-allowed opacity-50',
                    active && 'bg-primary/10 ring-1 ring-primary/30',
                  )}
                >
                  <div
                    className={cn(
                      'h-1 rounded-full mb-2 transition-colors',
                      done ? 'bg-primary' : active ? 'bg-primary/70' : 'bg-muted',
                    )}
                  />
                  <div className="flex items-center gap-1">
                    {done && <Check className="h-3 w-3 text-primary shrink-0 hidden sm:block" aria-hidden />}
                    <span
                      className={cn(
                        'text-[10px] sm:text-xs font-semibold uppercase tracking-wide truncate',
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
            <p className="text-sm text-muted-foreground mt-0.5">{meta.description}</p>
          </div>
        </DialogHeader>

        <div
          className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]"
          role="region"
          aria-label="Wizard step content"
        >
          <div className="space-y-6 px-6 py-5 pb-8">
            {step === 0 && (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <SectionHeader number={1} title="Country & vendor" subtitle="Delivery country and supplier" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Country <span className="text-destructive">*</span></Label>
                    <Select value={countryId} onValueChange={handleCountryChange}>
                      <SelectTrigger className="h-11 rounded-[10px]"><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Vendor</Label>
                    <Select value={vendorId} onValueChange={setVendorId} disabled={!countryId}>
                      <SelectTrigger className="h-11 rounded-[10px]">
                        <SelectValue placeholder={countryId ? `Vendors in ${selectedCountryName}` : 'Select country first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {vendorsForCountry.length === 0 ? (
                          <div className="px-2 py-4 text-sm text-muted-foreground text-center">No vendors for this country</div>
                        ) : (
                          vendorsForCountry.map((v) => (
                            <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 max-w-sm">
                  <Label className="text-sm font-medium">Expected delivery date</Label>
                  <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="h-11 rounded-[10px]" />
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Structured specifications</span>
                </div>
                <DeviceSpecForm values={deviceSpec} onChange={setDeviceSpec} sectionNumberStart={2} hideNotes />
                <div className="space-y-3 rounded-xl border border-border/80 bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-sm font-medium">Device summary (reports)</Label>
                    <Button type="button" variant="secondary" size="sm" onClick={fillSummaryFromSpecs} className="rounded-lg">
                      Auto-fill from specs
                    </Button>
                  </div>
                  <Textarea
                    value={deviceSummary}
                    onChange={(e) => setDeviceSummary(e.target.value)}
                    placeholder="One line for quotes and spreadsheets…"
                    rows={4}
                    className="text-sm rounded-[10px] resize-y min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">You can edit this after the auto-fill. Shown as &ldquo;Device info&rdquo; on exports.</p>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <SectionHeader number={4} title="Employee / recipient" subtitle="End user or inventory hold" />
                <div className="rounded-xl border border-border/80 bg-card/50 p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="inventory"
                      checked={shipToInventory}
                      onCheckedChange={(c) => setShipToInventory(c === true)}
                      className="mt-0.5"
                    />
                    <label htmlFor="inventory" className="text-sm cursor-pointer leading-snug">
                      <span className="font-medium">Ship to Remoasset inventory</span>
                      <span className="block text-muted-foreground text-xs mt-0.5">No employee yet — we will fill shipping later.</span>
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Employee name</Label>
                    <Input
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="e.g. Ahmed Gaafer"
                      className="h-11 rounded-[10px]"
                      disabled={shipToInventory}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Employee address</Label>
                    <Textarea
                      value={employeeAddress}
                      onChange={(e) => setEmployeeAddress(e.target.value)}
                      placeholder="Full street address, city, country"
                      rows={4}
                      className="text-sm rounded-[10px] resize-y min-h-[96px]"
                    />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <Label className="text-sm font-medium">Employee phone</Label>
                    <Input
                      value={employeePhone}
                      onChange={(e) => setEmployeePhone(e.target.value)}
                      placeholder="e.g. 201007621919"
                      className="h-11 rounded-[10px]"
                      disabled={shipToInventory}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-8 animate-in fade-in-0 duration-200">
                <div className="space-y-4">
                  <SectionHeader number={5} title="Payment" subtitle="Client payment status" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Payment status</Label>
                      <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as 'paid' | 'unpaid')}>
                        <SelectTrigger className="h-11 rounded-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Date of payment (client)</Label>
                      <Input type="date" value={clientPaymentDate} onChange={(e) => setClientPaymentDate(e.target.value)} className="h-11 rounded-[10px]" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <SectionHeader number={6} title="Pricing (USD)" subtitle="MRP, quotes, and margins — relaxed layout" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="border-border/90 shadow-sm rounded-xl overflow-hidden">
                      <CardContent className="p-4 sm:p-5 space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">MRP / list</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input type="number" step="0.01" min={0} value={mrpUsd} onChange={(e) => setMrpUsd(e.target.value)} className="h-11 pl-7 rounded-[10px] text-base tabular-nums" placeholder="Optional" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-border/90 shadow-sm rounded-xl overflow-hidden">
                      <CardContent className="p-4 sm:p-5 space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Price quoted</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input type="number" step="0.01" min={0} value={quotedUsd} onChange={(e) => setQuotedUsd(e.target.value)} className="h-11 pl-7 rounded-[10px] text-base tabular-nums" placeholder="0.00" />
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-border/90 shadow-sm rounded-xl overflow-hidden">
                      <CardContent className="p-4 sm:p-5 space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Wire cost</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input type="number" step="0.01" min={0} value={wireCostUsd} onChange={(e) => setWireCostUsd(e.target.value)} className="h-11 pl-7 rounded-[10px] text-base tabular-nums" placeholder="0.00" />
                        </div>
                        <p className="text-xs text-muted-foreground">Bank fees (informational)</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/90 shadow-sm rounded-xl overflow-hidden">
                      <CardContent className="p-4 sm:p-5 space-y-3">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Procurement price</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input type="number" step="0.01" min={0} value={procurementUsd} onChange={(e) => setProcurementUsd(e.target.value)} className="h-11 pl-7 rounded-[10px] text-base tabular-nums" placeholder="0.00" />
                        </div>
                        <p className="text-xs text-muted-foreground">Vendor / landing cost</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="border-primary/30 bg-primary/5 shadow-none rounded-xl">
                      <CardContent className="p-4 sm:p-5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          Profit (% on cost)
                        </div>
                        <p className="text-2xl font-bold tabular-nums tracking-tight">
                          {profitInfo?.profitPctOnProcurement != null
                            ? `${profitInfo.profitPctOnProcurement.toFixed(2)}%`
                            : '—'}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="border-primary/30 bg-primary/5 shadow-none rounded-xl">
                      <CardContent className="p-4 sm:p-5 space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          <CreditCard className="h-4 w-4 text-primary" />
                          Profit (USD)
                        </div>
                        <p className="text-2xl font-bold tabular-nums tracking-tight">
                          {profitInfo !== null
                            ? `$${profitInfo.profitAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground">Quoted − procurement</p>
                      </CardContent>
                    </Card>
                  </div>

                  {profitInfo !== null && wireParsed != null && wireParsed > 0 && (
                    <p className="text-sm text-muted-foreground">
                      After wire: ${(profitInfo.profitAmount - wireParsed).toLocaleString('en-US', { minimumFractionDigits: 2 })} (reference only, not stored)
                    </p>
                  )}

                  {(mrpQuotedInsight || mrpProcurementInsight) && (
                    <Card className="border-primary/25 bg-primary/5 rounded-xl shadow-none">
                      <CardContent className="p-4 sm:p-5 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Tag className="h-4 w-4 text-primary" />
                          vs MRP
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                          {mrpQuotedInsight?.offList && mrpQuotedInsight.pctOfMrp != null && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Client quoted</p>
                              <p className="font-semibold">{mrpQuotedInsight.pctOfMrp.toFixed(1)}% of MRP</p>
                              <p className="text-xs text-muted-foreground">
                                {mrpQuotedInsight.offList.pctOffMrp.toFixed(1)}% below list · save ${mrpQuotedInsight.offList.savingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          )}
                          {mrpProcurementInsight && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">Procurement</p>
                              <p className="font-semibold">{mrpProcurementInsight.pctOffMrp.toFixed(1)}% below MRP</p>
                              <p className="text-xs text-muted-foreground">
                                Saves ${mrpProcurementInsight.savingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} vs list
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 sm:p-5 space-y-3 text-sm">
                  <p className="font-medium text-foreground">Quick recap</p>
                  <ul className="space-y-2 text-muted-foreground">
                    <li><span className="text-foreground font-medium">Device:</span> {deviceSpec.brand} {deviceSpec.device_model}{deviceSpec.quantity > 1 ? ` ×${deviceSpec.quantity}` : ''}</li>
                    <li><span className="text-foreground font-medium">Ship to:</span> {countries.find((c) => c.id === countryId)?.name ?? '—'}</li>
                    <li><span className="text-foreground font-medium">Recipient:</span> {shipToInventory ? 'Remoasset inventory' : (employeeName.trim() || employeeAddress.trim() || '—')}</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                    Additional notes
                  </Label>
                  <Textarea
                    value={deviceSpec.notes}
                    onChange={(e) => setDeviceSpec({ ...deviceSpec, notes: e.target.value })}
                    placeholder="Internal notes, PO references…"
                    rows={6}
                    className="rounded-[10px] text-sm resize-y min-h-[140px]"
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
              <Button type="button" onClick={handleNext} className="rounded-lg gap-1 min-w-[7.5rem]">
                Continue
              </Button>
            ) : (
              <Button type="button" onClick={handleSave} disabled={saving} className="rounded-lg gap-1.5 min-w-[7.5rem]">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Add request
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
