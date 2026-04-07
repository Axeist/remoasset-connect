import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import type { WarehouseVendorPricing } from '@/types/procurement';

const CHARGE_FIELDS: { key: string; label: string }[] = [
  { key: 'box_procurement_charges', label: 'Box Procurement Charges' },
  { key: 'box_custom_printing_charges', label: 'Box Custom Printing Charges' },
  { key: 'shipping_to_employee', label: 'Sending the Box to Employee (Shipping)' },
  { key: 'retrieve_from_employee', label: 'Retrieve Assets from Employee (Shipping + Offloading)' },
  { key: 'storage_charge', label: 'Storage Charge' },
  { key: 'qc_charges', label: 'QC Charges' },
  { key: 'repair_upgrade_charges', label: 'Repair or Upgradation Charges' },
  { key: 'redeployment_charges', label: 'Redeployment Charges (Preparing + Shipping)' },
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
  const [saving, setSaving] = useState(false);
  const [allVendors, setAllVendors] = useState<{ id: string; company_name: string; country_ids: string[]; vendor_types: string[] | null; warehouse_available: boolean | null }[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);

  const [countryId, setCountryId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [quoteDate, setQuoteDate] = useState(new Date().toISOString().slice(0, 10));
  const [quoteValidityDate, setQuoteValidityDate] = useState('');
  const [notes, setNotes] = useState('');
  const [charges, setCharges] = useState<Record<string, string>>(
    Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0']))
  );

  useEffect(() => {
    if (!open) return;
    supabase.from('leads')
      .select('id, company_name, country_ids, vendor_types, warehouse_available')
      .order('company_name')
      .then(({ data }) => {
        if (data) setAllVendors(data as any);
      });
    supabase.from('countries').select('id, name').order('name').then(({ data }) => {
      if (data) setCountries(data);
    });
  }, [open]);

  useEffect(() => {
    if (editItem) {
      setCountryId(editItem.country_id || '');
      setVendorId(editItem.vendor_id);
      setQuoteDate(editItem.quote_date || new Date().toISOString().slice(0, 10));
      setQuoteValidityDate(editItem.quote_validity_date || '');
      setNotes(editItem.notes || '');
      setCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, String((editItem as any)[f.key] || 0)])));
    } else {
      setCountryId(''); setVendorId('');
      setQuoteDate(new Date().toISOString().slice(0, 10)); setQuoteValidityDate(''); setNotes('');
      setCharges(Object.fromEntries(CHARGE_FIELDS.map((f) => [f.key, '0'])));
    }
  }, [editItem, open]);

  const warehouseVendorsForCountry = (() => {
    let filtered = allVendors.filter((v) =>
      (Array.isArray(v.vendor_types) && v.vendor_types.includes('warehouse')) || v.warehouse_available
    );
    if (countryId) {
      filtered = filtered.filter((v) => Array.isArray(v.country_ids) && v.country_ids.includes(countryId));
    }
    return filtered;
  })();

  const handleCountryChange = (id: string) => {
    setCountryId(id);
    setVendorId('');
  };

  const grandTotal = CHARGE_FIELDS.reduce((sum, f) => sum + (parseFloat(charges[f.key]) || 0), 0);

  const selectedCountryName = countries.find((c) => c.id === countryId)?.name;

  const handleSave = async () => {
    if (!vendorId) {
      toast({ title: 'Vendor required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      vendor_id: vendorId,
      country_id: countryId || null,
      quote_date: quoteDate,
      quote_validity_date: quoteValidityDate || null,
      notes: notes || null,
      currency: 'USD',
      ...(editItem ? {} : { created_by: user?.id }),
    };
    CHARGE_FIELDS.forEach((f) => { payload[f.key] = parseFloat(charges[f.key]) || 0; });

    const { error } = editItem
      ? await supabase.from('warehouse_vendor_pricing' as any).update(payload).eq('id', editItem.id)
      : await supabase.from('warehouse_vendor_pricing' as any).insert(payload);

    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: editItem ? 'Pricing updated' : 'Pricing added' });
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit' : 'Add'} Warehouse Pricing</DialogTitle>
          <DialogDescription>Enter warehouse partner service charges (all in USD).</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Country & Vendor */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <h4 className="font-semibold text-sm">Country & Warehouse Vendor</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Country <span className="text-destructive">*</span></Label>
                <Select value={countryId} onValueChange={handleCountryChange}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select country first" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Warehouse Vendor <span className="text-destructive">*</span></Label>
                <Select value={vendorId} onValueChange={setVendorId} disabled={!countryId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={countryId ? `Warehouse vendors in ${selectedCountryName}` : 'Select country first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseVendorsForCountry.length === 0 ? (
                      <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                        No warehouse vendors found for this country
                      </div>
                    ) : (
                      warehouseVendorsForCountry.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {countryId && (
                  <p className="text-xs text-muted-foreground">
                    {warehouseVendorsForCountry.length} warehouse vendor{warehouseVendorsForCountry.length !== 1 ? 's' : ''} in {selectedCountryName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Charges */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <h4 className="font-semibold text-sm">Service Charges (USD)</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CHARGE_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      value={charges[f.key]}
                      onChange={(e) => setCharges((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="h-9 pl-6 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <span className="font-semibold text-sm">Grand Total</span>
              <span className="text-lg font-bold tabular-nums">${grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Quote dates */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <h4 className="font-semibold text-sm">Quote Details</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Quote Date</Label>
                <Input type="date" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1.5">
                <Label>Quote Validity Date</Label>
                <Input type="date" value={quoteValidityDate} onChange={(e) => setQuoteValidityDate(e.target.value)} className="h-10" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any additional notes..." />
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
