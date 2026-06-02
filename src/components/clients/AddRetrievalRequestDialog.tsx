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
import { Loader2, Warehouse } from 'lucide-react';
import {
  fetchAllVendors, parseMoney, SERVICE_SPEC_PLACEHOLDERS,
} from '@/components/clients/shared/client-request-form-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
}

export function AddRetrievalRequestDialog({ open, onOpenChange, onSuccess, clientId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; company_name: string }[]>([]);

  const [deviceInfo, setDeviceInfo] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [serviceRequestDate, setServiceRequestDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [clientPaymentDate, setClientPaymentDate] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [vendorCost, setVendorCost] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    fetchAllVendors().then((v) => setVendors(v.map(({ id, company_name }) => ({ id, company_name }))));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setDeviceInfo(''); setQuantity('1'); setFromAddress(''); setToAddress('');
    setVendorId(''); setServiceRequestDate(''); setPaymentStatus('unpaid');
    setClientPaymentDate(''); setAmountPaid(''); setVendorCost(''); setNotes('');
  }, [open]);

  const handleSave = async () => {
    if (!deviceInfo.trim() || !fromAddress.trim() || !toAddress.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Device info, from address, and to address are required.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const payload = {
      client_id: clientId,
      request_type: 'retrieval_redeployment',
      ...SERVICE_SPEC_PLACEHOLDERS,
      quantity: qty,
      device_summary: deviceInfo.trim(),
      from_address: fromAddress.trim(),
      to_address: toAddress.trim(),
      vendor_id: vendorId || null,
      service_request_date: serviceRequestDate || null,
      payment_status: paymentStatus,
      client_payment_date: clientPaymentDate || null,
      client_price_usd: parseMoney(amountPaid),
      vendor_price_usd: parseMoney(vendorCost),
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
    toast({ title: 'Retrieval request added', description: 'Retrieval, storage & redeployment request created.' });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-violet-500" />
            Retrieval, storage & redeployment
          </DialogTitle>
          <DialogDescription>
            Device pickup, warehouse storage, and redeployment — addresses, vendor, and client payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Device info <span className="text-destructive">*</span></Label>
            <Textarea
              value={deviceInfo}
              onChange={(e) => setDeviceInfo(e.target.value)}
              placeholder="Brand, model, serials, condition…"
              rows={3}
            />
          </div>
          <div className="space-y-2 max-w-[8rem]">
            <Label>Quantity</Label>
            <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>From address (pickup) <span className="text-destructive">*</span></Label>
            <Textarea value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} rows={2} placeholder="Street, city, country" />
          </div>
          <div className="space-y-2">
            <Label>To address (redeploy / deliver) <span className="text-destructive">*</span></Label>
            <Textarea value={toAddress} onChange={(e) => setToAddress(e.target.value)} rows={2} placeholder="Street, city, country" />
          </div>
          <div className="space-y-2">
            <Label>Vendor</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Label>Amount client paid (USD)</Label>
              <Input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label>Vendor cost (USD)</Label>
              <Input type="number" step="0.01" value={vendorCost} onChange={(e) => setVendorCost(e.target.value)} placeholder="0.00" />
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
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Add retrieval request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
