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
import { Loader2, Ship, X, Paperclip } from 'lucide-react';
import {
  fetchAllVendors, parseMoney, SERVICE_SPEC_PLACEHOLDERS, uploadClientRequestFiles,
} from '@/components/clients/shared/client-request-form-utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  clientId: string;
}

export function AddCrossBorderRequestDialog({ open, onOpenChange, onSuccess, clientId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [vendors, setVendors] = useState<{ id: string; company_name: string }[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [docLabels, setDocLabels] = useState<string[]>([]);

  const [originCountryId, setOriginCountryId] = useState('');
  const [destinationCountryId, setDestinationCountryId] = useState('');
  const [originPocName, setOriginPocName] = useState('');
  const [originPocEmail, setOriginPocEmail] = useState('');
  const [originPocPhone, setOriginPocPhone] = useState('');
  const [destPocName, setDestPocName] = useState('');
  const [destPocEmail, setDestPocEmail] = useState('');
  const [destPocPhone, setDestPocPhone] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [vendorId, setVendorId] = useState('');
  const [quotedUsd, setQuotedUsd] = useState('');
  const [procurementUsd, setProcurementUsd] = useState('');
  const [serviceRequestDate, setServiceRequestDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    supabase.from('countries').select('id, name').order('name').then(({ data }) => {
      if (data) setCountries(data);
    });
    fetchAllVendors().then((v) => setVendors(v.map(({ id, company_name }) => ({ id, company_name }))));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setOriginCountryId(''); setDestinationCountryId('');
    setOriginPocName(''); setOriginPocEmail(''); setOriginPocPhone('');
    setDestPocName(''); setDestPocEmail(''); setDestPocPhone('');
    setDeviceInfo(''); setQuantity('1'); setVendorId('');
    setQuotedUsd(''); setProcurementUsd(''); setServiceRequestDate('');
    setNotes(''); setPendingFiles([]); setDocLabels([]);
  }, [open]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...pendingFiles, ...Array.from(list)];
    setPendingFiles(next);
    setDocLabels((prev) => {
      const added = Array.from(list).map((f) => f.name.replace(/\.[^.]+$/, '') || f.name);
      return [...prev, ...added];
    });
  };

  const removeFile = (index: number) => {
    setPendingFiles((f) => f.filter((_, i) => i !== index));
    setDocLabels((l) => l.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!originCountryId || !destinationCountryId || !deviceInfo.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Origin country, destination country, and device info are required.',
        variant: 'destructive',
      });
      return;
    }
    if (!user) return;
    setSaving(true);

    let attachments: { type: 'file'; url: string; name?: string }[] = [];
    if (pendingFiles.length) {
      const up = await uploadClientRequestFiles(clientId, pendingFiles, user.id);
      if ('error' in up) {
        toast({ title: 'Upload failed', description: up.error, variant: 'destructive' });
        setSaving(false);
        return;
      }
      attachments = up.attachments.map((a, i) => ({
        type: 'file' as const,
        path: a.path,
        name: docLabels[i]?.trim() || a.name,
      }));
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const payload = {
      client_id: clientId,
      request_type: 'cross_border',
      ...SERVICE_SPEC_PLACEHOLDERS,
      quantity: qty,
      device_summary: deviceInfo.trim(),
      origin_country_id: originCountryId,
      destination_country_id: destinationCountryId,
      origin_poc_name: originPocName.trim() || null,
      origin_poc_email: originPocEmail.trim() || null,
      origin_poc_phone: originPocPhone.trim() || null,
      destination_poc_name: destPocName.trim() || null,
      destination_poc_email: destPocEmail.trim() || null,
      destination_poc_phone: destPocPhone.trim() || null,
      vendor_id: vendorId || null,
      service_request_date: serviceRequestDate || null,
      client_price_usd: parseMoney(quotedUsd),
      vendor_price_usd: parseMoney(procurementUsd),
      notes: notes.trim() || null,
      attachments,
      status: 'pending',
      created_by: user.id,
    };
    const { error } = await supabase.from('client_requests' as any).insert(payload);
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Cross-border request added', description: 'International device move recorded.' });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5 text-blue-500" />
            Cross-border shipping
          </DialogTitle>
          <DialogDescription>
            Move devices between countries — POCs in both locations, documentation, device details, and pricing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>From country <span className="text-destructive">*</span></Label>
              <Select value={originCountryId} onValueChange={setOriginCountryId}>
                <SelectTrigger><SelectValue placeholder="Origin" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>To country <span className="text-destructive">*</span></Label>
              <Select value={destinationCountryId} onValueChange={setDestinationCountryId}>
                <SelectTrigger><SelectValue placeholder="Destination" /></SelectTrigger>
                <SelectContent>
                  {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Origin POC</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Name" value={originPocName} onChange={(e) => setOriginPocName(e.target.value)} />
              <Input placeholder="Email" type="email" value={originPocEmail} onChange={(e) => setOriginPocEmail(e.target.value)} />
              <Input placeholder="Phone" value={originPocPhone} onChange={(e) => setOriginPocPhone(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border p-3 space-y-3 bg-muted/20">
            <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">Destination POC</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Input placeholder="Name" value={destPocName} onChange={(e) => setDestPocName(e.target.value)} />
              <Input placeholder="Email" type="email" value={destPocEmail} onChange={(e) => setDestPocEmail(e.target.value)} />
              <Input placeholder="Phone" value={destPocPhone} onChange={(e) => setDestPocPhone(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Device info <span className="text-destructive">*</span></Label>
            <Textarea value={deviceInfo} onChange={(e) => setDeviceInfo(e.target.value)} rows={3} placeholder="Models, serials, packaging…" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Request date</Label>
              <Input type="date" value={serviceRequestDate} onChange={(e) => setServiceRequestDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Quoted (USD)</Label>
              <Input type="number" step="0.01" value={quotedUsd} onChange={(e) => setQuotedUsd(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Procurement (USD)</Label>
              <Input type="number" step="0.01" value={procurementUsd} onChange={(e) => setProcurementUsd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Vendor / logistics partner</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Documentation</Label>
            <p className="text-xs text-muted-foreground">Upload customs, commercial invoice, packing list, or other files. Name each document below.</p>
            <Input type="file" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} className="cursor-pointer" />
            {pendingFiles.length > 0 && (
              <ul className="space-y-2 mt-2">
                {pendingFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex flex-col sm:flex-row gap-2 items-start border rounded-md p-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="text-xs truncate">{f.name}</span>
                    </div>
                    <Input
                      className="h-8 text-xs sm:max-w-[200px]"
                      placeholder="Document name"
                      value={docLabels[i] ?? ''}
                      onChange={(e) => setDocLabels((prev) => {
                        const next = [...prev];
                        next[i] = e.target.value;
                        return next;
                      })}
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeFile(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <Label>Detailed notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Shipping method, incoterms, timelines, special handling…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Add cross-border request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
