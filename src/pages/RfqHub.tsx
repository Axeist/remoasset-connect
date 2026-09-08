import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { campaignRollups, formatCountdown } from '@/lib/rfq';
import { cn } from '@/lib/utils';
import { RFQ_STATUS_LABELS, type Rfq, type RfqRecipient } from '@/types/rfq';
import { Plus, Search, Megaphone, Clock, Trash2 } from 'lucide-react';
import { RfqHowToButton } from '@/components/rfq/RfqHowToDialog';
import { RFQ_STATUS_HELP } from '@/components/rfq/RfqInfo';

type RfqRow = Rfq & {
  recipients?: Pick<RfqRecipient, 'status'>[];
};

type HubFilter = 'all' | 'open' | 'bidding' | 'overdue';

const TYPE_LABEL: Record<string, string> = {
  fulfillment: 'Fulfillment',
  retrieval_redeployment: 'Retrieval',
  itad: 'ITAD',
};

export default function RfqHub() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<RfqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<HubFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<RfqRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('rfqs' as any)
      .select(`
        *,
        client:clients!client_id(id, name),
        country:countries!country_id(id, name),
        recipients:rfq_recipients(status)
      `)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Failed to load RFQs', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    setRows((data as any) || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const kpis = useMemo(() => {
    const open = rows.filter((r) => ['draft', 'sent', 'bidding'].includes(r.status)).length;
    const awarding = rows.filter((r) => r.status === 'bidding').length;
    const overdue = rows.filter((r) =>
      ['sent', 'bidding'].includes(r.status) && new Date(r.deadline).getTime() < Date.now(),
    ).length;
    return { open, awarding, overdue, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'open' && !['draft', 'sent', 'bidding'].includes(r.status)) return false;
      if (filter === 'bidding' && r.status !== 'bidding') return false;
      if (filter === 'overdue') {
        const overdue = ['sent', 'bidding'].includes(r.status) && new Date(r.deadline).getTime() < Date.now();
        if (!overdue) return false;
      }
      if (!q) return true;
      return (
        (r.client?.name || '').toLowerCase().includes(q)
        || (r.scope_summary || '').toLowerCase().includes(q)
        || (r.country?.name || '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  const handleDelete = async () => {
    if (!deleteTarget || !isAdmin) return;
    setDeleting(true);
    await supabase.from('rfqs' as any).update({ awarded_bid_id: null }).eq('id', deleteTarget.id);
    const { error } = await supabase.from('rfqs' as any).delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast({ title: 'Failed to delete RFQ', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'RFQ deleted', description: `${deleteTarget.client?.name || 'Campaign'} removed.` });
    setDeleteTarget(null);
    load();
  };

  const colSpan = isAdmin ? 7 : 6;
  const emptyAll = !loading && rows.length === 0;

  const toggleFilter = (next: HubFilter) => {
    setFilter((prev) => (prev === next ? 'all' : next));
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" />
              RFQ
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Invite Closed partners, compare quotes, award.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <RfqHowToButton />
            <Button onClick={() => navigate('/rfq/new')} className="rounded-xl cursor-pointer">
              <Plus className="h-4 w-4 mr-2" /> Raise RFQ
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'open' as const, label: 'Open', value: kpis.open },
            { key: 'bidding' as const, label: 'Bidding', value: kpis.awarding },
            { key: 'overdue' as const, label: 'Overdue', value: kpis.overdue },
            { key: 'all' as const, label: 'Total', value: kpis.total },
          ].map((k) => (
            <button
              key={k.label}
              type="button"
              onClick={() => toggleFilter(k.key)}
              className={cn(
                'text-left rounded-[14px] border bg-card card-shadow px-4 py-3 cursor-pointer transition-colors duration-200',
                'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === k.key && 'ring-1 ring-primary/40 bg-primary/5',
              )}
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{k.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{k.value}</p>
            </button>
          ))}
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-xl"
            placeholder="Search by client, country, or scope…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card className="card-shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quotes</TableHead>
                <TableHead>Deadline</TableHead>
                {isAdmin && <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={colSpan}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && emptyAll && (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-12">
                    <div className="text-center space-y-4 max-w-lg mx-auto">
                      <p className="font-medium">No RFQ campaigns yet</p>
                      <p className="text-sm text-muted-foreground">
                        Raise a campaign when a client needs devices or retrieval / ITAD.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <RfqHowToButton />
                        <Button className="rounded-xl cursor-pointer" onClick={() => navigate('/rfq/new')}>
                          <Plus className="h-4 w-4 mr-2" /> Raise RFQ
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && !emptyAll && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={colSpan} className="py-10 text-center text-sm text-muted-foreground">
                    No campaigns match this filter.
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((r) => {
                const roll = campaignRollups(r.recipients || []);
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors duration-200"
                    onClick={() => navigate(`/rfq/${r.id}`)}
                  >
                    <TableCell>
                      <div className="font-medium">{r.client?.name || '—'}</div>
                      {r.scope_summary && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5 max-w-[220px]">
                          {r.scope_summary}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{TYPE_LABEL[r.rfq_type] || r.rfq_type}</TableCell>
                    <TableCell>{r.country?.name || '—'}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary">{RFQ_STATUS_LABELS[r.status]}</Badge>
                        </TooltipTrigger>
                        <TooltipContent>{RFQ_STATUS_HELP[r.status]}</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="tabular-nums text-sm">
                      {roll.quoted} / {roll.sent || roll.total}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatCountdown(r.deadline)}
                      </span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive cursor-pointer"
                          title="Delete campaign"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(r);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this RFQ campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete “{deleteTarget?.client?.name || 'this campaign'}” and all recipients, bids, and email logs.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
