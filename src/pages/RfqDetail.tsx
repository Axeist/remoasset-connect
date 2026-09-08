import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { asRfqCartLines, campaignRollups, cartLineLabel, formatCountdown, formatRelativeTime } from '@/lib/rfq';
import { convertToUsd, getRateToUsd } from '@/lib/fx-rates';
import { buildAwardEmail, buildRemindEmail } from '@/lib/rfq-email-templates';
import { invokeRfqCampaign } from '@/lib/rfq-api';
import {
  RFQ_RECIPIENT_STATUS_LABELS,
  RFQ_STATUS_LABELS,
  type Rfq,
  type RfqBid,
  type RfqEmail,
  type RfqRecipient,
  type RfqStatus,
} from '@/types/rfq';
import { ArrowLeft, Bell, CheckSquare, ChevronDown, ChevronUp, Send, Table2, Trash2 } from 'lucide-react';
import { RFQ_RECIPIENT_HELP, RFQ_STATUS_HELP } from '@/components/rfq/RfqInfo';
import { money, RfqBidCards, usdOf } from '@/components/rfq/RfqBidCards';
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

function defaultTab(status: RfqStatus): string {
  if (status === 'bidding') return 'bids';
  if (status === 'awarded') return 'checklist';
  return 'recipients';
}

function recipientActivity(r: RfqRecipient): string {
  if (r.status === 'quoted' && r.quoted_at) return `Quoted ${formatRelativeTime(r.quoted_at)}`;
  if (r.status === 'declined' && r.declined_at) return `Declined ${formatRelativeTime(r.declined_at)}`;
  if (r.status === 'opened' && r.opened_at) return `Opened ${formatRelativeTime(r.opened_at)}`;
  if (r.status === 'sent' && r.sent_at) return `Sent ${formatRelativeTime(r.sent_at)}`;
  if (r.status === 'pending_send') return 'Not sent yet';
  return formatRelativeTime(r.sent_at);
}

