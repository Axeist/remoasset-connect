import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { SectionHeader } from '@/components/shared/DeviceSpecForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Loader2, Warehouse, Check, X, Paperclip, ImagePlus } from 'lucide-react';
import {
  fetchCountries, fetchVendorsWithCountries, parseMoney, REMOASSET_INVENTORY_LABEL,
  retrievalVendorsForCountry, SERVICE_SPEC_PLACEHOLDERS, uploadClientRequestFiles,
  type RetrievalEndpointType, type VendorWithCountries,
} from '@/components/clients/shared/client-request-form-utils';
import { ServiceRequestPricingFields } from '@/components/clients/shared/ServiceRequestPricingFields';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
}

const ALL_STEPS = [
  { key: 'route', label: 'Route', title: 'Pickup & destination', description: 'Country, vendor, and whether pickup/delivery is an employee or Remoasset inventory.' },
  { key: 'device', label: 'Device', title: 'Device & services', description: 'What is being moved and whether QC or data wipe is required.' },
  { key: 'schedule', label: 'Dates', title: 'Pickup & delivery schedule', description: 'Pickup date plus warehouse or receiver delivery depending on destination.' },
  { key: 'qc', label: 'QC photos', title: 'QC documentation', description: 'Upload photos for quality check reference.' },
  { key: 'finish', label: 'Finish', title: 'Payment & submit', description: 'Client payment and internal notes.' },
] as const;

