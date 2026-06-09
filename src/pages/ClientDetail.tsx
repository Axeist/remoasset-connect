import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Plus, Globe2, Mail, Phone, User, Package,
  CheckCircle2, Truck, Clock, DollarSign, ChevronDown, ChevronRight, Edit,
  TrendingUp, CreditCard, Tag, ClipboardList, Trash2, ScanLine,
} from 'lucide-react';
import { AddRequestDialog } from '@/components/clients/AddRequestDialog';
import { AddRetrievalRequestDialog } from '@/components/clients/AddRetrievalRequestDialog';
import { AddCrossBorderRequestDialog } from '@/components/clients/AddCrossBorderRequestDialog';
import { AddItadRequestDialog } from '@/components/clients/AddItadRequestDialog';
import { ChooseRequestTypeDialog } from '@/components/clients/ChooseRequestTypeDialog';
import { ServiceRequestExpanded } from '@/components/clients/ServiceRequestExpanded';
import { ClientFormDialog } from '@/components/clients/ClientFormDialog';
import type { ClientRequestType } from '@/constants/client-request-types';
import { getClientRequestTypeMeta } from '@/constants/client-request-types';
import {
  CLIENT_REQUEST_SELECT,
  clientRequestTitle, clientRequestSubtitle, clientRequestTypeBadgeStyle,
} from '@/lib/client-request-display';
import { useAuth } from '@/contexts/AuthContext';
import { CLIENT_REQUEST_STATUSES } from '@/constants/device-options';
import { clientRequestProfitFromRequest } from '@/lib/client-request-pricing';
import { discountVsMrp, quotedPctOfMrp } from '@/lib/mrp-insights';
import type { Client, ClientRequest } from '@/types/procurement';
import { categoryLabel, deviceSpecToLine, parseRequestDevices } from '@/lib/device-spec-utils';
import type { DeviceSpecValues } from '@/components/shared/DeviceSpecForm';
import {
  fetchVendorsWithCountries, vendorsForRequestSelect, type VendorWithCountries,
} from '@/components/clients/shared/client-request-form-utils';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [client, setClient] = useState<Client | null>(null);
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [chooseTypeOpen, setChooseTypeOpen] = useState(false);
  const [fulfillmentOpen, setFulfillmentOpen] = useState(false);
  const [retrievalOpen, setRetrievalOpen] = useState(false);
  const [crossBorderOpen, setCrossBorderOpen] = useState(false);
  const [itadOpen, setItadOpen] = useState(false);
  const [editClientOpen, setEditClientOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClientRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!id) return;
    if (!opts?.silent) setLoading(true);
    const [{ data: cData, error: cErr }, { data: rData, error: rErr }] = await Promise.all([
      supabase.from('clients' as any)
        .select('*, country:countries!country_id(name, code)')
        .eq('id', id).single(),
      supabase.from('client_requests' as any)
        .select(CLIENT_REQUEST_SELECT)
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
    ]);
    if (cErr) {
      toast({ title: 'Client not found', variant: 'destructive' });
      navigate('/clients');
      return;
    }
    if (rErr) {
      toast({ title: 'Could not load requests', description: rErr.message, variant: 'destructive' });
    }
    setClient(cData as any);
    if (rData) setRequests(rData as ClientRequest[]);
    if (!opts?.silent) setLoading(false);
  }, [id, toast, navigate]);

  const patchRequest = useCallback((updated: ClientRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const total = requests.length;
    const fulfilled = requests.filter((r) => r.status === 'fulfilled').length;
    const inTransit = requests.filter((r) => r.status === 'in_transit').length;
    const pending = requests.filter((r) => ['pending', 'vendor_allocated', 'ordered'].includes(r.status)).length;
    const totalSpend = requests
      .filter((r) => r.client_price_usd)
      .reduce((a, r) => a + (Number(r.client_price_usd) * r.quantity), 0);
    const procurement = requests.reduce((a, r) => {
      const landing = r.vendor_price_usd != null ? Number(r.vendor_price_usd) : 0;
      const service = r.service_cost_usd != null ? Number(r.service_cost_usd) : 0;
      return a + (landing + service) * r.quantity;
    }, 0);
    let profit = 0;
    requests.forEach((r) => {
      const p = clientRequestProfitFromRequest(r.client_price_usd, r.vendor_price_usd, r.service_cost_usd);
      if (p) profit += p.profitAmount * r.quantity;
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
      fetchData({ silent: true });
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
      fetchData({ silent: true });
    }
  };

  const handleDeleteRequest = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('client_requests' as any).delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast({ title: 'Could not delete request', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Request deleted' });
    if (expandedId === deleteTarget.id) setExpandedId(null);
    setDeleteTarget(null);
    fetchData();
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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0 h-8"
                onClick={() => setEditClientOpen(true)}
              >
                <Edit className="h-3.5 w-3.5" />
                Edit info
              </Button>
            </div>
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
          <Button onClick={() => setChooseTypeOpen(true)} className="gap-1.5 shrink-0">
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
                <p className="text-sm text-muted-foreground mt-1">
                  Add fulfillment, retrieval, cross-border, or ITAD requests for this client.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>Type</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Quoted</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead>Tracking</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="w-10 text-right"><span className="sr-only">Actions</span></TableHead>}
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
                          isAdmin={isAdmin}
                          onToggle={() => setExpandedId(isExpanded ? null : req.id)}
                          onStatusChange={handleStatusChange}
                          onAllocateVendor={handleAllocateVendor}
                          onDeleteRequest={setDeleteTarget}
                          onRequestUpdated={patchRequest}
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

      <ChooseRequestTypeDialog
        open={chooseTypeOpen}
        onOpenChange={setChooseTypeOpen}
        onSelect={(type: ClientRequestType) => {
          if (type === 'fulfillment') setFulfillmentOpen(true);
          else if (type === 'retrieval_redeployment') setRetrievalOpen(true);
          else if (type === 'cross_border') setCrossBorderOpen(true);
          else if (type === 'itad') setItadOpen(true);
        }}
      />
      <AddRequestDialog open={fulfillmentOpen} onOpenChange={setFulfillmentOpen} onSuccess={fetchData} clientId={id!} />
      <AddRetrievalRequestDialog open={retrievalOpen} onOpenChange={setRetrievalOpen} onSuccess={fetchData} clientId={id!} />
      <AddCrossBorderRequestDialog open={crossBorderOpen} onOpenChange={setCrossBorderOpen} onSuccess={fetchData} clientId={id!} />
      <AddItadRequestDialog open={itadOpen} onOpenChange={setItadOpen} onSuccess={fetchData} clientId={id!} />
      <ClientFormDialog
        open={editClientOpen}
        onOpenChange={setEditClientOpen}
        onSuccess={fetchData}
        editItem={client}
      />
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this request?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the line item for{' '}
              <span className="font-medium text-foreground">
                {deleteTarget ? clientRequestTitle(deleteTarget) : ''}
              </span>
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteRequest();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

function RequestRows({
  req, isExpanded, statusInfo, isAdmin, onToggle, onStatusChange, onAllocateVendor, onDeleteRequest, onRequestUpdated,
}: {
  req: ClientRequest;
  isExpanded: boolean;
  statusInfo: { value: string; label: string; color: string } | undefined;
  isAdmin: boolean;
  onToggle: () => void;
  onStatusChange: (id: string, status: string) => void;
  onAllocateVendor: (id: string, vendorId: string, price: string) => void;
  onDeleteRequest: (req: ClientRequest) => void;
  onRequestUpdated: (req: ClientRequest) => void;
}) {
  const pay = req.payment_status ?? 'unpaid';
  const requestType = req.request_type ?? 'fulfillment';
  const typeMeta = getClientRequestTypeMeta(requestType);
  const isFulfillment = requestType === 'fulfillment';
  const profit = clientRequestProfitFromRequest(req.client_price_usd, req.vendor_price_usd, req.service_cost_usd);
  const subtitle = clientRequestSubtitle(req);

  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8 pr-0">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell>
          <Badge className="text-[10px] border whitespace-nowrap" style={clientRequestTypeBadgeStyle(requestType)}>
            {typeMeta.shortLabel}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="font-medium leading-tight">{clientRequestTitle(req)}</div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{subtitle}</p>
          )}
          {!subtitle && req.device_summary && requestType === 'fulfillment' && (
            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{req.device_summary}</p>
          )}
        </TableCell>
        <TableCell>
          {isFulfillment ? (
            req.employee_name ? (
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
            )
          ) : requestType === 'retrieval_redeployment' ? (
            <span className="text-xs text-muted-foreground line-clamp-2 max-w-[200px]">
              {req.from_address ? `${req.from_address.slice(0, 30)}…` : '—'}
            </span>
          ) : requestType === 'cross_border' ? (
            <span className="text-xs">
              {req.origin_country?.name ?? '—'} → {req.destination_country?.name ?? '—'}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground line-clamp-2 max-w-[180px]">
              {req.itad_services?.slice(0, 60) ?? '—'}
            </span>
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
        <TableCell className="text-sm max-w-[140px]">
          <div className="space-y-0.5 leading-tight">
            {req.shipping_date ? (
              <span className="block tabular-nums">Ship: {req.shipping_date}</span>
            ) : null}
            {req.delivery_date ? (
              <span className="block tabular-nums text-muted-foreground">Del: {req.delivery_date}</span>
            ) : null}
            {req.serial_number ? (
              <span className="block text-[10px] text-muted-foreground truncate" title={req.serial_number}>
                S/N: {req.serial_number}
              </span>
            ) : null}
            {!req.shipping_date && !req.delivery_date && !req.serial_number ? (
              <span className="text-muted-foreground">—</span>
            ) : null}
          </div>
        </TableCell>
        <TableCell>
          <Badge style={{ backgroundColor: statusInfo?.color + '20', color: statusInfo?.color, borderColor: statusInfo?.color + '40' }} className="text-xs border">
            {statusInfo?.label || req.status}
          </Badge>
        </TableCell>
        {isAdmin && (
          <TableCell className="text-right p-1 w-10" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label="Delete request"
              onClick={() => onDeleteRequest(req)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </TableCell>
        )}
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={isAdmin ? 12 : 11}>
            {(req.request_type ?? 'fulfillment') === 'fulfillment' ? (
              <ExpandedRequest
                req={req}
                onStatusChange={onStatusChange}
                onAllocateVendor={onAllocateVendor}
                onRequestUpdated={onRequestUpdated}
              />
            ) : (
              <ServiceRequestExpanded
                req={req}
                onStatusChange={onStatusChange}
                onRequestUpdated={onRequestUpdated}
              />
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ExpandedRequest({
  req, onStatusChange, onAllocateVendor, onRequestUpdated,
}: {
  req: ClientRequest;
  onStatusChange: (id: string, status: string) => void;
  onAllocateVendor: (id: string, vendorId: string, price: string) => void;
  onRequestUpdated: (req: ClientRequest) => void;
}) {
  const [allVendors, setAllVendors] = useState<VendorWithCountries[]>([]);
  const [allocVendorId, setAllocVendorId] = useState(req.vendor_id || '');
  const [procurement, setProcurement] = useState(req.vendor_price_usd != null ? String(req.vendor_price_usd) : '');
  const [serviceCost, setServiceCost] = useState(req.service_cost_usd != null ? String(req.service_cost_usd) : '');
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
  const [deliveryDate, setDeliveryDate] = useState(req.delivery_date || '');
  const [serialNumber, setSerialNumber] = useState(req.serial_number || '');
  const [deviceLines, setDeviceLines] = useState<DeviceSpecValues[]>(() => parseRequestDevices(req));
  const [savingTracking, setSavingTracking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setAllocVendorId(req.vendor_id || '');
    setProcurement(req.vendor_price_usd != null ? String(req.vendor_price_usd) : '');
    setServiceCost(req.service_cost_usd != null ? String(req.service_cost_usd) : '');
    setQuoted(req.client_price_usd != null ? String(req.client_price_usd) : '');
    setWireCost(req.wire_cost_usd != null ? String(req.wire_cost_usd) : '');
    setMrpUsd(req.mrp_usd != null ? String(req.mrp_usd) : '');
    setDeviceSummary(req.device_summary || '');
    setEmployeeName(req.employee_name || '');
    setEmployeeAddress(req.employee_address || '');
    setEmployeePhone(req.employee_phone || '');
    setPaymentStatus(req.payment_status ?? 'unpaid');
    setClientPaymentDate(req.client_payment_date || '');
    setShippingDate(req.shipping_date || '');
    setDeliveryDate(req.delivery_date || '');
    setSerialNumber(req.serial_number || '');
    setDeviceLines(parseRequestDevices(req));
  }, [
    req.id,
    req.updated_at,
    req.vendor_id,
    req.vendor_price_usd,
    req.service_cost_usd,
    req.client_price_usd,
    req.wire_cost_usd,
    req.mrp_usd,
    req.device_summary,
    req.employee_name,
    req.employee_address,
    req.employee_phone,
    req.payment_status,
    req.client_payment_date,
    req.shipping_date,
    req.delivery_date,
    req.serial_number,
    req.devices,
    req.brand,
    req.device_model,
  ]);

  const profitLive =
    quoted !== '' && (procurement !== '' || serviceCost !== '')
      ? clientRequestProfitFromRequest(
        parseFloat(quoted),
        procurement ? parseFloat(procurement) : 0,
        serviceCost ? parseFloat(serviceCost) : 0,
      )
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
    fetchVendorsWithCountries().then(setAllVendors);
  }, []);

  const vendors = useMemo(
    () => vendorsForRequestSelect(allVendors, req.country_id, allocVendorId, req.vendor?.company_name),
    [allVendors, req.country_id, allocVendorId, req.vendor?.company_name],
  );

  const vendorCountryLabel = req.country?.name;

  const addons = (req.addons || []) as any[];

  const buildDevicesPayload = () => {
    const lines = deviceLines.map((d) => deviceSpecToLine(d));
    if (lines.length === 1 && serialNumber.trim() && !lines[0].serial_number) {
      lines[0].serial_number = serialNumber.trim();
    }
    return lines;
  };

  const aggregateSerial = (lines: ReturnType<typeof buildDevicesPayload>) => {
    const fromLines = lines.map((d) => d.serial_number).filter(Boolean).join(', ');
    return fromLines || serialNumber.trim() || null;
  };

  const handleSaveTracking = async () => {
    setSavingTracking(true);
    const devicesPayload = buildDevicesPayload();
    const { data, error } = await supabase.from('client_requests' as any).update({
      serial_number: aggregateSerial(devicesPayload),
      shipping_date: shippingDate || null,
      delivery_date: deliveryDate || null,
      devices: devicesPayload as any,
    }).eq('id', req.id).select(CLIENT_REQUEST_SELECT).single();
    setSavingTracking(false);
    if (error || !data) {
      toast({
        title: 'Could not save tracking',
        description: error?.message?.includes('column')
          ? `${error.message} — run the latest Supabase migration (devices / serial_number / delivery_date).`
          : error?.message ?? 'No rows were updated.',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Tracking saved', description: 'Serial and dates updated.' });
      onRequestUpdated(data as ClientRequest);
    }
  };

  const handleSaveFulfillment = async () => {
    const devicesPayload = buildDevicesPayload();
    const { data, error } = await supabase.from('client_requests' as any).update({
      vendor_id: allocVendorId || null,
      client_price_usd: quoted ? parseFloat(quoted) : null,
      vendor_price_usd: procurement ? parseFloat(procurement) : null,
      service_cost_usd: serviceCost ? parseFloat(serviceCost) : null,
      wire_cost_usd: wireCost ? parseFloat(wireCost) : null,
      mrp_usd: mrpUsd ? parseFloat(mrpUsd) : null,
      device_summary: deviceSummary.trim() || null,
      employee_name: employeeName.trim() || null,
      employee_address: employeeAddress.trim() || null,
      employee_phone: employeePhone.trim() || null,
      payment_status: paymentStatus,
      client_payment_date: clientPaymentDate || null,
      shipping_date: shippingDate || null,
      delivery_date: deliveryDate || null,
      serial_number: aggregateSerial(devicesPayload),
      devices: devicesPayload as any,
    }).eq('id', req.id).select(CLIENT_REQUEST_SELECT).single();
    if (error || !data) {
      toast({
        title: 'Could not save',
        description: error?.message?.includes('column')
          ? `${error.message} — run the latest Supabase migration.`
          : error?.message ?? 'No rows were updated.',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Saved' });
      onRequestUpdated(data as ClientRequest);
    }
  };

  const updateDeviceSerial = (index: number, serial: string) => {
    setDeviceLines((prev) => {
      const next = prev.map((d, i) => (i === index ? { ...d, serial_number: serial } : d));
      if (next.length === 1) setSerialNumber(serial);
      return next;
    });
  };

  const specParts: { label: string; value: string }[] = [];
  if (req.brand && req.brand !== '—') specParts.push({ label: 'Brand', value: req.brand });
  if (req.display_size && req.display_size !== '—') specParts.push({ label: 'Display', value: req.display_size });
  if (req.gpu) specParts.push({ label: 'GPU', value: req.gpu });
  if (req.os) specParts.push({ label: 'OS', value: req.os });
  if (req.country) specParts.push({ label: 'Ship to', value: req.country.name });
  if (req.expected_delivery_date) specParts.push({ label: 'ETA', value: req.expected_delivery_date });
  const trackingSerial = serialNumber.trim() || req.serial_number;
  if (trackingSerial) specParts.push({ label: 'Serial', value: trackingSerial });
  const trackingShip = shippingDate || req.shipping_date;
  if (trackingShip) specParts.push({ label: 'Shipped', value: trackingShip });
  const trackingDel = deliveryDate || req.delivery_date;
  if (trackingDel) specParts.push({ label: 'Delivered', value: trackingDel });

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

      {/* Always-visible tracking — serial often added after fulfillment */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 sm:p-4 mb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold">Fulfillment tracking</p>
              <p className="text-[11px] text-muted-foreground">Serial and dates can be filled in anytime after the order ships.</p>
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={handleSaveTracking} disabled={savingTracking} className="shrink-0">
            {savingTracking ? 'Saving…' : 'Save tracking'}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1 sm:col-span-1">
            <span className="text-xs font-medium text-muted-foreground">Serial number(s)</span>
            <Input
              value={serialNumber}
              onChange={(e) => {
                setSerialNumber(e.target.value);
                if (deviceLines.length === 1) {
                  setDeviceLines((prev) => prev.map((d, i) => (i === 0 ? { ...d, serial_number: e.target.value } : d)));
                }
              }}
              className="h-9 text-sm"
              placeholder="Add when device is received"
            />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Shipping date</span>
            <Input type="date" value={shippingDate} onChange={(e) => setShippingDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Delivery date</span>
            <Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        {deviceLines.length > 1 && (
          <div className="space-y-2 pt-1 border-t border-primary/15">
            <p className="text-xs font-medium text-muted-foreground">Serial per device</p>
            {deviceLines.map((device, i) => (
              <div key={device.id ?? i} className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(0,220px)] gap-2 items-center">
                <span className="text-xs truncate">
                  {categoryLabel(device.category)} · {device.brand} {device.device_model}
                </span>
                <Input
                  value={device.serial_number}
                  onChange={(e) => updateDeviceSerial(i, e.target.value)}
                  placeholder="Serial"
                  className="h-8 text-xs"
                />
              </div>
            ))}
          </div>
        )}
      </div>

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
              <span className="text-xs text-muted-foreground">
                Vendor{vendorCountryLabel ? ` · ${vendorCountryLabel}` : ''}
              </span>
              <Select value={allocVendorId || undefined} onValueChange={setAllocVendorId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder={vendorCountryLabel ? `Vendors in ${vendorCountryLabel}` : 'Select vendor'} />
                </SelectTrigger>
                <SelectContent className="max-h-[min(320px,50vh)]">
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Price quoted (USD)</span>
              <Input type="number" step="0.01" value={quoted} onChange={(e) => setQuoted(e.target.value)} className="h-9 text-sm tabular-nums" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Landing cost (USD)</span>
              <Input type="number" step="0.01" value={procurement} onChange={(e) => setProcurement(e.target.value)} className="h-9 text-sm tabular-nums" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Service cost (USD)</span>
              <Input type="number" step="0.01" value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} className="h-9 text-sm tabular-nums" placeholder="0.00" />
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
          {deviceLines.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Devices ({deviceLines.length})</span>
              <div className="space-y-2">
                {deviceLines.map((device, i) => (
                  <div key={device.id ?? i} className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm space-y-2">
                    <p className="font-medium">
                      {categoryLabel(device.category)} · {device.brand} {device.device_model}
                      {device.quantity > 1 ? ` ×${device.quantity}` : ''}
                    </p>
                    <div className="space-y-1 max-w-md">
                      <Label className="text-xs text-muted-foreground">Serial number</Label>
                      <Input
                        value={device.serial_number}
                        onChange={(e) => updateDeviceSerial(i, e.target.value)}
                        placeholder="Add when available"
                        className="h-8 text-xs"
                      />
                    </div>
                    {device.custom_fields?.filter((f) => f.label && f.value).map((f, j) => (
                      <p key={j} className="text-xs text-muted-foreground">{f.label}: {f.value}</p>
                    ))}
                  </div>
                ))}
              </div>
              <Button size="sm" variant="outline" onClick={handleSaveTracking}>Save device serials</Button>
            </div>
          )}
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
