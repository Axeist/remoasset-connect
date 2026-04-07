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
import { Loader2, TrendingUp, Package, UserRound, CreditCard, Tag } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
}

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Device Request</DialogTitle>
          <DialogDescription>
            Full fulfillment line: vendor, device, employee delivery, payment, and pricing (matches your tracker sheet).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. Country, vendor, delivery */}
          <div>
            <SectionHeader number={1} title="Country & Vendor" subtitle="Delivery country and supplier" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Country <span className="text-destructive">*</span></Label>
                <Select value={countryId} onValueChange={handleCountryChange}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select country first" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Vendor name</Label>
                <Select value={vendorId} onValueChange={setVendorId} disabled={!countryId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={countryId ? `Vendors in ${selectedCountryName}` : 'Select country first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorsForCountry.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">No vendors for this country</div>
                    ) : (
                      vendorsForCountry.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Expected delivery date</Label>
                <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="h-10" />
              </div>
            </div>
          </div>

          {/* 2–3. Device */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Structured specs</span>
            </div>
            <DeviceSpecForm values={deviceSpec} onChange={setDeviceSpec} sectionNumberStart={2} hideNotes />
            <div className="space-y-2 mt-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Label className="text-sm font-medium">Device info (full line)</Label>
                <Button type="button" variant="outline" size="sm" onClick={fillSummaryFromSpecs}>
                  Fill from specs above
                </Button>
              </div>
              <Textarea
                value={deviceSummary}
                onChange={(e) => setDeviceSummary(e.target.value)}
                placeholder="e.g. M5 Pro chip, 18-core CPU, 20-core GPU, 64GB, 2TB, 16-inch"
                rows={3}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">Shown on reports like your spreadsheet &ldquo;Device Info&rdquo; column.</p>
            </div>
          </div>

          {/* 4. Employee / recipient */}
          <div>
            <SectionHeader number={4} title="Employee / Recipient" subtitle="End user or inventory hold" />
            <div className="flex items-center gap-2 mb-3">
              <Checkbox
                id="inventory"
                checked={shipToInventory}
                onCheckedChange={(c) => setShipToInventory(c === true)}
              />
              <label htmlFor="inventory" className="text-sm cursor-pointer leading-none">
                Ship to Remoasset inventory (no employee yet)
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-sm font-medium">Employee name</Label>
                <Input
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="e.g. Ahmed Gaafer"
                  className="h-10"
                  disabled={shipToInventory}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-sm font-medium">Employee address</Label>
                <Textarea
                  value={employeeAddress}
                  onChange={(e) => setEmployeeAddress(e.target.value)}
                  placeholder="Full street address, city, country"
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Employee phone</Label>
                <Input
                  value={employeePhone}
                  onChange={(e) => setEmployeePhone(e.target.value)}
                  placeholder="e.g. 201007621919"
                  className="h-10"
                  disabled={shipToInventory}
                />
              </div>
            </div>
          </div>

          {/* 5. Payment */}
          <div>
            <SectionHeader number={5} title="Payment" subtitle="Client payment status" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Payment status</Label>
                <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as 'paid' | 'unpaid')}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Date of payment (client)</Label>
                <Input type="date" value={clientPaymentDate} onChange={(e) => setClientPaymentDate(e.target.value)} className="h-10" />
              </div>
            </div>
          </div>

          {/* 6. Pricing — sheet columns */}
          <div>
            <SectionHeader number={6} title="Pricing (USD)" subtitle="MRP · quoted · wire · procurement · profit" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              <Card className="border-[1.5px] border-input shadow-none">
                <CardContent className="p-4 space-y-2">
                  <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">MRP / List</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input type="number" step="0.01" min={0} value={mrpUsd} onChange={(e) => setMrpUsd(e.target.value)} className="h-10 pl-7" placeholder="Optional" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-[1.5px] border-input shadow-none">
                <CardContent className="p-4 space-y-2">
                  <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Price quoted</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input type="number" step="0.01" min={0} value={quotedUsd} onChange={(e) => setQuotedUsd(e.target.value)} className="h-10 pl-7" placeholder="0.00" />
                  </div>
                </CardContent>
              </Card>
              <Card className="border-[1.5px] border-input shadow-none">
                <CardContent className="p-4 space-y-2">
                  <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Wire cost</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input type="number" step="0.01" min={0} value={wireCostUsd} onChange={(e) => setWireCostUsd(e.target.value)} className="h-10 pl-7" placeholder="0.00" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Bank fees (informational)</p>
                </CardContent>
              </Card>
              <Card className="border-[1.5px] border-input shadow-none">
                <CardContent className="p-4 space-y-2">
                  <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Procurement price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input type="number" step="0.01" min={0} value={procurementUsd} onChange={(e) => setProcurementUsd(e.target.value)} className="h-10 pl-7" placeholder="0.00" />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Vendor / landing cost</p>
                </CardContent>
              </Card>
              <Card className="border-[1.5px] border-primary/35 bg-primary/5 shadow-none">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    <TrendingUp className="h-3 w-5 text-primary shrink-0" />
                    Profit (%)
                  </div>
                  <p className="text-xl font-bold tabular-nums">
                    {profitInfo?.profitPctOnProcurement != null
                      ? `${profitInfo.profitPctOnProcurement.toFixed(2)}%`
                      : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">On procurement cost</p>
                </CardContent>
              </Card>
              <Card className="border-[1.5px] border-primary/35 bg-primary/5 shadow-none">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    <CreditCard className="h-3 w-3.5 text-primary shrink-0" />
                    Profit ($)
                  </div>
                  <p className="text-xl font-bold tabular-nums">
                    {profitInfo !== null
                      ? `$${profitInfo.profitAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Quoted − procurement</p>
                </CardContent>
              </Card>
            </div>
            {profitInfo !== null && wireParsed != null && wireParsed > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                After wire: ${(profitInfo.profitAmount - wireParsed).toLocaleString('en-US', { minimumFractionDigits: 2 })} (not stored; for your reference)
              </p>
            )}
            {(mrpQuotedInsight || mrpProcurementInsight) && (
              <Card className="mt-3 border-primary/25 bg-primary/5 shadow-none">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Tag className="h-4 w-4 text-primary" />
                    vs MRP
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {mrpQuotedInsight?.offList && mrpQuotedInsight.pctOfMrp != null && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Client quoted</p>
                        <p className="font-medium">
                          {mrpQuotedInsight.pctOfMrp.toFixed(1)}% of MRP
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mrpQuotedInsight.offList.pctOffMrp.toFixed(1)}% below list · save ${mrpQuotedInsight.offList.savingsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    )}
                    {mrpProcurementInsight && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">Procurement</p>
                        <p className="font-medium">{mrpProcurementInsight.pctOffMrp.toFixed(1)}% below MRP</p>
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              Additional notes
            </Label>
            <Textarea
              value={deviceSpec.notes}
              onChange={(e) => setDeviceSpec({ ...deviceSpec, notes: e.target.value })}
              placeholder="Internal notes, PO references..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
