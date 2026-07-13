import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { campaignRollups, formatCountdown } from '@/lib/rfq';
import { RFQ_STATUS_LABELS, type Rfq, type RfqRecipient } from '@/types/rfq';
import { Plus, Search, Megaphone, Clock } from 'lucide-react';
import { HowItWorksStrip, InfoCallout, RFQ_STATUS_HELP } from '@/components/rfq/RfqInfo';

type RfqRow = Rfq & {
  recipients?: Pick<RfqRecipient, 'status'>[];
};

export default function RfqHub() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rows, setRows] = useState<RfqRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      (r.client?.name || '').toLowerCase().includes(q)
      || (r.scope_summary || '').toLowerCase().includes(q)
      || (r.country?.name || '').toLowerCase().includes(q),
    );
  }, [rows, search]);

  const kpis = useMemo(() => {
    const open = rows.filter((r) => ['draft', 'sent', 'bidding'].includes(r.status)).length;
    const awarding = rows.filter((r) => r.status === 'bidding').length;
    const overdue = rows.filter((r) =>
      ['sent', 'bidding'].includes(r.status) && new Date(r.deadline).getTime() < Date.now(),
    ).length;
    return { open, awarding, overdue, total: rows.length };
  }, [rows]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" />
              RFQ Campaigns
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Competitive sourcing for new devices and retrieval / warehouse / ITAD.
              Only <strong className="text-foreground font-medium">Closed</strong> partners in the same country are invited.
              Every email and every reply is tracked here — not only in Gmail.
            </p>
          </div>
          <Button onClick={() => navigate('/rfq/new')} className="rounded-xl shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Raise RFQ
          </Button>
        </div>

        <HowItWorksStrip />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Open', value: kpis.open, hint: 'Draft, sent, or bidding' },
            { label: 'Bidding', value: kpis.awarding, hint: 'Quotes in — ready to compare' },
            { label: 'Overdue', value: kpis.overdue, hint: 'Past deadline, not awarded' },
            { label: 'Total', value: kpis.total, hint: 'All campaigns' },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{k.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1">{k.value}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{k.hint}</p>
            </div>
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

        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Campaign tracking</TableHead>
                <TableHead>Time left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12">
                    <div className="text-center space-y-2 max-w-md mx-auto">
                      <p className="font-medium">No RFQ campaigns yet</p>
                      <p className="text-sm text-muted-foreground">
                        Raise a campaign when a client needs devices or retrieval / ITAD.
                        We will match Closed partners, email them, and track every reply in one place.
                      </p>
                      <Button className="rounded-xl mt-2" onClick={() => navigate('/rfq/new')}>
                        <Plus className="h-4 w-4 mr-2" /> Raise your first RFQ
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.map((r) => {
                const roll = campaignRollups(r.recipients || []);
                return (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => navigate(`/rfq/${r.id}`)}
                    title={RFQ_STATUS_HELP[r.status]}
                  >
                    <TableCell>
                      <div className="font-medium">{r.client?.name || '—'}</div>
                      {r.scope_summary && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5 max-w-[220px]">
                          {r.scope_summary}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {r.rfq_type.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell>{r.country?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{RFQ_STATUS_LABELS[r.status]}</Badge>
                      <p className="text-[10px] text-muted-foreground mt-1 max-w-[140px] leading-snug hidden lg:block">
                        {RFQ_STATUS_HELP[r.status]}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="tabular-nums">Sent {roll.sent} · Opened {roll.opened} · Quoted {roll.quoted}</div>
                      <div className="text-[10px] mt-0.5">Click row for full recipient grid</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatCountdown(r.deadline)} left
                      </span>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(r.deadline).toLocaleString()}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <InfoCallout title="Reading the campaign column" tone="blue">
          <p>
            <strong>Sent</strong> = invite emailed · <strong>Opened</strong> = partner opened the link ·
            <strong> Quoted</strong> = valid bid + quotation file uploaded. Amounts stay sealed until you unseal or the deadline passes.
          </p>
        </InfoCallout>
      </div>
    </AppLayout>
  );
}
