import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { campaignRollups, formatCountdown } from '@/lib/rfq';
import { buildAwardEmail, buildRemindEmail } from '@/lib/rfq-email-templates';
import { invokeRfqCampaign } from '@/lib/rfq-api';
import {
  RFQ_RECIPIENT_STATUS_LABELS,
  RFQ_STATUS_LABELS,
  type Rfq,
  type RfqBid,
  type RfqEmail,
  type RfqRecipient,
} from '@/types/rfq';
import { ArrowLeft, Trophy, Bell, CheckSquare, Send, Trash2, FileText } from 'lucide-react';
import { FieldHint, InfoCallout, RFQ_RECIPIENT_HELP, RFQ_STATUS_HELP } from '@/components/rfq/RfqInfo';
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

function money(currency: string, value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${currency} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export default function RfqDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === 'admin';
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [recipients, setRecipients] = useState<RfqRecipient[]>([]);
  const [bids, setBids] = useState<RfqBid[]>([]);
  const [emails, setEmails] = useState<RfqEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardBidId, setAwardBidId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');
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
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const roll = useMemo(() => campaignRollups(recipients), [recipients]);

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

  const requestRevision = async (bid: RfqBid) => {
    const note = window.prompt('Revision note for vendor:') || 'Please revise your pricing.';
    await supabase.from('rfq_bids' as any).update({
      pricing_status: 'revision_requested',
      revision_note: note,
    }).eq('id', bid.id);
    if (rfq?.client_request_id) {
      await supabase.from('client_requests' as any).update({ status: 'pricing_review' }).eq('id', rfq.client_request_id);
    }
    toast({ title: 'Revision requested' });
    load();
  };

  const confirmAward = async () => {
    if (!rfq || !awardBidId || !rationale.trim()) {
      toast({ title: 'Rationale required', variant: 'destructive' });
      return;
    }
    const bid = bids.find((b) => b.id === awardBidId);
    if (!bid) return;
    if (bids.length < 2) {
      const ok = window.confirm('Fewer than 2 quotes — weak competition. Award anyway?');
      if (!ok) return;
    }
    setBusy(true);
    try {
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
          vendor_price_usd: bid.quoted_price,
          mrp_usd: bid.mrp_price,
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

  if (loading || !rfq) {
    return (
      <AppLayout>
        <div className="p-6 text-sm text-muted-foreground">Loading campaign details…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" className="rounded-xl -ml-2" onClick={() => navigate('/rfq')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> All RFQs
        </Button>

        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{rfq.client?.name}</h1>
              <Badge>{RFQ_STATUS_LABELS[rfq.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {RFQ_STATUS_HELP[rfq.status]}
            </p>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap border-l-2 border-primary/30 pl-3">
              {rfq.scope_summary || 'No scope written for this campaign.'}
            </p>
            <p className="text-sm mt-3 tabular-nums">
              <strong>{rfq.country?.name}</strong> · Qty {rfq.quantity} · Types:{' '}
              {(rfq.target_vendor_types || []).join(', ') || '—'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Deadline <strong className="text-foreground">{new Date(rfq.deadline).toLocaleString()}</strong>
              {' '}({formatCountdown(rfq.deadline)} left)
            </p>
            <p className="text-sm mt-2 tabular-nums rounded-lg bg-muted/50 inline-block px-3 py-1.5">
              Campaign: Sent {roll.sent} · Opened {roll.opened} · Quoted {roll.quoted} · Declined {roll.declined}
              {roll.bounced > 0 && ` · Bounced ${roll.bounced}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rfq.status === 'draft' && (
              <Button className="rounded-xl" disabled={busy} onClick={sendDraft} title="Email all pending recipients">
                <Send className="h-4 w-4 mr-2" /> Send campaign
              </Button>
            )}
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={busy || rfq.status === 'draft'}
              onClick={remind}
              title="Email vendors who have not quoted yet"
            >
              <Bell className="h-4 w-4 mr-2" /> Remind silent
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                className="rounded-xl text-destructive hover:text-destructive"
                disabled={busy || deleting}
                onClick={() => setDeleteOpen(true)}
                title="Permanently delete this campaign"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </Button>
            )}
          </div>
        </div>

        <Tabs defaultValue="recipients">
          <TabsList className="rounded-xl flex-wrap h-auto">
            <TabsTrigger value="recipients">Recipients ({recipients.length})</TabsTrigger>
            <TabsTrigger value="bids">Bids ({bids.length})</TabsTrigger>
            <TabsTrigger value="emails">Emails ({emails.length})</TabsTrigger>
            <TabsTrigger value="checklist">Handoff checklist</TabsTrigger>
          </TabsList>

          <TabsContent value="recipients" className="space-y-3 mt-3">
            <InfoCallout tone="blue">
              <p>
                Each row is one partner in this campaign.
                <strong> Sent</strong> = emailed · <strong>Opened</strong> = opened the link ·
                <strong> Quoted</strong> = submitted price + mandatory quotation file ·
                <strong> Declined</strong> = opted out. Hover a status badge for more detail.
              </p>
            </InfoCallout>
            <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Quoted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recipients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No recipients on this campaign yet.
                    </TableCell>
                  </TableRow>
                )}
                {recipients.map((r) => (
                  <TableRow key={r.id} title={RFQ_RECIPIENT_HELP[r.status]}>
                    <TableCell className="font-medium">{r.vendor?.company_name}</TableCell>
                    <TableCell className="text-sm">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{RFQ_RECIPIENT_STATUS_LABELS[r.status]}</Badge>
                      <p className="text-[10px] text-muted-foreground mt-1 max-w-[160px] leading-snug hidden xl:block">
                        {RFQ_RECIPIENT_HELP[r.status]}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.opened_at ? new Date(r.opened_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.quoted_at ? new Date(r.quoted_at).toLocaleString() : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </TabsContent>

          <TabsContent value="bids" className="rounded-xl border bg-card mt-3">
            <div className="px-4 pt-4">
              <InfoCallout title="All quote details" tone="emerald">
                <p>
                  Full response from each partner: prices, fees, lead time, notes, and quotation file.
                  Prefer <strong>total landed</strong> (quote + shipping + tax + other) when comparing.
                  Award requires a short rationale for the audit trail.
                </p>
              </InfoCallout>
            </div>
            <div className="overflow-x-auto">
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
                    <TableHead>Landed total</TableHead>
                    <TableHead>Lead time</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bids.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                        No bids yet. When a partner submits a quote, every field they entered will show here.
                      </TableCell>
                    </TableRow>
                  )}
                  {bids.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium whitespace-nowrap">{b.vendor?.company_name || '—'}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">{money(b.currency, b.quoted_price)}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">{money(b.currency, b.mrp_price)}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {b.discount_pct != null ? `${b.discount_pct}%` : '—'}
                        {b.discount_amount != null && (
                          <span className="block text-[10px] text-muted-foreground">
                            {money(b.currency, b.discount_amount)} off
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">{money(b.currency, b.shipping_fee)}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">{money(b.currency, b.tax_fee)}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">{money(b.currency, b.other_fees)}</TableCell>
                      <TableCell className="tabular-nums font-semibold whitespace-nowrap">{money(b.currency, b.total_landed)}</TableCell>
                      <TableCell className="whitespace-nowrap">{b.lead_time_days != null ? `${b.lead_time_days}d` : '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {b.submitted_at ? new Date(b.submitted_at).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px]">
                        {b.notes ? (
                          <span className="line-clamp-3" title={b.notes}>{b.notes}</span>
                        ) : '—'}
                        {b.revision_note && (
                          <span className="block text-amber-600 mt-1" title={b.revision_note}>
                            Revision: {b.revision_note}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {b.quotation_file_path ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-auto px-1 py-0.5 text-xs max-w-[140px]"
                            onClick={() => openQuotation(b)}
                            title={b.quotation_file_name || 'Open quotation'}
                          >
                            <FileText className="h-3.5 w-3.5 mr-1 shrink-0" />
                            <span className="truncate">{b.quotation_file_name || 'Open file'}</span>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.pricing_status}</Badge>
                        {b.award_status === 'won' && <Badge className="bg-emerald-600 ml-1">Won</Badge>}
                        {b.award_status === 'lost' && <Badge variant="secondary" className="ml-1">Lost</Badge>}
                      </TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap">
                        {rfq.status !== 'awarded' && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => requestRevision(b)} title="Ask vendor to revise on the same link">Revise</Button>
                            <Button
                              size="sm"
                              className="rounded-lg"
                              onClick={() => { setAwardBidId(b.id); setAwardOpen(true); }}
                            >
                              <Trophy className="h-3.5 w-3.5 mr-1" /> Award
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="emails" className="mt-3 space-y-3">
            <InfoCallout tone="blue">
              <p>
                Every outbound message (invite, test, remind, award, not selected) is stored here with the exact HTML after your edits,
                plus To/CC and Resend id — so you never need to dig Gmail for “what did we send?”
              </p>
            </InfoCallout>
            <div className="rounded-xl border bg-card divide-y">
            {emails.length === 0 && <p className="p-6 text-sm text-muted-foreground">No emails logged yet. Send the campaign to start the log.</p>}
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
                  {e.resend_message_id && <> · Resend id: {e.resend_message_id}</>}
                </div>
                <div className="mt-2 max-h-64 overflow-auto border rounded-lg p-3 bg-muted/20" dangerouslySetInnerHTML={{ __html: e.body_html }} />
              </details>
            ))}
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="rounded-xl border bg-card mt-3 p-5 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <CheckSquare className="h-4 w-4" /> Post-award handoff
            </p>
            <p className="text-sm text-muted-foreground">
              After you award, tick these so fulfillment does not stall between “winner picked” and PO / shipping.
            </p>
            {([
              ['pricing', 'Pricing accepted on the linked client request'],
              ['file', 'Quotation file available on the request / bid'],
              ['winnerMail', 'Winner notified (award email logged)'],
              ['loserMail', 'Other bidders notified (not selected)'],
              ['po', 'PO / order placed — move request to Ordered / PO sent'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 text-sm">
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
                <span className="font-semibold">Award rationale on file:</span> {rfq.award_rationale}
              </div>
            )}
            {rfq.client_request_id && (
              <Button variant="outline" className="rounded-xl mt-2" onClick={() => navigate(`/clients/${rfq.client_id}`)}>
                Open client to continue fulfillment
              </Button>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={awardOpen} onOpenChange={setAwardOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Award this RFQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This marks the vendor as winner, accepts pricing, updates the client request, and emails
              the winner plus every other partner who was invited — with a warm note that we went with
              someone else on price, and the finalized amount we locked in.
            </p>
            <Label>Award rationale (required for audit)</Label>
            <Textarea
              className="rounded-xl"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="e.g. Lowest landed cost, 18% off MRP, 7-day lead time, complete quotation PDF"
            />
            <FieldHint>If fewer than 2 quotes exist you will get a weak-competition warning before confirm.</FieldHint>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAwardOpen(false)}>Cancel</Button>
            <Button disabled={busy || !rationale.trim()} onClick={confirmAward}>Confirm award</Button>
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
