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
import { DeviceSpecForm, SectionHeader, type DeviceSpecValues } from '@/components/shared/DeviceSpecForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
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
  const [vendorPriceUsd, setVendorPriceUsd] = useState('');
  const [clientPriceUsd, setClientPriceUsd] = useState('');

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
      setVendorPriceUsd(''); setClientPriceUsd('');
      setDeviceSpec({
        brand: '', device_model: '', processor: '', display_size: '',
        ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
      });
    }
  }, [open]);

  const marginCalc = useMemo(() => {
    const v = parseFloat(vendorPriceUsd);
    const c = parseFloat(clientPriceUsd);
    if (Number.isNaN(v) || Number.isNaN(c)) return null;
    const marginUsd = c - v;
    const marginPct = c !== 0 ? (marginUsd / c) * 100 : null;
    return { marginUsd, marginPct };
  }, [vendorPriceUsd, clientPriceUsd]);

  const vendorsForCountry = countryId
    ? allVendors.filter((v) => Array.isArray(v.country_ids) && v.country_ids.includes(countryId))
    : allVendors;

  const handleCountryChange = (id: string) => {
    setCountryId(id);
    setVendorId('');
  };

  const selectedCountryName = countries.find((c) => c.id === countryId)?.name;

  const handleSave = async () => {
    if (!countryId || !deviceSpec.brand || !deviceSpec.device_model || !deviceSpec.processor ||
        !deviceSpec.display_size || !deviceSpec.ram || !deviceSpec.storage) {
      toast({ title: 'Missing fields', description: 'Please fill country and all required device details.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const vPrice = parseFloat(vendorPriceUsd);
    const cPrice = parseFloat(clientPriceUsd);
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
      vendor_price_usd: !Number.isNaN(vPrice) ? vPrice : null,
      client_price_usd: !Number.isNaN(cPrice) ? cPrice : null,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Device Request</DialogTitle>
          <DialogDescription>Create a new laptop fulfillment request for this client.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. Country, Vendor & Delivery */}
          <div>
            <SectionHeader number={1} title="Country & Delivery" subtitle="Where and when to ship" />
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
                <Label className="text-sm font-medium">Vendor</Label>
                <Select value={vendorId} onValueChange={setVendorId} disabled={!countryId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={countryId ? `Vendors in ${selectedCountryName}` : 'Select country first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorsForCountry.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
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
                    {vendorsForCountry.length} vendor{vendorsForCountry.length !== 1 ? 's' : ''} in {selectedCountryName}
                    {!vendorId && ' · can assign later'}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Expected Delivery Date</Label>
                <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="h-10" />
              </div>
            </div>
          </div>

          {/* 2-3. Device Details & Specifications (add-ons only; notes below pricing) */}
          <DeviceSpecForm values={deviceSpec} onChange={setDeviceSpec} sectionNumberStart={2} hideNotes />

          {/* 4. Pricing — vendor vs client & margin */}
          <div>
            <SectionHeader number={4} title="Pricing" subtitle="USD per line item" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="border-[1.5px] border-input shadow-none">
                <CardContent className="p-4 pt-4 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Vendor price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={vendorPriceUsd}
                      onChange={(e) => setVendorPriceUsd(e.target.value)}
                      className="h-10 pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Your cost from vendor</p>
                </CardContent>
              </Card>
              <Card className="border-[1.5px] border-input shadow-none">
                <CardContent className="p-4 pt-4 space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client quoted</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={clientPriceUsd}
                      onChange={(e) => setClientPriceUsd(e.target.value)}
                      className="h-10 pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Price quoted to client</p>
                </CardContent>
              </Card>
              <Card className="border-[1.5px] border-primary/35 bg-primary/5 shadow-none">
                <CardContent className="p-4 pt-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <TrendingUp className="h-3.5 w-3.5 text-primary" />
                    Our margin
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-foreground">
                    {marginCalc !== null
                      ? `$${marginCalc.marginUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'}
                  </p>
                  {marginCalc !== null && marginCalc.marginPct !== null && (
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {marginCalc.marginPct.toFixed(1)}% of client price
                    </p>
                  )}
                  {(vendorPriceUsd || clientPriceUsd) && marginCalc === null && (
                    <p className="text-[11px] text-muted-foreground">Enter both amounts to calculate</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Additional Notes</Label>
            <Textarea
              value={deviceSpec.notes}
              onChange={(e) => setDeviceSpec({ ...deviceSpec, notes: e.target.value })}
              placeholder="Any specific requirements, preferences, or instructions..."
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
