import { useState, useEffect, useMemo } from 'react';
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
import { ServiceRequestPricingFields } from '@/components/clients/shared/ServiceRequestPricingFields';
import type { ClientRequest } from '@/types/procurement';
import {
  ensureSelectedVendor,
  fetchCountries, fetchVendorsWithCountries, retrievalVendorsForCountry,
  vendorsForRequestSelect, type VendorWithCountries,
} from '@/components/clients/shared/client-request-form-utils';
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

  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [allVendors, setAllVendors] = useState<VendorWithCountries[]>([]);
  const [countryId, setCountryId] = useState(req.country_id || '');
  const [vendorId, setVendorId] = useState(req.vendor_id || '');
  const [quoted, setQuoted] = useState(req.client_price_usd != null ? String(req.client_price_usd) : '');
  const [landingCost, setLandingCost] = useState(req.vendor_price_usd != null ? String(req.vendor_price_usd) : '');
  const [serviceCost, setServiceCost] = useState(req.service_cost_usd != null ? String(req.service_cost_usd) : '');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>(req.payment_status ?? 'unpaid');
  const [clientPaymentDate, setClientPaymentDate] = useState(req.client_payment_date || '');
  const [serviceRequestDate, setServiceRequestDate] = useState(req.service_request_date || '');
  const [notes, setNotes] = useState(req.notes || '');
  const [deviceSummary, setDeviceSummary] = useState(req.device_summary || '');
  const [fromEmployeeName, setFromEmployeeName] = useState(req.origin_poc_name || '');
  const [fromEmployeePhone, setFromEmployeePhone] = useState(req.origin_poc_phone || '');
  const [fromAddress, setFromAddress] = useState(req.from_address || '');
  const [toEmployeeName, setToEmployeeName] = useState(req.destination_poc_name || '');
  const [toEmployeePhone, setToEmployeePhone] = useState(req.destination_poc_phone || '');
  const [toAddress, setToAddress] = useState(req.to_address || '');
  const [itadServices, setItadServices] = useState(req.itad_services || '');

  const vendors = useMemo(() => {
    if (type === 'retrieval_redeployment' && countryId) {
      const filtered = retrievalVendorsForCountry(allVendors, countryId);
      return ensureSelectedVendor(filtered, allVendors, vendorId, req.vendor?.company_name);
    }
    return vendorsForRequestSelect(allVendors, countryId || req.country_id, vendorId, req.vendor?.company_name);
  }, [allVendors, countryId, req.country_id, type, vendorId, req.vendor?.company_name]);

  const selectedCountryName = countries.find((c) => c.id === countryId)?.name;

  useEffect(() => {
    Promise.all([fetchCountries(), fetchVendorsWithCountries()]).then(([c, v]) => {
      setCountries(c);
      setAllVendors(v);
    });
  }, []);

  useEffect(() => {
    setCountryId(req.country_id || '');
    setVendorId(req.vendor_id || '');
    setQuoted(req.client_price_usd != null ? String(req.client_price_usd) : '');
    setLandingCost(req.vendor_price_usd != null ? String(req.vendor_price_usd) : '');
    setServiceCost(req.service_cost_usd != null ? String(req.service_cost_usd) : '');
    setPaymentStatus(req.payment_status ?? 'unpaid');
    setClientPaymentDate(req.client_payment_date || '');
    setServiceRequestDate(req.service_request_date || '');
    setNotes(req.notes || '');
    setDeviceSummary(req.device_summary || '');
    setFromEmployeeName(req.origin_poc_name || '');
    setFromEmployeePhone(req.origin_poc_phone || '');
    setFromAddress(req.from_address || '');
    setToEmployeeName(req.destination_poc_name || '');
    setToEmployeePhone(req.destination_poc_phone || '');
    setToAddress(req.to_address || '');
    setItadServices(req.itad_services || '');
  }, [req.id, req.updated_at]);

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

  const handleSave = async () => {
    const base: Record<string, unknown> = {
      vendor_id: vendorId || null,
      client_price_usd: quoted ? parseFloat(quoted) : null,
      vendor_price_usd: landingCost ? parseFloat(landingCost) : null,
      service_cost_usd: serviceCost ? parseFloat(serviceCost) : null,
      payment_status: paymentStatus,
      client_payment_date: clientPaymentDate || null,
      service_request_date: serviceRequestDate || null,
      notes: notes.trim() || null,
      device_summary: deviceSummary.trim() || null,
    };
    if (type === 'retrieval_redeployment') {
      base.country_id = countryId || null;
      base.from_address = fromAddress.trim() || null;
      base.to_address = toAddress.trim() || null;
      base.origin_poc_name = fromEmployeeName.trim() || null;
      base.origin_poc_phone = fromEmployeePhone.trim() || null;
      base.destination_poc_name = toEmployeeName.trim() || null;
      base.destination_poc_phone = toEmployeePhone.trim() || null;
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
        {type === 'retrieval_redeployment' && req.qc_required && (
          <Badge variant="secondary" className="text-[10px]">QC</Badge>
        )}
        {type === 'retrieval_redeployment' && req.data_wipe_required && (
          <Badge variant="secondary" className="text-[10px]">Data wipe</Badge>
        )}
        {type === 'retrieval_redeployment' && req.pickup_date && (
          <span className="text-xs text-muted-foreground">Pickup: {req.pickup_date}</span>
        )}
      </div>

      {type === 'retrieval_redeployment' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>From: <span className="text-foreground font-medium capitalize">{req.retrieval_from_type ?? 'employee'}</span></span>
            <span>→</span>
            <span>To: <span className="text-foreground font-medium capitalize">{req.retrieval_to_type ?? 'employee'}</span></span>
            {(req.warehouse_delivery_date || req.receiver_delivery_date) && (
              <span>
                · Deliver: <span className="text-foreground font-medium tabular-nums">{req.warehouse_delivery_date ?? req.receiver_delivery_date}</span>
              </span>
            )}
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Country</span>
            <Select value={countryId} onValueChange={(id) => { setCountryId(id); setVendorId(''); }}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-md border border-border/80 p-3 space-y-2">
              <span className="text-xs font-medium text-foreground">
                From ({req.retrieval_from_type === 'inventory' ? 'inventory' : 'employee'})
              </span>
              {req.retrieval_from_type !== 'inventory' && (
                <>
                  <Input value={fromEmployeeName} onChange={(e) => setFromEmployeeName(e.target.value)} placeholder="Employee name" className="h-9 text-sm" />
                  <Input value={fromEmployeePhone} onChange={(e) => setFromEmployeePhone(e.target.value)} placeholder="Employee phone" className="h-9 text-sm" />
                </>
              )}
              <Textarea value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} rows={2} className="text-sm" placeholder="Address" />
            </div>
            <div className="rounded-md border border-border/80 p-3 space-y-2">
              <span className="text-xs font-medium text-foreground">
                To ({req.retrieval_to_type === 'inventory' ? 'inventory' : 'employee'})
              </span>
              {req.retrieval_to_type !== 'inventory' && (
                <>
                  <Input value={toEmployeeName} onChange={(e) => setToEmployeeName(e.target.value)} placeholder="Employee name" className="h-9 text-sm" />
                  <Input value={toEmployeePhone} onChange={(e) => setToEmployeePhone(e.target.value)} placeholder="Employee phone" className="h-9 text-sm" />
                </>
              )}
              <Textarea value={toAddress} onChange={(e) => setToAddress(e.target.value)} rows={2} className="text-sm" placeholder="Address" />
            </div>
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
          <Select
            value={vendorId || undefined}
            onValueChange={setVendorId}
            disabled={type === 'retrieval_redeployment' && !countryId}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={
                type === 'retrieval_redeployment' && !countryId ? 'Select country first'
                  : type === 'retrieval_redeployment' && vendors.length === 0 ? 'No vendors in country'
                    : selectedCountryName ? `Vendors in ${selectedCountryName}`
                      : 'Vendor'
              } />
            </SelectTrigger>
            <SelectContent className="max-h-[min(320px,50vh)]">
              {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2 xl:col-span-4">
          <ServiceRequestPricingFields
            quoted={quoted}
            onQuotedChange={setQuoted}
            landingCost={landingCost}
            onLandingCostChange={setLandingCost}
            serviceCost={serviceCost}
            onServiceCostChange={setServiceCost}
            compact
          />
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