export default function RfqDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [recipients, setRecipients] = useState<RfqRecipient[]>([]);
  const [bids, setBids] = useState<RfqBid[]>([]);
  const [emails, setEmails] = useState<RfqEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('recipients');
  const tabInitialized = useRef(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [spreadsheet, setSpreadsheet] = useState(false);
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardBidId, setAwardBidId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
  const [weakOk, setWeakOk] = useState(false);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseBid, setReviseBid] = useState<RfqBid | null>(null);
  const [reviseNote, setReviseNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [checklist, setChecklist] = useState({
    pricing: false,
    file: false,
    winnerMail: false,
    loserMail: false,
    po: false,
  });
  const [usdRates, setUsdRates] = useState<Record<string, number>>({ USD: 1 });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: r }, { data: rec }, { data: b }, { data: e }] = await Promise.all([
      supabase.from('rfqs' as any).select('*, client:clients!client_id(id, name), country:countries!country_id(id, name)').eq('id', id).single(),
      supabase.from('rfq_recipients' as any).select('*, vendor:leads!vendor_id(id, company_name)').eq('rfq_id', id).order('created_at'),
      supabase.from('rfq_bids' as any).select('*, vendor:leads!vendor_id(id, company_name)').eq('rfq_id', id).order('total_landed', { ascending: true }),
      supabase.from('rfq_emails' as any).select('*').eq('rfq_id', id).order('sent_at', { ascending: false }),
    ]);
    setRfq(r as any);
    setRecipients((rec as any) || []);
    setBids((b as any) || []);
    setEmails((e as any) || []);
    if (r && !tabInitialized.current) {
      setTab(defaultTab((r as Rfq).status));
      tabInitialized.current = true;
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    tabInitialized.current = false;
    setTab('recipients');
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const codes = [...new Set(bids.map((b) => (b.currency || 'USD').toUpperCase()))];
    if (!codes.includes('USD')) codes.push('USD');
    (async () => {
      const next: Record<string, number> = { USD: 1 };
      await Promise.all(
        codes.map(async (code) => {
          try {
            const { rate } = await getRateToUsd(code);
            next[code] = rate;
          } catch {
            /* leave missing so UI keeps original currency */
          }
        }),
      );
      if (!cancelled) setUsdRates(next);
    })();
    const refresh = window.setInterval(() => {
      void (async () => {
        const next: Record<string, number> = { USD: 1 };
        await Promise.all(
          codes.map(async (code) => {
            try {
              const { rate } = await getRateToUsd(code);
              next[code] = rate;
            } catch {
              /* ignore */
            }
          }),
        );
        if (!cancelled) setUsdRates(next);
      })();
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
    };
  }, [bids]);

  const roll = useMemo(() => campaignRollups(recipients), [recipients]);
  const awardBid = bids.find((b) => b.id === awardBidId);
  const weakCompetition = bids.length < 2;

  const openQuotation = async (b: RfqBid) => {
    if (!b.quotation_file_path) {
      toast({ title: 'No file on this bid', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase.storage
      .from('rfq-quotations')
      .createSignedUrl(b.quotation_file_path, 120);
    if (error || !data?.signedUrl) {
      toast({ title: 'Could not open file', description: error?.message, variant: 'destructive' });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const remind = async () => {
    if (!rfq) return;
    setBusy(true);
    try {
      const vars = {
        vendor_name: 'Partner',
        country: rfq.country?.name || '',
        deadline: new Date(rfq.deadline).toLocaleString(),
        deadline_countdown: formatCountdown(rfq.deadline),
        magic_link: '{{magic_link}}',
        scope_summary: rfq.scope_summary || '',
        qty: rfq.quantity || 1,
        owner_name: user?.email?.split('@')[0] || 'RemoAsset',
        rfq_type_label: rfq.rfq_type,
      };
      const mail = buildRemindEmail(vars);
      const res = await invokeRfqCampaign({
        action: 'remind',
        rfq_id: rfq.id,
        subject: mail.subject,
        body_html: mail.body_html,
        body_text: mail.body_text,
      });
      toast({ title: 'Reminders sent', description: `${res.sent || 0} vendors` });
      load();
    } catch (e) {
      toast({ title: 'Remind failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const sendDraft = async () => {
    if (!rfq?.email_subject || !rfq.email_body_html) {
      toast({ title: 'Missing email', description: 'Open Raise again or set subject/body.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await invokeRfqCampaign({
        action: 'send',
        rfq_id: rfq.id,
        subject: rfq.email_subject,
        body_html: rfq.email_body_html,
      });
      toast({ title: 'Campaign sent' });
      load();
    } catch (e) {
      toast({ title: 'Send failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const requestRevision = async () => {
    if (!reviseBid || !reviseNote.trim()) {
      toast({ title: 'Revision note required', variant: 'destructive' });
      return;
    }
    await supabase.from('rfq_bids' as any).update({
      pricing_status: 'revision_requested',
      revision_note: reviseNote.trim(),
    }).eq('id', reviseBid.id);
    if (rfq?.client_request_id) {
      await supabase.from('client_requests' as any).update({ status: 'pricing_review' }).eq('id', rfq.client_request_id);
    }
    toast({ title: 'Revision requested' });
    setReviseOpen(false);
    setReviseBid(null);
    setReviseNote('');
    load();
  };

  const confirmAward = async () => {
    if (!rfq || !awardBidId || !rationale.trim()) {
      toast({ title: 'Rationale required', variant: 'destructive' });
      return;
    }
    if (weakCompetition && !weakOk) {
      toast({ title: 'Confirm weak competition', description: 'Fewer than two quotes. Check the box to proceed.', variant: 'destructive' });
      return;
    }
    const bid = bids.find((b) => b.id === awardBidId);
    if (!bid) return;
    setBusy(true);
    try {
      const { rate } = await getRateToUsd(bid.currency || 'USD');
      const landed = Number(bid.total_landed ?? bid.quoted_price);
      const vendor_price_usd = Math.round(convertToUsd(landed, rate) * 100) / 100;
      const mrp_usd =
        bid.mrp_price != null ? Math.round(convertToUsd(Number(bid.mrp_price), rate) * 100) / 100 : null;

      await supabase.from('rfq_bids' as any).update({ award_status: 'won', pricing_status: 'accepted' }).eq('id', bid.id);
      await supabase.from('rfq_bids' as any).update({ award_status: 'lost' }).eq('rfq_id', rfq.id).neq('id', bid.id);

      await supabase.from('rfqs' as any).update({
        status: 'awarded',
        awarded_bid_id: bid.id,
        awarded_vendor_id: bid.vendor_id,
        award_rationale: rationale,
        unsealed_at: rfq.unsealed_at || new Date().toISOString(),
      }).eq('id', rfq.id);

      if (rfq.client_request_id) {
        await supabase.from('client_requests' as any).update({
          vendor_id: bid.vendor_id,
          vendor_price_usd,
          mrp_usd,
          status: 'vendor_allocated',
        }).eq('id', rfq.client_request_id);
      }

      const fmtMoney = (n: number | null | undefined) =>
        n == null || Number.isNaN(Number(n))
          ? ''
          : `${bid.currency} ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

      const varsBase = {
        vendor_name: '{{vendor_name}}',
        contact_name: '{{contact_name}}',
        country: rfq.country?.name || '',
        deadline: new Date(rfq.deadline).toLocaleString(),
        deadline_countdown: '0h',
        magic_link: '{{magic_link}}',
        scope_summary: rfq.scope_summary || '',
        qty: rfq.quantity || 1,
        owner_name: user?.email?.split('@')[0] || 'RemoAsset',
        rfq_type_label: rfq.rfq_type,
        finalized_price: fmtMoney(bid.quoted_price),
        finalized_landed: fmtMoney(bid.total_landed) || fmtMoney(bid.quoted_price),
      };
      const win = buildAwardEmail(varsBase, true);
      const lose = buildAwardEmail(varsBase, false);
      await invokeRfqCampaign({
        action: 'award_emails',
        rfq_id: rfq.id,
        winner_vendor_id: bid.vendor_id,
        winner: win,
        loser: lose,
      });

      setChecklist((c) => ({ ...c, pricing: true, file: true, winnerMail: true, loserMail: true }));
      setAwardOpen(false);
      setTab('checklist');
      toast({
        title: 'Awarded & notified',
        description: `${bid.vendor?.company_name || 'Winner'} selected. Other partners emailed with the finalized price.`,
      });
      load();
    } catch (e) {
      toast({ title: 'Award failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!rfq || !isAdmin) return;
    setDeleting(true);
    await supabase.from('rfqs' as any).update({ awarded_bid_id: null }).eq('id', rfq.id);
    const { error } = await supabase.from('rfqs' as any).delete().eq('id', rfq.id);
    setDeleting(false);
    if (error) {
      toast({ title: 'Failed to delete RFQ', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'RFQ deleted', description: `${rfq.client?.name || 'Campaign'} removed.` });
    navigate('/rfq');
  };

  const openAward = (bid: RfqBid) => {
    setAwardBidId(bid.id);
    setWeakOk(false);
    setAwardOpen(true);
  };

  const openRevise = (bid: RfqBid) => {
    setReviseBid(bid);
    setReviseNote(bid.revision_note || '');
    setReviseOpen(true);
  };

  if (loading || !rfq) {
    return (
      <AppLayout>
        <div className="p-6 text-sm text-muted-foreground">Loading campaign…</div>
      </AppLayout>
    );
  }

  const scopeLong = (rfq.scope_summary || '').split('\n').length > 3 || (rfq.scope_summary || '').length > 180;
  const cartLines = asRfqCartLines(rfq.line_items);

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" className="rounded-xl -ml-2 cursor-pointer" onClick={() => navigate('/rfq')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> All RFQs
        </Button>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{rfq.client?.name}</h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge>{RFQ_STATUS_LABELS[rfq.status]}</Badge>
                </TooltipTrigger>
                <TooltipContent>{RFQ_STATUS_HELP[rfq.status]}</TooltipContent>
              </Tooltip>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {rfq.country?.name} · Qty {rfq.quantity} · {formatCountdown(rfq.deadline)} left
            </p>
            <p className="text-sm tabular-nums text-muted-foreground mt-1">
              Sent {roll.sent} · Opened {roll.opened} · Quoted {roll.quoted}
            </p>
            {cartLines.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {cartLines.map((line, i) => (
                  <li key={line.id || i} className="text-muted-foreground">
                    <span className="text-foreground">{cartLineLabel(line)}</span>
                    {' · '}×{Number(line.quantity) || 1}
                    {line.category ? ` · ${line.category}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {rfq.scope_summary && (
              <div className="mt-3">
                <p className={`text-sm whitespace-pre-wrap ${!briefOpen && scopeLong ? 'line-clamp-3' : ''}`}>
                  {rfq.scope_summary}
                </p>
                {scopeLong && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-0 mt-1 cursor-pointer"
                    onClick={() => setBriefOpen((v) => !v)}
                  >
                    {briefOpen ? <><ChevronUp className="h-3.5 w-3.5 mr-1" /> Less</> : <><ChevronDown className="h-3.5 w-3.5 mr-1" /> Brief</>}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {rfq.status === 'draft' && (
              <Button className="rounded-xl cursor-pointer" disabled={busy} onClick={sendDraft}>
                <Send className="h-4 w-4 mr-2" /> Send campaign
              </Button>
            )}
            {rfq.status !== 'draft' && rfq.status !== 'awarded' && (
              <Button
                variant="outline"
                className="rounded-xl cursor-pointer"
                disabled={busy}
                onClick={remind}
              >
                <Bell className="h-4 w-4 mr-2" /> Remind non-responders
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="outline"
                className="rounded-xl text-destructive hover:text-destructive cursor-pointer"
                disabled={busy || deleting}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-xl flex-wrap h-auto">
            <TabsTrigger value="recipients">Recipients ({recipients.length})</TabsTrigger>
            <TabsTrigger value="bids">Quotes ({bids.length})</TabsTrigger>
            <TabsTrigger value="emails">Emails ({emails.length})</TabsTrigger>
            <TabsTrigger value="checklist">Handoff</TabsTrigger>
          </TabsList>

          <TabsContent value="recipients" className="mt-3">
            <Card className="card-shadow overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipients.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No recipients on this campaign yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {recipients.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.vendor?.company_name}</TableCell>
                      <TableCell className="text-sm">{r.email}</TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary">{RFQ_RECIPIENT_STATUS_LABELS[r.status]}</Badge>
                          </TooltipTrigger>
                          <TooltipContent>{RFQ_RECIPIENT_HELP[r.status]}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{recipientActivity(r)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="bids" className="mt-3 space-y-3">
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={() => setSpreadsheet((v) => !v)}
              >
                <Table2 className="h-4 w-4 mr-1" />
                {spreadsheet ? 'Card view' : 'Spreadsheet view'}
              </Button>
            </div>
            {spreadsheet ? (
              <Card className="card-shadow overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Quoted</TableHead>
                      <TableHead>MRP</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Shipping</TableHead>
                      <TableHead>Tax</TableHead>
                      <TableHead>Other</TableHead>
                      <TableHead>Landed</TableHead>
                      <TableHead>USD (live)</TableHead>
                      <TableHead>Lead</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bids.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                          No quotes yet.
                        </TableCell>
                      </TableRow>
                    )}
                    {bids.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium whitespace-nowrap">{b.vendor?.company_name || '—'}</TableCell>
                        <TableCell className="tabular-nums">{money(b.currency, b.quoted_price)}</TableCell>
                        <TableCell className="tabular-nums">{money(b.currency, b.mrp_price)}</TableCell>
                        <TableCell className="tabular-nums">{b.discount_pct != null ? `${b.discount_pct}%` : '—'}</TableCell>
                        <TableCell className="tabular-nums">{money(b.currency, b.shipping_fee)}</TableCell>
                        <TableCell className="tabular-nums">{money(b.currency, b.tax_fee)}</TableCell>
                        <TableCell className="tabular-nums">{money(b.currency, b.other_fees)}</TableCell>
                        <TableCell className="tabular-nums font-semibold">{money(b.currency, b.total_landed)}</TableCell>
                        <TableCell className="tabular-nums font-semibold">{money('USD', usdOf(b.total_landed ?? b.quoted_price, b.currency, usdRates))}</TableCell>
                        <TableCell>{b.lead_time_days != null ? `${b.lead_time_days}d` : '—'}</TableCell>
                        <TableCell><Badge variant="outline">{b.pricing_status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            ) : (
              <RfqBidCards
                bids={bids}
                rfqStatus={rfq.status}
                rfqLines={rfq.line_items}
                usdRates={usdRates}
                onAward={openAward}
                onRevise={openRevise}
                onOpenFile={openQuotation}
              />
            )}
          </TabsContent>

          <TabsContent value="emails" className="mt-3">
            <Card className="card-shadow divide-y">
              {emails.length === 0 && (
                <p className="p-6 text-sm text-muted-foreground">No emails logged yet.</p>
              )}
              {emails.map((e) => (
                <details key={e.id} className="p-4">
                  <summary className="cursor-pointer text-sm font-medium flex flex-wrap gap-2 items-center">
                    <Badge variant="secondary">{e.kind.replace(/_/g, ' ')}</Badge>
                    <span>{e.subject}</span>
                    <span className="text-muted-foreground font-normal">→ {e.to_email}</span>
                    <span className="text-xs text-muted-foreground ml-auto">{new Date(e.sent_at).toLocaleString()}</span>
                  </summary>
                  <div className="mt-3 text-xs text-muted-foreground">
                    CC: {(e.cc_emails || []).join(', ') || '—'}
                    {e.resend_message_id && (
                      <span className="block mt-1">Resend id: {e.resend_message_id}</span>
                    )}
                  </div>
                  <div className="mt-2 max-h-64 overflow-auto border rounded-lg p-3 bg-muted/20" dangerouslySetInnerHTML={{ __html: e.body_html }} />
                </details>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="checklist" className="mt-3">
            <Card className="card-shadow p-5 space-y-3">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckSquare className="h-4 w-4" /> Post-award handoff
              </p>
              {([
                ['pricing', 'Pricing accepted on the linked client request'],
                ['file', 'Quotation file available on the request / bid'],
                ['winnerMail', 'Winner notified'],
                ['loserMail', 'Other bidders notified'],
                ['po', 'PO / order placed'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checklist[key]}
                    onChange={(e) => setChecklist((c) => ({ ...c, [key]: e.target.checked }))}
                  />
                  <span>{label}</span>
                </label>
              ))}
              {rfq.award_rationale && (
                <div className="text-sm mt-4 rounded-lg border bg-muted/30 p-3">
                  <span className="font-semibold">Award rationale:</span> {rfq.award_rationale}
                </div>
              )}
              {rfq.client_request_id && (
                <Button variant="default" className="rounded-xl mt-2 cursor-pointer" onClick={() => navigate(`/clients/${rfq.client_id}`)}>
                  Open client
                </Button>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={awardOpen} onOpenChange={(open) => { setAwardOpen(open); if (!open) setWeakOk(false); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Award this RFQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {awardBid && (
              <p className="text-sm">
                <strong>{awardBid.vendor?.company_name}</strong>
                {' · '}
                {money('USD', usdOf(awardBid.total_landed ?? awardBid.quoted_price, awardBid.currency, usdRates))} live USD
                {' · '}
                {money(awardBid.currency, awardBid.total_landed ?? awardBid.quoted_price)} quoted
              </p>
            )}
            {weakCompetition && (
              <label className="flex items-start gap-2 text-sm rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 cursor-pointer">
                <Checkbox checked={weakOk} onCheckedChange={(c) => setWeakOk(c === true)} className="mt-0.5" />
                <span>Fewer than two quotes — award anyway.</span>
              </label>
            )}
            <Label>Award rationale *</Label>
            <Textarea
              className="rounded-xl"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="e.g. Lowest landed cost, complete quotation PDF"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setAwardOpen(false)}>Cancel</Button>
            <Button
              className="cursor-pointer"
              disabled={busy || !rationale.trim() || (weakCompetition && !weakOk)}
              onClick={confirmAward}
            >
              Confirm award
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviseOpen} onOpenChange={(open) => { setReviseOpen(open); if (!open) setReviseBid(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Request revision</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {reviseBid && (
              <p className="text-sm text-muted-foreground">{reviseBid.vendor?.company_name}</p>
            )}
            <Label>Note for the vendor *</Label>
            <Textarea
              className="rounded-xl"
              value={reviseNote}
              onChange={(e) => setReviseNote(e.target.value)}
              placeholder="What should they change?"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="cursor-pointer" onClick={() => setReviseOpen(false)}>Cancel</Button>
            <Button className="cursor-pointer" disabled={!reviseNote.trim()} onClick={requestRevision}>
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => !deleting && setDeleteOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this RFQ campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete “{rfq.client?.name || 'this campaign'}” and all recipients, bids, and email logs.
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
