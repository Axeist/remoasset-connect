import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Recycle } from 'lucide-react';
import {
  fetchAllVendors, filterItadVendors, parseMoney, SERVICE_SPEC_PLACEHOLDERS,
} from '@/components/clients/shared/client-request-form-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
}

export function AddItadRequestDialog({ open, onOpenChange, onSuccess, clientId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; company_name: string }[]>([]);

  const [itadServices, setItadServices] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [vendorId, setVendorId] = useState('');
  const [serviceRequestDate, setServiceRequestDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [clientPaymentDate, setClientPaymentDate] = useState('');
  const [quotedUsd, setQuotedUsd] = useState('');
  const [procurementUsd, setProcurementUsd] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    fetchAllVendors().then((all) => {
      const filtered = filterItadVendors(all);
      setVendors(filtered.map(({ id, company_name }) => ({ id, company_name })));
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setItadServices(''); setDeviceInfo(''); setQuantity('1'); setVendorId('');
    setServiceRequestDate(''); setPaymentStatus('unpaid'); setClientPaymentDate('');
    setQuotedUsd(''); setProcurementUsd(''); setNotes('');
  }, [open]);

  const handleSave = async () => {
    if (!itadServices.trim()) {
      toast({
        title: 'Missing services',
        description: 'Describe the ITAD services taken (wipe, recycle, certificate, etc.).',
        variant: 'destructive',
      });
      return;
    }
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    if (qty < 1) {
      toast({ title: 'Invalid quantity', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const summary = [deviceInfo.trim(), `Services: ${itadServices.trim()}`].filter(Boolean).join('\n\n');
    const payload = {
      client_id: clientId,
      request_type: 'itad',
      ...SERVICE_SPEC_PLACEHOLDERS,
      quantity: qty,
      device_summary: summary || itadServices.trim(),
      itad_services: itadServices.trim(),
      vendor_id: vendorId || null,
      service_request_date: serviceRequestDate || null,
      payment_status: paymentStatus,
      client_payment_date: clientPaymentDate || null,
      client_price_usd: parseMoney(quotedUsd),
      vendor_price_usd: parseMoney(procurementUsd),
      notes: notes.trim() || null,
      status: 'pending',
      created_by: user?.id,
    };
    const { error } = await supabase.from('client_requests' as any).insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'ITAD request added', description: `Disposal request for ${qty} device(s) created.` });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Recycle className="h-5 w-5 text-green-500" />
            ITAD — IT asset disposal
          </DialogTitle>
          <DialogDescription>
            Record disposal services, device count, ITAD vendor, and client pricing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>ITAD services taken <span className="text-destructive">*</span></Label>
            <Textarea
              value={itadServices}
              onChange={(e) => setItadServices(e.target.value)}
              rows={3}
              placeholder="e.g. Data wipe, physical destruction, recycling certificate, asset tagging…"
            />
          </div>
          <div className="space-y-2">
            <Label>Device info (optional)</Label>
            <Textarea
              value={deviceInfo}
              onChange={(e) => setDeviceInfo(e.target.value)}
              rows={2}
              placeholder="Types, models, asset tags…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Number of devices <span className="text-destructive">*</span></Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Request date</Label>
              <Input type="date" value={serviceRequestDate} onChange={(e) => setServiceRequestDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>ITAD vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue placeholder="Select ITAD vendor" /></SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Prefers vendors tagged as ITAD; shows all if none tagged.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Client price (USD)</Label>
              <Input type="number" step="0.01" value={quotedUsd} onChange={(e) => setQuotedUsd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Vendor cost (USD)</Label>
              <Input type="number" step="0.01" value={procurementUsd} onChange={(e) => setProcurementUsd(e.target.value)} />
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
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Add ITAD request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
