import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeviceSpecForm, type DeviceSpecValues } from '@/components/shared/DeviceSpecForm';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { VendorDevicePricing } from '@/types/procurement';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editItem?: VendorDevicePricing | null;
}

export function AddDevicePricingDialog({ open, onOpenChange, onSuccess, editItem }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; company_name: string }[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string; code: string }[]>([]);

  const [vendorId, setVendorId] = useState('');
  const [countryId, setCountryId] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [quoteValidityDate, setQuoteValidityDate] = useState('');

  const [deviceSpec, setDeviceSpec] = useState<DeviceSpecValues>({
    brand: '', device_model: '', processor: '', display_size: '',
    ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
  });

  useEffect(() => {
    if (!open) return;
    supabase.from('leads').select('id, company_name').order('company_name').then(({ data }) => {
      if (data) setVendors(data);
    });
    supabase.from('countries').select('id, name, code').order('name').then(({ data }) => {
      if (data) setCountries(data);
    });
  }, [open]);

  useEffect(() => {
    if (editItem) {
      setVendorId(editItem.vendor_id);
      setCountryId(editItem.country_id);
      setPriceUsd(String(editItem.price_usd));
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

  const resetForm = () => {
    setVendorId(''); setCountryId(''); setPriceUsd('');
    setQuoteDate(new Date().toISOString().slice(0, 10)); setQuoteValidityDate('');
    setDeviceSpec({
      brand: '', device_model: '', processor: '', display_size: '',
      ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
    });
  };

  const handleSave = async () => {
    if (!vendorId || !countryId || !deviceSpec.brand || !deviceSpec.device_model ||
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Add'} Device Pricing</DialogTitle>
          <DialogDescription>Enter vendor RFP pricing for a device configuration.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Vendor & Country */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <h4 className="font-semibold text-sm">Vendor & Country</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Vendor <span className="text-destructive">*</span></Label>
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Country <span className="text-destructive">*</span></Label>
                <Select value={countryId} onValueChange={setCountryId}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DeviceSpecForm values={deviceSpec} onChange={setDeviceSpec} sectionNumberStart={2} />

          {/* Pricing & Quote */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
              <h4 className="font-semibold text-sm">Pricing & Quote</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Price (USD) <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    className="h-10 pl-7"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Quote Date</Label>
                <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Quote Validity Date</Label>
                <Input type="date" value={quoteValidityDate} onChange={(e) => setQuoteValidityDate(e.target.value)} className="h-10" />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editItem ? 'Update' : 'Add'} Pricing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
