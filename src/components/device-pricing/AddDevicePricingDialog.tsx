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
import { Loader2, Tag } from 'lucide-react';
import { discountVsMrp } from '@/lib/mrp-insights';
import { Card, CardContent } from '@/components/ui/card';
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

  const resetForm = () => {
    setCountryId(''); setVendorId(''); setPriceUsd(''); setMrpUsd('');
    setQuoteDate(new Date().toISOString().slice(0, 10)); setQuoteValidityDate('');
    setDeviceSpec({
      brand: '', device_model: '', processor: '', display_size: '',
      ram: '', storage: '', gpu: '', os: '', quantity: 1, addons: [], notes: '',
    });
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Add'} Device Pricing</DialogTitle>
          <DialogDescription>Enter vendor RFP pricing for a device configuration.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. Country & Vendor */}
          <div>
            <SectionHeader number={1} title="Country & Vendor" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Country <span className="text-destructive">*</span></Label>
                <Select value={countryId} onValueChange={handleCountryChange}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select country first" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Vendor <span className="text-destructive">*</span>
                </Label>
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
                    {vendorsForCountry.length} vendor{vendorsForCountry.length !== 1 ? 's' : ''} serve {selectedCountryName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 2-3. Device Details & Specifications (notes hidden) */}
          <DeviceSpecForm values={deviceSpec} onChange={setDeviceSpec} sectionNumberStart={2} addonsMode="dialog" hideNotes />

          {/* 4. Pricing & Quote */}
          <div>
            <SectionHeader number={4} title="Pricing & Quote" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Vendor quote (USD) <span className="text-destructive">*</span></Label>
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
                <Label className="text-sm font-medium">MRP / List price (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={mrpUsd}
                    onChange={(e) => setMrpUsd(e.target.value)}
                    className="h-10 pl-7"
                    placeholder="Optional"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Compare vendor quote vs typical list / MRP</p>
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
            {mrpInsight && (
              <Card className="mt-4 border-primary/25 bg-primary/5 shadow-none">
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                  <Tag className="h-5 w-5 text-primary shrink-0" />
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

          {/* 5. Additional Notes (after pricing) */}
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
            {editItem ? 'Update' : 'Add'} Pricing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
