import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Plus, Globe2, Mail, Phone, User, Package,
  CheckCircle2, Truck, Clock, DollarSign, ChevronDown, ChevronRight, Edit,
} from 'lucide-react';
import { AddRequestDialog } from '@/components/clients/AddRequestDialog';
import { CLIENT_REQUEST_STATUSES } from '@/constants/device-options';
import type { Client, ClientRequest } from '@/types/procurement';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [client, setClient] = useState<Client | null>(null);
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [addReqOpen, setAddReqOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: cData, error: cErr }, { data: rData }] = await Promise.all([
      supabase.from('clients' as any)
        .select('*, country:countries!country_id(name, code)')
        .eq('id', id).single(),
      supabase.from('client_requests' as any)
        .select('*, vendor:leads!vendor_id(company_name), country:countries!country_id(name, code)')
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
    ]);
    if (cErr) {
      toast({ title: 'Client not found', variant: 'destructive' });
      navigate('/clients');
      return;
    }
    setClient(cData as any);
    setRequests((rData as any) || []);
    setLoading(false);
  }, [id, toast, navigate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const total = requests.length;
    const fulfilled = requests.filter((r) => r.status === 'fulfilled').length;
    const inTransit = requests.filter((r) => r.status === 'in_transit').length;
    const pending = requests.filter((r) => ['pending', 'vendor_allocated', 'ordered'].includes(r.status)).length;
    const totalSpend = requests
      .filter((r) => r.client_price_usd)
      .reduce((a, r) => a + (Number(r.client_price_usd) * r.quantity), 0);
    return { total, fulfilled, inTransit, pending, totalSpend };
  }, [requests]);

  const handleStatusChange = async (reqId: string, newStatus: string) => {
    const { error } = await supabase.from('client_requests' as any).update({ status: newStatus }).eq('id', reqId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      fetchData();
    }
  };

  const handleAllocateVendor = async (reqId: string, vendorId: string, vendorPrice: string) => {
    const { error } = await supabase.from('client_requests' as any).update({
      vendor_id: vendorId,
      vendor_price_usd: vendorPrice ? parseFloat(vendorPrice) : null,
      status: 'vendor_allocated',
    }).eq('id', reqId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vendor allocated' });
      fetchData();
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="max-w-[1400px] mx-auto space-y-4 px-2 sm:px-0">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!client) return null;

  return (
    <AppLayout>
      <div className="max-w-[1400px] mx-auto space-y-4 sm:space-y-6 px-2 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/clients')} className="gap-1 -ml-2 mb-1 text-muted-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Clients
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
              {client.country && (
                <span className="flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" />{client.country.name}</span>
              )}
              {client.contact_name && (
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{client.contact_name}</span>
              )}
              {client.contact_email && (
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.contact_email}</span>
              )}
              {client.contact_phone && (
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.contact_phone}</span>
              )}
            </div>
          </div>
          <Button onClick={() => setAddReqOpen(true)} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Add Request
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Package className="h-3.5 w-3.5" /> Total Requests</div>
            <p className="text-xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><CheckCircle2 className="h-3.5 w-3.5" /> Fulfilled</div>
            <p className="text-xl font-bold text-green-600">{stats.fulfilled}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Truck className="h-3.5 w-3.5" /> In Transit</div>
            <p className="text-xl font-bold text-blue-600">{stats.inTransit}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Clock className="h-3.5 w-3.5" /> Pending</div>
            <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><DollarSign className="h-3.5 w-3.5" /> Total Spend</div>
            <p className="text-xl font-bold">${stats.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </Card>
        </div>

        {/* Requests Table */}
        <Card>
          <CardContent className="p-0">
            {requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <h3 className="font-semibold text-lg">No requests yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Add the first device request for this client.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Device</TableHead>
                      <TableHead>Specs</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Vendor Price</TableHead>
                      <TableHead className="text-right">Client Price</TableHead>
                      <TableHead>Shipping</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => {
                      const isExpanded = expandedId === req.id;
                      const statusInfo = CLIENT_REQUEST_STATUSES.find((s) => s.value === req.status);
                      return (
                        <RequestRows
                          key={req.id}
                          req={req}
                          isExpanded={isExpanded}
                          statusInfo={statusInfo}
                          onToggle={() => setExpandedId(isExpanded ? null : req.id)}
                          onStatusChange={handleStatusChange}
                          onAllocateVendor={handleAllocateVendor}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddRequestDialog open={addReqOpen} onOpenChange={setAddReqOpen} onSuccess={fetchData} clientId={id!} />
    </AppLayout>
  );
}

function RequestRows({
  req, isExpanded, statusInfo, onToggle, onStatusChange, onAllocateVendor,
}: {
  req: ClientRequest;
  isExpanded: boolean;
  statusInfo: { value: string; label: string; color: string } | undefined;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
  onAllocateVendor: (id: string, vendorId: string, price: string) => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8 pr-0">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell>
          <div className="font-medium">{req.brand} {req.device_model}</div>
        </TableCell>
        <TableCell>
          <span className="text-xs text-muted-foreground">
            {req.processor} | {req.ram} | {req.storage}
          </span>
        </TableCell>
        <TableCell className="text-center">{req.quantity}</TableCell>
        <TableCell>{req.vendor?.company_name || <span className="text-muted-foreground text-xs">Not allocated</span>}</TableCell>
        <TableCell className="text-right tabular-nums">
          {req.vendor_price_usd != null
            ? `$${Number(req.vendor_price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : '-'}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {req.client_price_usd != null
            ? `$${Number(req.client_price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : '-'}
        </TableCell>
        <TableCell className="text-sm">{req.shipping_date || '-'}</TableCell>
        <TableCell>
          <Badge style={{ backgroundColor: statusInfo?.color + '20', color: statusInfo?.color, borderColor: statusInfo?.color + '40' }} className="text-xs border">
            {statusInfo?.label || req.status}
          </Badge>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={9}>
            <ExpandedRequest
              req={req}
              onStatusChange={onStatusChange}
              onAllocateVendor={onAllocateVendor}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ExpandedRequest({
  req, onStatusChange, onAllocateVendor,
}: {
  req: ClientRequest;
  onStatusChange: (id: string, status: string) => void;
  onAllocateVendor: (id: string, vendorId: string, price: string) => void;
}) {
  const [vendors, setVendors] = useState<{ id: string; company_name: string }[]>([]);
  const [allocVendorId, setAllocVendorId] = useState(req.vendor_id || '');
  const [allocPrice, setAllocPrice] = useState(req.vendor_price_usd != null ? String(req.vendor_price_usd) : '');
  const [clientPrice, setClientPrice] = useState(req.client_price_usd != null ? String(req.client_price_usd) : '');
  const [shippingDate, setShippingDate] = useState(req.shipping_date || '');
  const { toast } = useToast();

  useEffect(() => {
    supabase.from('leads').select('id, company_name').order('company_name').then(({ data }) => {
      if (data) setVendors(data);
    });
  }, []);

  const addons = (req.addons || []) as any[];

  const handleUpdatePricing = async () => {
    const { error } = await supabase.from('client_requests' as any).update({
      client_price_usd: clientPrice ? parseFloat(clientPrice) : null,
      vendor_price_usd: allocPrice ? parseFloat(allocPrice) : null,
      shipping_date: shippingDate || null,
    }).eq('id', req.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Updated' });
  };

  return (
    <div className="px-4 py-3 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="text-muted-foreground text-xs">Display</span>
          <p className="font-medium">{req.display_size}</p>
        </div>
        {req.gpu && (
          <div>
            <span className="text-muted-foreground text-xs">GPU</span>
            <p className="font-medium">{req.gpu}</p>
          </div>
        )}
        {req.os && (
          <div>
            <span className="text-muted-foreground text-xs">OS</span>
            <p className="font-medium">{req.os}</p>
          </div>
        )}
        {req.country && (
          <div>
            <span className="text-muted-foreground text-xs">Delivery Country</span>
            <p className="font-medium">{req.country.name}</p>
          </div>
        )}
        {req.expected_delivery_date && (
          <div>
            <span className="text-muted-foreground text-xs">Expected Delivery</span>
            <p className="font-medium">{req.expected_delivery_date}</p>
          </div>
        )}
      </div>

      {addons.length > 0 && (
        <div>
          <span className="text-xs text-muted-foreground font-medium">Add-ons</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {addons.map((a: any, i: number) => (
              <Badge key={i} variant="outline" className="text-xs gap-1">{a.type}: {a.model} x{a.qty}</Badge>
            ))}
          </div>
        </div>
      )}

      {req.notes && (
        <div>
          <span className="text-xs text-muted-foreground font-medium">Notes</span>
          <p className="text-sm mt-0.5">{req.notes}</p>
        </div>
      )}

      {/* Vendor Allocation & Pricing */}
      <div className="border-t pt-3 space-y-3">
        <h5 className="text-sm font-semibold">Vendor & Pricing</h5>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Vendor</span>
            <Select value={allocVendorId} onValueChange={setAllocVendorId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Allocate vendor" /></SelectTrigger>
              <SelectContent>
                {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Vendor Price (USD)</span>
            <Input type="number" step="0.01" value={allocPrice} onChange={(e) => setAllocPrice(e.target.value)} className="h-9 text-sm" placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Client Price (USD)</span>
            <Input type="number" step="0.01" value={clientPrice} onChange={(e) => setClientPrice(e.target.value)} className="h-9 text-sm" placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Shipping Date</span>
            <Input type="date" value={shippingDate} onChange={(e) => setShippingDate(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!req.vendor_id && allocVendorId && (
            <Button size="sm" onClick={() => onAllocateVendor(req.id, allocVendorId, allocPrice)}>Allocate Vendor</Button>
          )}
          <Button size="sm" variant="outline" onClick={handleUpdatePricing}>Save Pricing</Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Status:</span>
            <Select value={req.status} onValueChange={(v) => onStatusChange(req.id, v)}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLIENT_REQUEST_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
