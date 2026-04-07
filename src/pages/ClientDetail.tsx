import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Plus, Globe2, Mail, Phone, User, Package,
  CheckCircle2, Truck, Clock, DollarSign, ChevronDown, ChevronRight, Edit,
  TrendingUp, CreditCard, Tag, ClipboardList,
} from 'lucide-react';
import { AddRequestDialog } from '@/components/clients/AddRequestDialog';
import { CLIENT_REQUEST_STATUSES } from '@/constants/device-options';
import { clientRequestProfit } from '@/lib/client-request-pricing';
import { discountVsMrp, quotedPctOfMrp } from '@/lib/mrp-insights';
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
    const procurement = requests
      .filter((r) => r.vendor_price_usd != null)
      .reduce((a, r) => a + Number(r.vendor_price_usd) * r.quantity, 0);
    let profit = 0;
    requests.forEach((r) => {
      if (r.client_price_usd != null && r.vendor_price_usd != null) {
        const p = clientRequestProfit(Number(r.vendor_price_usd), Number(r.client_price_usd));
        if (p) profit += p.profitAmount * r.quantity;
      }
    });
    const paid = requests.filter((r) => (r.payment_status ?? 'unpaid') === 'paid').length;
    const unpaid = requests.filter((r) => (r.payment_status ?? 'unpaid') === 'unpaid').length;
    const marginOnQuoted = totalSpend > 0 ? (profit / totalSpend) * 100 : 0;
    const withMrp = requests.filter((r) => r.mrp_usd != null && Number(r.mrp_usd) > 0 && r.client_price_usd != null);
    let avgPctOfMrp = 0;
    if (withMrp.length) {
      avgPctOfMrp = withMrp.reduce((acc, r) => {
        const x = quotedPctOfMrp(Number(r.mrp_usd), Number(r.client_price_usd));
        return acc + (x ?? 0);
      }, 0) / withMrp.length;
    }
    return {
      total, fulfilled, inTransit, pending, totalSpend, procurement, profit, paid, unpaid,
      marginOnQuoted, mrpRows: withMrp.length, avgPctOfMrp: withMrp.length ? avgPctOfMrp : null,
    };
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-10 gap-3">
          <Card className="p-3 border-border/80">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Package className="h-3.5 w-3.5" /> Requests</div>
            <p className="text-xl font-bold">{stats.total}</p>
          </Card>
          <Card className="p-3 border-border/80">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><DollarSign className="h-3.5 w-3.5" /> Quoted Σ</div>
            <p className="text-xl font-bold tabular-nums">${stats.totalSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </Card>
          <Card className="p-3 border-border/80">
            <div className="text-muted-foreground text-xs font-medium mb-1">Procurement Σ</div>
            <p className="text-xl font-bold tabular-nums">${stats.procurement.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </Card>
          <Card className="p-3 border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><TrendingUp className="h-3.5 w-3.5" /> Profit Σ</div>
            <p className="text-xl font-bold tabular-nums">${stats.profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stats.totalSpend > 0 ? `${stats.marginOnQuoted.toFixed(1)}% of quoted` : ''}</p>
          </Card>
          <Card className="p-3 border-primary/15 bg-primary/5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Tag className="h-3.5 w-3.5" /> vs MRP</div>
            <p className="text-xl font-bold tabular-nums">{stats.avgPctOfMrp != null ? `${stats.avgPctOfMrp.toFixed(0)}%` : '—'}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stats.mrpRows ? `avg quoted / MRP · ${stats.mrpRows} lines` : 'add MRP on requests'}</p>
          </Card>
          <Card className="p-3 border-border/80">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><CreditCard className="h-3.5 w-3.5" /> Paid</div>
            <p className="text-xl font-bold">{stats.paid}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stats.unpaid} unpaid</p>
          </Card>
          <Card className="p-3 border-green-500/20 bg-green-500/5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><CheckCircle2 className="h-3.5 w-3.5" /> Fulfilled</div>
            <p className="text-xl font-bold text-green-600">{stats.fulfilled}</p>
          </Card>
          <Card className="p-3 border-blue-500/20 bg-blue-500/5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Truck className="h-3.5 w-3.5" /> In Transit</div>
            <p className="text-xl font-bold text-blue-600">{stats.inTransit}</p>
          </Card>
          <Card className="p-3 border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1"><Clock className="h-3.5 w-3.5" /> Pending</div>
            <p className="text-xl font-bold text-amber-600">{stats.pending}</p>
          </Card>
          <Card className="p-3 border-border/80">
            <div className="text-muted-foreground text-xs font-medium mb-1">Avg / request</div>
            <p className="text-xl font-bold tabular-nums">
              {stats.total ? `$${(stats.profit / stats.total).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">profit</p>
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
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Quoted</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
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
  const pay = req.payment_status ?? 'unpaid';
  const profit =
    req.vendor_price_usd != null && req.client_price_usd != null
      ? clientRequestProfit(Number(req.vendor_price_usd), Number(req.client_price_usd))
      : null;

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8 pr-0">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell>
          <div className="font-medium leading-tight">{req.brand} {req.device_model}</div>
          {req.device_summary && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{req.device_summary}</p>
          )}
        </TableCell>
        <TableCell>
          {req.employee_name ? (
            <>
              <span className="text-xs font-medium block">{req.employee_name}</span>
              {req.employee_address && (
                <div className="text-[10px] text-muted-foreground line-clamp-2 max-w-[180px]">{req.employee_address}</div>
              )}
            </>
          ) : req.employee_address ? (
            <span className="text-xs text-muted-foreground line-clamp-2 max-w-[180px]">{req.employee_address}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="text-center">{req.quantity}</TableCell>
        <TableCell>{req.vendor?.company_name || <span className="text-muted-foreground text-xs">—</span>}</TableCell>
        <TableCell>
          <Badge variant={pay === 'paid' ? 'default' : 'secondary'} className="text-[10px] capitalize">
            {pay}
          </Badge>
          {req.client_payment_date && <div className="text-[10px] text-muted-foreground mt-0.5">{req.client_payment_date}</div>}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {req.client_price_usd != null
            ? `$${Number(req.client_price_usd).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
            : '-'}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {profit !== null ? (
            <span>
              ${profit.profitAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              {profit.profitPctOnProcurement != null && (
                <span className="block text-[10px] text-muted-foreground">{profit.profitPctOnProcurement.toFixed(2)}%</span>
              )}
            </span>
          ) : (
            '-'
          )}
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
          <TableCell colSpan={10}>
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
  const [procurement, setProcurement] = useState(req.vendor_price_usd != null ? String(req.vendor_price_usd) : '');
  const [quoted, setQuoted] = useState(req.client_price_usd != null ? String(req.client_price_usd) : '');
  const [wireCost, setWireCost] = useState(req.wire_cost_usd != null ? String(req.wire_cost_usd) : '');
  const [mrpUsd, setMrpUsd] = useState(req.mrp_usd != null ? String(req.mrp_usd) : '');
  const [deviceSummary, setDeviceSummary] = useState(req.device_summary || '');
  const [employeeName, setEmployeeName] = useState(req.employee_name || '');
  const [employeeAddress, setEmployeeAddress] = useState(req.employee_address || '');
  const [employeePhone, setEmployeePhone] = useState(req.employee_phone || '');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid'>(req.payment_status ?? 'unpaid');
  const [clientPaymentDate, setClientPaymentDate] = useState(req.client_payment_date || '');
  const [shippingDate, setShippingDate] = useState(req.shipping_date || '');
  const { toast } = useToast();

  const profitLive =
    procurement !== '' && quoted !== ''
      ? clientRequestProfit(parseFloat(procurement), parseFloat(quoted))
      : null;

  const mrpN = parseFloat(mrpUsd);
  const mrpOk = !Number.isNaN(mrpN) && mrpN > 0;
  const mrpQuoted = mrpOk && quoted !== '' && !Number.isNaN(parseFloat(quoted))
    ? discountVsMrp(mrpN, parseFloat(quoted))
    : null;
  const mrpProc = mrpOk && procurement !== '' && !Number.isNaN(parseFloat(procurement))
    ? discountVsMrp(mrpN, parseFloat(procurement))
    : null;

  useEffect(() => {
    supabase.from('leads').select('id, company_name').order('company_name').then(({ data }) => {
      if (data) setVendors(data);
    });
  }, []);

  const addons = (req.addons || []) as any[];

  const handleSaveFulfillment = async () => {
    const { error } = await supabase.from('client_requests' as any).update({
      client_price_usd: quoted ? parseFloat(quoted) : null,
      vendor_price_usd: procurement ? parseFloat(procurement) : null,
      wire_cost_usd: wireCost ? parseFloat(wireCost) : null,
      mrp_usd: mrpUsd ? parseFloat(mrpUsd) : null,
      device_summary: deviceSummary.trim() || null,
      employee_name: employeeName.trim() || null,
      employee_address: employeeAddress.trim() || null,
      employee_phone: employeePhone.trim() || null,
      payment_status: paymentStatus,
      client_payment_date: clientPaymentDate || null,
      shipping_date: shippingDate || null,
    }).eq('id', req.id);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Saved' });
  };

  const specParts: { label: string; value: string }[] = [];
  if (req.display_size) specParts.push({ label: 'Display', value: req.display_size });
  if (req.gpu) specParts.push({ label: 'GPU', value: req.gpu });
  if (req.os) specParts.push({ label: 'OS', value: req.os });
  if (req.country) specParts.push({ label: 'Ship to', value: req.country.name });
  if (req.expected_delivery_date) specParts.push({ label: 'ETA', value: req.expected_delivery_date });

  return (
    <div
      className="px-3 sm:px-4 py-2 sm:py-3"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {/* One-line spec context — replaces tall grid */}
      {specParts.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] sm:text-xs border-b border-border/60 pb-2 mb-3 leading-snug">
          {specParts.map((p, i) => (
            <span key={`${p.label}-${i}`} className="inline">
              {i > 0 && <span className="text-border mr-3 select-none" aria-hidden>|</span>}
              <span className="text-muted-foreground">{p.label}</span>
              <span className="text-foreground font-medium tabular-nums"> {p.value}</span>
            </span>
          ))}
        </div>
      )}

      <Tabs defaultValue="pricing" className="w-full">
        <TabsList className="h-9 w-full justify-start gap-0.5 overflow-x-auto bg-muted/60 p-1 rounded-md">
          <TabsTrigger value="pricing" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 shrink-0">
            <DollarSign className="h-3.5 w-3.5" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="order" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 shrink-0">
            <ClipboardList className="h-3.5 w-3.5" />
            Order
          </TabsTrigger>
          <TabsTrigger value="recipient" className="gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3 shrink-0">
            <User className="h-3.5 w-3.5" />
            Recipient
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pricing" className="mt-3 space-y-3 outline-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Vendor</span>
              <Select value={allocVendorId} onValueChange={setAllocVendorId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Allocate vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Price quoted (USD)</span>
              <Input type="number" step="0.01" value={quoted} onChange={(e) => setQuoted(e.target.value)} className="h-9 text-sm tabular-nums" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Procurement (USD)</span>
              <Input type="number" step="0.01" value={procurement} onChange={(e) => setProcurement(e.target.value)} className="h-9 text-sm tabular-nums" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Wire cost</span>
              <Input type="number" step="0.01" value={wireCost} onChange={(e) => setWireCost(e.target.value)} className="h-9 text-sm tabular-nums" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">MRP (list USD)</span>
              <Input type="number" step="0.01" value={mrpUsd} onChange={(e) => setMrpUsd(e.target.value)} className="h-9 text-sm tabular-nums" placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 xl:col-span-2">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Profit ($)</span>
                <Input
                  readOnly
                  className="h-9 text-sm tabular-nums bg-muted/50"
                  value={profitLive != null ? profitLive.profitAmount.toFixed(2) : '—'}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Profit (% on cost)</span>
                <Input
                  readOnly
                  className="h-9 text-sm tabular-nums bg-muted/50"
                  value={profitLive?.profitPctOnProcurement != null ? `${profitLive.profitPctOnProcurement.toFixed(2)}%` : '—'}
                />
              </div>
            </div>
            <div className="space-y-1 sm:col-span-2 xl:col-span-2">
              <span className="text-xs text-muted-foreground">Shipping date</span>
              <Input type="date" value={shippingDate} onChange={(e) => setShippingDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          {(mrpQuoted || mrpProc) && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs space-y-0.5">
              <span className="font-medium text-foreground flex items-center gap-1"><Tag className="h-3 w-3" /> vs MRP</span>
              {mrpQuoted && quotedPctOfMrp(mrpN, parseFloat(quoted)) != null && (
                <p className="text-muted-foreground">
                  Quoted: <span className="text-foreground font-medium">{quotedPctOfMrp(mrpN, parseFloat(quoted))!.toFixed(1)}% of MRP</span>
                  {' '}({mrpQuoted.pctOffMrp.toFixed(1)}% below list)
                </p>
              )}
              {mrpProc && (
                <p className="text-muted-foreground">
                  Procurement: <span className="text-foreground font-medium">{mrpProc.pctOffMrp.toFixed(1)}% below MRP</span>
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2 pt-1 border-t border-border/50">
            <div className="flex flex-wrap items-center gap-2">
              {!req.vendor_id && allocVendorId && (
                <Button size="sm" onClick={() => onAllocateVendor(req.id, allocVendorId, procurement)}>Allocate vendor</Button>
              )}
              <Button size="sm" onClick={handleSaveFulfillment}>Save pricing &amp; dates</Button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:ml-auto sm:text-right">
              <span className="text-xs text-muted-foreground shrink-0">Fulfillment</span>
              <Select value={req.status} onValueChange={(v) => onStatusChange(req.id, v)}>
                <SelectTrigger className="h-9 w-full sm:w-[min(100%,200px)] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_REQUEST_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="order" className="mt-3 space-y-3 outline-none">
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground font-medium">Device summary (reports)</span>
            <Textarea
              value={deviceSummary}
              onChange={(e) => setDeviceSummary(e.target.value)}
              className="min-h-[72px] max-h-[160px] text-sm resize-y"
              placeholder="One line or short paragraph for quotes and invoices…"
              rows={3}
            />
          </div>
          {addons.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground font-medium">Add-ons</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {addons.map((a: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs gap-1">{a.type}: {a.model} ×{a.qty}</Badge>
                ))}
              </div>
            </div>
          )}
          {req.notes ? (
            <div className="rounded-md border border-border/80 bg-muted/20 px-3 py-2">
              <span className="text-xs text-muted-foreground font-medium">Request notes</span>
              <p className="text-sm mt-1 whitespace-pre-wrap leading-snug">{req.notes}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No notes on this request.</p>
          )}
          <Button size="sm" variant="outline" onClick={handleSaveFulfillment}>Save order details</Button>
        </TabsContent>

        <TabsContent value="recipient" className="mt-3 space-y-3 outline-none">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Employee name</span>
              <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Employee phone</span>
              <Input value={employeePhone} onChange={(e) => setEmployeePhone(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Employee address</span>
              <Input value={employeeAddress} onChange={(e) => setEmployeeAddress(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Payment status</span>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as 'paid' | 'unpaid')}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Client payment date</span>
              <Input type="date" value={clientPaymentDate} onChange={(e) => setClientPaymentDate(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleSaveFulfillment}>Save recipient &amp; billing</Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