function EndpointToggle({
  label, value, onChange,
}: {
  label: string;
  value: RetrievalEndpointType;
  onChange: (v: RetrievalEndpointType) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={value === 'employee' ? 'default' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={() => onChange('employee')}
        >
          Employee
        </Button>
        <Button
          type="button"
          variant={value === 'inventory' ? 'default' : 'outline'}
          size="sm"
          className="flex-1"
          onClick={() => onChange('inventory')}
        >
          Remoasset inventory
        </Button>
      </div>
    </div>
  );
}

export function AddRetrievalRequestDialog({ open, onOpenChange, onSuccess, clientId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [allVendors, setAllVendors] = useState<VendorWithCountries[]>([]);

  const [countryId, setCountryId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [fromType, setFromType] = useState<RetrievalEndpointType>('employee');
  const [toType, setToType] = useState<RetrievalEndpointType>('employee');
  const [fromEmployeeName, setFromEmployeeName] = useState('');
  const [fromEmployeePhone, setFromEmployeePhone] = useState('');
  const [fromAddress, setFromAddress] = useState('');
  const [toEmployeeName, setToEmployeeName] = useState('');
  const [toEmployeePhone, setToEmployeePhone] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [inventoryFromLocation, setInventoryFromLocation] = useState('');
  const [inventoryToLocation, setInventoryToLocation] = useState('');

  const [deviceInfo, setDeviceInfo] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [qcRequired, setQcRequired] = useState(false);
  const [dataWipeRequired, setDataWipeRequired] = useState(false);

  const [pickupDate, setPickupDate] = useState('');
  const [warehouseDeliveryDate, setWarehouseDeliveryDate] = useState('');
  const [receiverDeliveryDate, setReceiverDeliveryDate] = useState('');

  const [qcPhotos, setQcPhotos] = useState<File[]>([]);
  const [serviceRequestDate, setServiceRequestDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [clientPaymentDate, setClientPaymentDate] = useState('');
  const [quotedUsd, setQuotedUsd] = useState('');
  const [landingCostUsd, setLandingCostUsd] = useState('');
  const [serviceCostUsd, setServiceCostUsd] = useState('');
  const [notes, setNotes] = useState('');

  const vendors = useMemo(() => retrievalVendorsForCountry(allVendors, countryId), [allVendors, countryId]);
  const selectedCountryName = countries.find((c) => c.id === countryId)?.name;

  const visibleSteps = useMemo(
    () => ALL_STEPS.filter((s) => s.key !== 'qc' || qcRequired),
    [qcRequired],
  );
  const lastStepIndex = visibleSteps.length - 1;
  const meta = visibleSteps[step] ?? visibleSteps[0];
  const currentKey = meta?.key;

  useEffect(() => {
    if (!open) return;
    Promise.all([fetchCountries(), fetchVendorsWithCountries()]).then(([c, v]) => {
      setCountries(c);
      setAllVendors(v);
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setCountryId(''); setVendorId('');
    setFromType('employee'); setToType('employee');
    setFromEmployeeName(''); setFromEmployeePhone(''); setFromAddress('');
    setToEmployeeName(''); setToEmployeePhone(''); setToAddress('');
    setInventoryFromLocation(''); setInventoryToLocation('');
    setDeviceInfo(''); setQuantity('1'); setQcRequired(false); setDataWipeRequired(false);
    setPickupDate(''); setWarehouseDeliveryDate(''); setReceiverDeliveryDate('');
    setQcPhotos([]);
    setServiceRequestDate(''); setPaymentStatus('unpaid');
    setClientPaymentDate(''); setQuotedUsd(''); setLandingCostUsd(''); setServiceCostUsd(''); setNotes('');
  }, [open]);

  useEffect(() => {
    if (fromType === 'inventory') {
      setFromEmployeeName('');
      setFromEmployeePhone('');
    }
  }, [fromType]);

  useEffect(() => {
    if (toType === 'inventory') {
      setToEmployeeName('');
      setToEmployeePhone('');
    }
  }, [toType]);

  useEffect(() => {
    if (step > lastStepIndex) setStep(lastStepIndex);
  }, [step, lastStepIndex]);

  const handleCountryChange = (id: string) => {
    setCountryId(id);
    setVendorId('');
  };

  const resolvedFromAddress = () => {
    if (fromType === 'inventory') {
      const loc = inventoryFromLocation.trim();
      return loc ? `${REMOASSET_INVENTORY_LABEL} — ${loc}` : REMOASSET_INVENTORY_LABEL;
    }
    return fromAddress.trim();
  };

  const resolvedToAddress = () => {
    if (toType === 'inventory') {
      const loc = inventoryToLocation.trim();
      return loc ? `${REMOASSET_INVENTORY_LABEL} — ${loc}` : REMOASSET_INVENTORY_LABEL;
    }
    return toAddress.trim();
  };

  const addQcPhotos = (list: FileList | null) => {
    if (!list?.length) return;
    setQcPhotos((prev) => [...prev, ...Array.from(list)]);
  };

  const removeQcPhoto = (index: number) => {
    setQcPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const validateStep = (key: string): boolean => {
    if (key === 'route') {
      if (!countryId) {
        toast({ title: 'Select a country', description: 'Country is required to find warehouse vendors.', variant: 'destructive' });
        return false;
      }
      if (fromType === 'employee' && !fromAddress.trim()) {
        toast({ title: 'From address required', description: 'Enter the pickup address for the employee.', variant: 'destructive' });
        return false;
      }
      if (toType === 'employee' && !toAddress.trim()) {
        toast({ title: 'To address required', description: 'Enter the delivery address for the employee.', variant: 'destructive' });
        return false;
      }
      if (toType === 'inventory' && !inventoryToLocation.trim()) {
        toast({ title: 'Warehouse location required', description: 'Enter the inventory / warehouse destination.', variant: 'destructive' });
        return false;
      }
      return true;
    }
    if (key === 'device') {
      if (!deviceInfo.trim()) {
        toast({ title: 'Device info required', variant: 'destructive' });
        return false;
      }
      return true;
    }
    if (key === 'schedule') {
      if (!pickupDate) {
        toast({ title: 'Pickup date required', variant: 'destructive' });
        return false;
      }
      if (toType === 'inventory' && !warehouseDeliveryDate) {
        toast({ title: 'Warehouse delivery date required', description: 'When should the device arrive at inventory?', variant: 'destructive' });
        return false;
      }
      if (toType === 'employee' && !receiverDeliveryDate) {
        toast({ title: 'Receiver delivery date required', description: 'When should the device reach the employee?', variant: 'destructive' });
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentKey)) return;
    setStep((s) => Math.min(s + 1, lastStepIndex));
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSave = async () => {
    if (!validateStep('route') || !validateStep('device') || !validateStep('schedule')) return;
    if (!user) return;
    setSaving(true);

    const attachments: { type: 'file'; path?: string; name?: string }[] = [];
    if (qcRequired && qcPhotos.length) {
      const up = await uploadClientRequestFiles(clientId, qcPhotos, user.id);
      if ('error' in up) {
        toast({ title: 'QC photo upload failed', description: up.error, variant: 'destructive' });
        setSaving(false);
        return;
      }
      attachments.push(...up.attachments.map((a) => ({
        type: 'file' as const,
        path: a.path,
        name: `QC: ${a.name ?? 'photo'}`,
      })));
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const payload = {
      client_id: clientId,
      request_type: 'retrieval_redeployment',
      country_id: countryId,
      ...SERVICE_SPEC_PLACEHOLDERS,
      quantity: qty,
      device_summary: deviceInfo.trim(),
      retrieval_from_type: fromType,
      retrieval_to_type: toType,
      from_address: resolvedFromAddress(),
      to_address: resolvedToAddress(),
      origin_poc_name: fromType === 'employee' ? (fromEmployeeName.trim() || null) : null,
      origin_poc_phone: fromType === 'employee' ? (fromEmployeePhone.trim() || null) : null,
      destination_poc_name: toType === 'employee' ? (toEmployeeName.trim() || null) : null,
      destination_poc_phone: toType === 'employee' ? (toEmployeePhone.trim() || null) : null,
      qc_required: qcRequired,
      data_wipe_required: dataWipeRequired,
      pickup_date: pickupDate || null,
      warehouse_delivery_date: toType === 'inventory' ? (warehouseDeliveryDate || null) : null,
      receiver_delivery_date: toType === 'employee' ? (receiverDeliveryDate || null) : null,
      shipping_date: pickupDate || null,
      delivery_date: toType === 'inventory' ? (warehouseDeliveryDate || null) : (receiverDeliveryDate || null),
      vendor_id: vendorId || null,
      service_request_date: serviceRequestDate || null,
      payment_status: paymentStatus,
      client_payment_date: clientPaymentDate || null,
      client_price_usd: parseMoney(quotedUsd),
      vendor_price_usd: parseMoney(landingCostUsd),
      service_cost_usd: parseMoney(serviceCostUsd),
      notes: notes.trim() || null,
      attachments,
      status: 'pending',
      created_by: user.id,
    };

    const { error } = await supabase.from('client_requests' as any).insert(payload);
    setSaving(false);
    if (error) {
      toast({
        title: 'Error',
        description: error.message.includes('column')
          ? `${error.message} — run the latest Supabase migration (retrieval fields).`
          : error.message,
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Retrieval request added', description: 'Retrieval, storage & redeployment request created.' });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-[min(92vh,880px)] max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:w-full sm:rounded-xl">
        <DialogHeader className="px-6 pt-6 pb-4 pr-14 space-y-4 shrink-0 border-b border-border/60">
          <div>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-violet-500" />
              Retrieval, storage & redeployment
            </DialogTitle>
            <DialogDescription className="text-sm mt-1.5">
              Step-by-step — route, services, dates, QC photos, then payment.
            </DialogDescription>
          </div>

          <nav aria-label="Form progress" className="flex gap-1.5 sm:gap-2">
            {visibleSteps.map((s, i) => {
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
                    i <= step ? 'cursor-pointer hover:bg-muted/80' : 'cursor-not-allowed opacity-50',
                    active && 'bg-primary/10 ring-1 ring-primary/30',
                  )}
                >
                  <div className={cn('h-1 rounded-full mb-2', done ? 'bg-primary' : active ? 'bg-primary/70' : 'bg-muted')} />
                  <div className="flex items-center gap-1">
                    {done && <Check className="h-3 w-3 text-primary shrink-0 hidden sm:block" />}
                    <span className={cn('text-[10px] sm:text-xs font-semibold uppercase tracking-wide truncate', active && 'text-primary')}>
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

        <div className="min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]">
          <div className="space-y-6 px-6 py-5 pb-8">
            {currentKey === 'route' && (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <SectionHeader number={1} title="Country & vendor" subtitle="Warehouse partners operating in this country" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label>Country <span className="text-destructive">*</span></Label>
                    <Select value={countryId} onValueChange={handleCountryChange}>
                      <SelectTrigger className="h-11 rounded-[10px]"><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor</Label>
                    <Select value={vendorId} onValueChange={setVendorId} disabled={!countryId}>
                      <SelectTrigger className="h-11 rounded-[10px]">
                        <SelectValue placeholder={
                          !countryId ? 'Select country first'
                            : vendors.length === 0 ? 'No warehouse vendors'
                              : `Vendors in ${selectedCountryName}`
                        } />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="rounded-xl border border-border/80 p-4 space-y-4">
                    <EndpointToggle label="From (pickup)" value={fromType} onChange={setFromType} />
                    {fromType === 'employee' ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Employee name</Label>
                            <Input value={fromEmployeeName} onChange={(e) => setFromEmployeeName(e.target.value)} placeholder="Contact name" />
                          </div>
                          <div className="space-y-2">
                            <Label>Employee phone</Label>
                            <Input value={fromEmployeePhone} onChange={(e) => setFromEmployeePhone(e.target.value)} placeholder="+1 555 0100" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Pickup address <span className="text-destructive">*</span></Label>
                          <Textarea value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} rows={2} placeholder="Street, city" />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label>Inventory location (optional)</Label>
                        <Input
                          value={inventoryFromLocation}
                          onChange={(e) => setInventoryFromLocation(e.target.value)}
                          placeholder="Warehouse site or bin reference"
                        />
                        <p className="text-xs text-muted-foreground">Pickup from {REMOASSET_INVENTORY_LABEL}</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-border/80 p-4 space-y-4">
                    <EndpointToggle label="To (redeploy / deliver)" value={toType} onChange={setToType} />
                    {toType === 'employee' ? (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Employee name</Label>
                            <Input value={toEmployeeName} onChange={(e) => setToEmployeeName(e.target.value)} placeholder="Contact name" />
                          </div>
                          <div className="space-y-2">
                            <Label>Employee phone</Label>
                            <Input value={toEmployeePhone} onChange={(e) => setToEmployeePhone(e.target.value)} placeholder="+1 555 0100" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Delivery address <span className="text-destructive">*</span></Label>
                          <Textarea value={toAddress} onChange={(e) => setToAddress(e.target.value)} rows={2} placeholder="Street, city" />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label>Warehouse / inventory location <span className="text-destructive">*</span></Label>
                        <Textarea
                          value={inventoryToLocation}
                          onChange={(e) => setInventoryToLocation(e.target.value)}
                          rows={2}
                          placeholder="Warehouse address or site name"
                        />
                        <p className="text-xs text-muted-foreground">Delivering to {REMOASSET_INVENTORY_LABEL}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentKey === 'device' && (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <SectionHeader number={2} title="Device details" subtitle="What is being retrieved or redeployed" />
                <div className="space-y-2">
                  <Label>Device info <span className="text-destructive">*</span></Label>
                  <Textarea value={deviceInfo} onChange={(e) => setDeviceInfo(e.target.value)} rows={3} placeholder="Brand, model, serials, condition…" />
                </div>
                <div className="space-y-2 max-w-[8rem]">
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
                </div>

                <SectionHeader number={3} title="Warehouse services" subtitle="Optional processing at the warehouse" />
                <div className="space-y-3 rounded-xl border border-border/80 p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox checked={qcRequired} onCheckedChange={(v) => setQcRequired(v === true)} />
                    <div>
                      <p className="text-sm font-medium">Quality check (QC)</p>
                      <p className="text-xs text-muted-foreground">Inspect device condition on intake — you can upload reference photos on the next QC step.</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox checked={dataWipeRequired} onCheckedChange={(v) => setDataWipeRequired(v === true)} />
                    <div>
                      <p className="text-sm font-medium">Data wipe</p>
                      <p className="text-xs text-muted-foreground">Secure wipe before storage or redeployment to another employee.</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {currentKey === 'schedule' && (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <SectionHeader number={4} title="Schedule" subtitle="When pickup and delivery should happen" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-xl">
                  <div className="space-y-2">
                    <Label>Pickup date <span className="text-destructive">*</span></Label>
                    <Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="h-11" />
                  </div>
                  {toType === 'inventory' ? (
                    <div className="space-y-2">
                      <Label>Warehouse delivery date <span className="text-destructive">*</span></Label>
                      <Input type="date" value={warehouseDeliveryDate} onChange={(e) => setWarehouseDeliveryDate(e.target.value)} className="h-11" />
                      <p className="text-xs text-muted-foreground">When the device should arrive at inventory.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Receiver delivery date <span className="text-destructive">*</span></Label>
                      <Input type="date" value={receiverDeliveryDate} onChange={(e) => setReceiverDeliveryDate(e.target.value)} className="h-11" />
                      <p className="text-xs text-muted-foreground">When the employee should receive the device.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentKey === 'qc' && (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <SectionHeader number={5} title="QC photos" subtitle="Optional reference images for quality check" />
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-muted/20 px-6 py-10 cursor-pointer hover:bg-muted/40 transition-colors">
                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm font-medium">Upload QC photos</span>
                  <span className="text-xs text-muted-foreground">JPEG, PNG, or PDF</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    multiple
                    className="sr-only"
                    onChange={(e) => { addQcPhotos(e.target.files); e.target.value = ''; }}
                  />
                </label>
                {qcPhotos.length > 0 && (
                  <ul className="space-y-2">
                    {qcPhotos.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-border/80 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2 truncate">
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {f.name}
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeQcPhoto(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {currentKey === 'finish' && (
              <div className="space-y-6 animate-in fade-in-0 duration-200">
                <SectionHeader number={6} title="Pricing & payment" subtitle="Quoted price, landing and service costs, profit" />
                <ServiceRequestPricingFields
                  quoted={quotedUsd}
                  onQuotedChange={setQuotedUsd}
                  landingCost={landingCostUsd}
                  onLandingCostChange={setLandingCostUsd}
                  serviceCost={serviceCostUsd}
                  onServiceCostChange={setServiceCostUsd}
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Date of request</Label>
                    <Input type="date" value={serviceRequestDate} onChange={(e) => setServiceRequestDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment status</Label>
                    <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as 'paid' | 'unpaid')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment date</Label>
                    <Input type="date" value={clientPaymentDate} onChange={(e) => setClientPaymentDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Internal notes…" />
                </div>

                <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm space-y-2">
                  <p className="font-medium">Summary</p>
                  <ul className="text-muted-foreground space-y-1">
                    <li><span className="text-foreground">Route:</span> {fromType === 'inventory' ? 'Inventory' : 'Employee'} → {toType === 'inventory' ? 'Inventory' : 'Employee'} · {selectedCountryName ?? '—'}</li>
                    <li><span className="text-foreground">Pickup:</span> {pickupDate || '—'}{toType === 'inventory' && warehouseDeliveryDate ? ` · Warehouse by ${warehouseDeliveryDate}` : receiverDeliveryDate ? ` · Deliver by ${receiverDeliveryDate}` : ''}</li>
                    {(qcRequired || dataWipeRequired) && (
                      <li><span className="text-foreground">Services:</span> {[qcRequired && 'QC', dataWipeRequired && 'Data wipe'].filter(Boolean).join(', ')}</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/60 shrink-0 flex-row justify-between sm:justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => (step === 0 ? onOpenChange(false) : handleBack())}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < lastStepIndex ? (
            <Button type="button" onClick={handleNext}>Continue</Button>
          ) : (
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Add retrieval request
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
