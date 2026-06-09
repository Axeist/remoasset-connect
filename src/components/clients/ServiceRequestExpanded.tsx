import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CLIENT_REQUEST_STATUSES } from '@/constants/device-options';
import { getClientRequestTypeMeta } from '@/constants/client-request-types';
import { CLIENT_REQUEST_SELECT, parseAttachments } from '@/lib/client-request-display';
import { clientRequestProfit } from '@/lib/client-request-pricing';
import type { ClientRequest } from '@/types/procurement';
import { ExternalLink, Paperclip, Loader2 } from 'lucide-react';

interface Props {
  req: ClientRequest;
  onStatusChange: (id: string, status: string) => void;
  onRequestUpdated: (req: ClientRequest) => void;
}

export function ServiceRequestExpanded({ req, onStatusChange, onRequestUpdated }: Props) {
  const { toast } = useToast();
  const type = req.request_type ?? 'fulfillment';
  const meta = getClientRequestTypeMeta(type);
  const attachments = parseAttachments(req.attachments);
  const [docLinks, setDocLinks] = useState<{ name: string; href: string }[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [vendors, setVendors] = useState<{ id: string; company_name: string }[]>([]);
  const [vendorId, setVendorId] = useState(req.vendor_id || '');
  const [quoted, setQuoted] = useState(req.client_price_usd != null ? String(req.client_price_usd) : '');
  const [procurement, setProcurement] = useState(req.vendor_price_usd != null ? String(req.vendor_price_usd) : '');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>(req.payment_status ?? 'unpaid');
  const [clientPaymentDate, setClientPaymentDate] = useState(req.client_payment_date || '');
  const [serviceRequestDate, setServiceRequestDate] = useState(req.service_request_date || '');
  const [notes, setNotes] = useState(req.notes || '');
  const [deviceSummary, setDeviceSummary] = useState(req.device_summary || '');
  const [fromAddress, setFromAddress] = useState(req.from_address || '');
  const [toAddress, setToAddress] = useState(req.to_address || '');
  const [itadServices, setItadServices] = useState(req.itad_services || '');

  useEffect(() => {
    supabase.from('leads').select('id, company_name').order('company_name').then(({ data }) => {
      if (data) setVendors(data);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!attachments.length) {
        setDocLinks([]);
        return;
      }
      setDocsLoading(true);
      const links: { name: string; href: string }[] = [];
      for (const a of attachments) {
        if (a.url) {
          links.push({ name: a.name || 'Document', href: a.url });
          continue;
        }
        if (a.path) {
          const { data, error } = await supabase.storage
            .from('client-request-documents')
            .createSignedUrl(a.path, 3600);
          if (!error && data?.signedUrl) {
            links.push({ name: a.name || 'Document', href: data.signedUrl });
          }
        }
      }
      if (!cancelled) {
        setDocLinks(links);
        setDocsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [req.id, req.attachments]);

  const profitLive =
    procurement !== '' && quoted !== ''
      ? clientRequestProfit(parseFloat(procurement), parseFloat(quoted))
      : null;

  const handleSave = async () => {
    const base: Record<string, unknown> = {
      vendor_id: vendorId || null,
      client_price_usd: quoted ? parseFloat(quoted) : null,
      vendor_price_usd: procurement ? parseFloat(procurement) : null,
      payment_status: paymentStatus,
      client_payment_date: clientPaymentDate || null,
      service_request_date: serviceRequestDate || null,
      notes: notes.trim() || null,
      device_summary: deviceSummary.trim() || null,
    };
    if (type === 'retrieval_redeployment') {
      base.from_address = fromAddress.trim() || null;
      base.to_address = toAddress.trim() || null;
    }
    if (type === 'itad') {
      base.itad_services = itadServices.trim() || null;
    }
    const { data, error } = await supabase.from('client_requests' as any)
      .update(base)
      .eq('id', req.id)
      .select(CLIENT_REQUEST_SELECT)
      .single();
    if (error || !data) {
      toast({
        title: 'Could not save',
        description: error?.message ?? 'No rows were updated.',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Saved' });
      onRequestUpdated(data as ClientRequest);
    }
  };

  return (
    <div className="px-3 sm:px-4 py-3 space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="text-xs border" style={{
          backgroundColor: `${meta.color}20`,
          color: meta.color,
          borderColor: `${meta.color}40`,
        }}>
          {meta.label}
        </Badge>
        {req.service_request_date && (
          <span className="text-xs text-muted-foreground">Request date: {req.service_request_date}</span>
        )}
      </div>

      {type === 'retrieval_redeployment' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">From address</span>
            <Textarea value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">To address</span>
            <Textarea value={toAddress} onChange={(e) => setToAddress(e.target.value)} rows={2} className="text-sm" />
          </div>
        </div>
      )}

      {type === 'cross_border' && (
        <div className="text-sm space-y-1 rounded-md border border-border/80 bg-muted/20 px-3 py-2">
          <p>
            <span className="text-muted-foreground">Route: </span>
            <span className="font-medium">{req.origin_country?.name ?? '—'} → {req.destination_country?.name ?? '—'}</span>
          </p>
          {(req.origin_poc_name || req.destination_poc_name) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs mt-2">
              <div>
                <span className="text-muted-foreground block mb-0.5">Origin POC</span>
                {req.origin_poc_name && <span className="font-medium">{req.origin_poc_name}</span>}
                {req.origin_poc_email && <span className="block">{req.origin_poc_email}</span>}
                {req.origin_poc_phone && <span className="block">{req.origin_poc_phone}</span>}
              </div>
              <div>
                <span className="text-muted-foreground block mb-0.5">Destination POC</span>
                {req.destination_poc_name && <span className="font-medium">{req.destination_poc_name}</span>}
                {req.destination_poc_email && <span className="block">{req.destination_poc_email}</span>}
                {req.destination_poc_phone && <span className="block">{req.destination_poc_phone}</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {type === 'itad' && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">ITAD services</span>
          <Textarea value={itadServices} onChange={(e) => setItadServices(e.target.value)} rows={3} className="text-sm" />
        </div>
      )}

      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Device info</span>
        <Textarea value={deviceSummary} onChange={(e) => setDeviceSummary(e.target.value)} rows={3} className="text-sm" />
      </div>

      {attachments.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Paperclip className="h-3 w-3" /> Documentation
            {docsLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </span>
          <ul className="mt-1 space-y-1">
            {docLinks.map((a, i) => (
              <li key={i}>
                <a
                  href={a.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  {a.name}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 border-t border-border/50 pt-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Vendor</span>
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Vendor" /></SelectTrigger>
            <SelectContent>
              {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Client price (USD)</span>
          <Input type="number" step="0.01" value={quoted} onChange={(e) => setQuoted(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Vendor cost (USD)</span>
          <Input type="number" step="0.01" value={procurement} onChange={(e) => setProcurement(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Profit</span>
          <Input readOnly className="h-9 text-sm bg-muted/50 tabular-nums" value={profitLive != null ? profitLive.profitAmount.toFixed(2) : '—'} />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Payment</span>
          <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as 'paid' | 'unpaid')}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Payment date</span>
          <Input type="date" value={clientPaymentDate} onChange={(e) => setClientPaymentDate(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Request date</span>
          <Input type="date" value={serviceRequestDate} onChange={(e) => setServiceRequestDate(e.target.value)} className="h-9 text-sm" />
        </div>
        <div className="space-y-1 flex flex-col justify-end">
          <span className="text-xs text-muted-foreground">Status</span>
          <Select value={req.status} onValueChange={(v) => onStatusChange(req.id, v)}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CLIENT_REQUEST_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {notes && (
        <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2">
          <span className="text-xs text-muted-foreground font-medium">Notes</span>
          <p className="text-sm mt-1 whitespace-pre-wrap">{notes}</p>
        </div>
      )}

      <Button size="sm" onClick={handleSave}>Save changes</Button>
    </div>
  );
}
