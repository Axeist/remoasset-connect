import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { computeBidPricing, formatCountdown } from '@/lib/rfq';
import { fileToBase64, invokeRfqPublic } from '@/lib/rfq-api';
import { Clock, Paperclip } from 'lucide-react';

type PublicView = 'bid_form' | 'submitted' | 'revise' | 'won' | 'lost' | 'closed';

const fieldClass =
  'h-12 rounded-xl border-[#E6E3DE] bg-white text-[#30282B] placeholder:text-[#9A958C] shadow-none focus-visible:ring-[#EA6E35]/25 focus-visible:ring-offset-0';

function RfqPublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="rfq-public min-h-screen bg-[#F3F0EB] text-[#30282B]" style={{ colorScheme: 'light', fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <header className="bg-[#30282B] px-4 py-4">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-1.5">
          <img
            src="/logo-dark.png"
            alt="Remoasset"
            className="h-9 w-auto object-contain"
            style={{ mixBlendMode: 'lighten' }}
          />
          <p className="text-[#C4B8B0] text-[11px] tracking-wide uppercase font-semibold">Partner quote</p>
        </div>
      </header>
      {children}
    </div>
  );
}

export default function RfqRespond() {
  const { token } = useParams<{ token: string }>();
  const [search] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<PublicView>('bid_form');
  const [payload, setPayload] = useState<any>(null);
  const [quoted, setQuoted] = useState('');
  const [mrp, setMrp] = useState('');
  const [shipping, setShipping] = useState('0');
  const [tax, setTax] = useState('0');
  const [other, setOther] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [leadTime, setLeadTime] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [declineConfirm, setDeclineConfirm] = useState(false);

  const insight = useMemo(() => {
    const q = parseFloat(quoted);
    const m = parseFloat(mrp);
    if (!Number.isFinite(q)) return null;
    return computeBidPricing({
      quotedPrice: q,
      mrpPrice: Number.isFinite(m) ? m : null,
      shippingFee: parseFloat(shipping) || 0,
      taxFee: parseFloat(tax) || 0,
      otherFees: parseFloat(other) || 0,
    });
  }, [quoted, mrp, shipping, tax, other]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        await invokeRfqPublic({ action: 'open', token });
        const data = await invokeRfqPublic({ action: 'get', token });
        setPayload(data);
        setView(data.view as PublicView);
        if (data.bid) {
          setQuoted(String(data.bid.quoted_price ?? ''));
          setMrp(data.bid.mrp_price != null ? String(data.bid.mrp_price) : '');
          setCurrency(data.bid.currency || 'USD');
          setLeadTime(data.bid.lead_time_days != null ? String(data.bid.lead_time_days) : '');
          setValidUntil(data.bid.quote_valid_until || '');
          setNotes(data.bid.notes || '');
        }
        if (search.get('decline') === '1' && data.view === 'bid_form') {
          setDeclineConfirm(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, search]);

  const submit = async () => {
    if (!token || !file) {
      setError('Attach a quotation file to send.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const b64 = await fileToBase64(file);
      await invokeRfqPublic({
        action: 'submit',
        token,
        quoted_price: parseFloat(quoted),
        mrp_price: mrp ? parseFloat(mrp) : null,
        shipping_fee: parseFloat(shipping) || 0,
        tax_fee: parseFloat(tax) || 0,
        other_fees: parseFloat(other) || 0,
        currency,
        lead_time_days: leadTime ? parseInt(leadTime, 10) : null,
        quote_valid_until: validUntil || null,
        notes,
        file_base64: b64,
        file_name: file.name,
        file_content_type: file.type || 'application/pdf',
      });
      setDoneMsg('Quote submitted. RemoAsset is reviewing pricing.');
      setView('submitted');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const decline = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await invokeRfqPublic({ action: 'decline', token, reason: notes || null });
      setDoneMsg('You declined this RFQ.');
      setView('closed');
      setDeclineConfirm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <RfqPublicShell>
        <div className="grid place-items-center py-24 text-sm text-[#6E7180]">Loading RFQ…</div>
      </RfqPublicShell>
    );
  }

  if (error && !payload) {
    const isPlaceholder = token === 'test';
    return (
      <RfqPublicShell>
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-3">
          <h1 className="text-xl font-bold">
            {isPlaceholder ? 'This was a placeholder test link' : 'Link invalid or expired'}
          </h1>
          <p className="text-sm text-[#6E7180] leading-relaxed">
            {isPlaceholder
              ? 'Raise the RFQ again and use Test send — that email includes a working partner link.'
              : (error || 'Ask RemoAsset for a fresh invite.')}
          </p>
        </div>
      </RfqPublicShell>
    );
  }

  const rfq = payload?.rfq;
  const deadline = rfq?.deadline as string;
  const urgent = deadline ? new Date(deadline).getTime() - Date.now() < 4 * 3600_000 : false;
  const heading =
    view === 'won' ? 'You’re selected'
    : view === 'lost' ? 'Not selected this round'
    : view === 'submitted' ? 'Quote received'
    : view === 'revise' ? 'Please revise your quote'
    : view === 'closed' ? 'This RFQ is closed'
    : 'Your quote';

  return (
    <RfqPublicShell>
      <div className="max-w-lg mx-auto px-4 py-6 pb-10">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h1 className="text-[1.65rem] font-bold tracking-tight leading-tight">{heading}</h1>
            <p className="text-sm text-[#6E7180] mt-1 truncate">
              {payload?.vendor_name && <span className="text-[#30282B] font-medium">{payload.vendor_name}</span>}
              {payload?.vendor_name && ' · '}
              {rfq?.client_name}
              {rfq?.country_name && ` · ${rfq.country_name}`}
            </p>
          </div>
          {deadline && view !== 'won' && view !== 'lost' && view !== 'closed' && (
            <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              urgent ? 'bg-[#EA6E35] text-white' : 'bg-[#30282B] text-white'
            }`}>
              <Clock className="h-3 w-3" />
              {formatCountdown(deadline)}
            </span>
          )}
        </div>

        {rfq?.scope_summary && (
          <div className="rounded-2xl bg-white border border-[#E8E4DE] px-4 py-3 mb-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{rfq.scope_summary}</p>
              <span className="shrink-0 text-xs font-semibold text-[#6E7180] bg-[#F3F0EB] rounded-full px-2 py-0.5">
                Qty {rfq.quantity}
              </span>
            </div>
          </div>
        )}

        {view === 'revise' && payload?.bid?.revision_note && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-sm text-amber-950">
            {payload.bid.revision_note}
          </div>
        )}

        {declineConfirm && (view === 'bid_form' || view === 'revise') && (
          <div className="rounded-2xl bg-white border border-[#E8E4DE] p-5 space-y-3 shadow-[0_8px_30px_rgba(48,40,43,0.06)]">
            <p className="font-semibold text-lg">Decline this RFQ?</p>
            <p className="text-sm text-[#6E7180]">We’ll stop reminders. You can still quote from the original email.</p>
            <Label className="text-[#30282B]">Optional reason</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fieldClass} min-h-[88px] h-auto`} placeholder="Capacity, spec, timing…" />
            {error && <p className="text-sm text-[#D94F4F]">{error}</p>}
            <Button className="w-full h-12 rounded-xl font-semibold bg-[#EA6E35] hover:bg-[#d9622f] text-white cursor-pointer" disabled={submitting} onClick={decline}>
              {submitting ? 'Declining…' : 'Confirm decline'}
            </Button>
            <Button variant="ghost" className="w-full rounded-xl cursor-pointer text-[#6E7180]" disabled={submitting} onClick={() => setDeclineConfirm(false)}>
              Go back and quote
            </Button>
          </div>
        )}

        {(view === 'won' || view === 'lost' || view === 'submitted' || view === 'closed') && (
          <div className="rounded-2xl bg-white border border-[#E8E4DE] p-5 space-y-3 shadow-[0_8px_30px_rgba(48,40,43,0.06)] text-sm">
            {doneMsg && <p className="font-medium">{doneMsg}</p>}
            {view === 'won' && <p>Pricing is accepted. RemoAsset will follow up on next steps.</p>}
            {view === 'lost' && <p>Another partner was selected. You’re still on the Closed network for future RFQs.</p>}
            {view === 'submitted' && <p>Under review. You can edit until the campaign closes.</p>}
            {payload?.bid && (
              <div className="rounded-xl bg-[#F3F0EB] px-3 py-3 space-y-1">
                <p className="text-lg font-bold tabular-nums">
                  {payload.bid.currency} {payload.bid.quoted_price}
                </p>
                {payload.bid.total_landed != null && (
                  <p className="text-[#6E7180]">Landed {payload.bid.currency} {payload.bid.total_landed}</p>
                )}
                {payload.bid.quotation_file_name && <p className="text-[#6E7180]">{payload.bid.quotation_file_name}</p>}
              </div>
            )}
            {(view === 'submitted' || view === 'revise') && (
              <Button variant="outline" className="rounded-xl cursor-pointer border-[#E6E3DE]" onClick={() => setView(view === 'revise' ? 'revise' : 'bid_form')}>
                {view === 'revise' ? 'Enter revised quote' : 'Edit quote'}
              </Button>
            )}
          </div>
        )}

        {(view === 'bid_form' || view === 'revise') && !declineConfirm && (
          <div className="rounded-2xl bg-white border border-[#E8E4DE] p-5 space-y-5 shadow-[0_8px_30px_rgba(48,40,43,0.06)]">
            <div className="grid grid-cols-[1fr_5.5rem] gap-2">
              <div className="space-y-1.5">
                <Label className="text-[#30282B]">Your price *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={quoted}
                  onChange={(e) => setQuoted(e.target.value)}
                  className={`${fieldClass} text-lg font-semibold tabular-nums`}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#30282B]">Currency</Label>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className={fieldClass} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#30282B]">MRP / list {rfq?.rfq_type === 'fulfillment' ? '*' : '(optional)'}</Label>
              <Input type="number" min={0} step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} className={fieldClass} placeholder="Public list price" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9A958C] mb-2">Fees (optional)</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-[#6E7180]">Shipping</Label>
                  <Input type="number" min={0} step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} className={fieldClass} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-[#6E7180]">Tax</Label>
                  <Input type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className={fieldClass} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-[#6E7180]">Other</Label>
                  <Input type="number" min={0} step="0.01" value={other} onChange={(e) => setOther(e.target.value)} className={fieldClass} />
                </div>
              </div>
            </div>

            {insight && (
              <div className="flex items-center justify-between rounded-xl bg-[#30282B] text-white px-4 py-3">
                <span className="text-sm text-white/70">
                  {insight.discount_pct != null ? `${insight.discount_pct}% off MRP` : 'Landed total'}
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {currency} {insight.total_landed.toLocaleString()}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[#30282B]">Lead time (days)</Label>
                <Input type="number" min={0} value={leadTime} onChange={(e) => setLeadTime(e.target.value)} className={fieldClass} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#30282B]">Valid until</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={fieldClass} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#30282B]">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${fieldClass} min-h-[72px] h-auto`}
                placeholder="Warranty, inclusions…"
              />
            </div>

            <div>
              <Label className="text-[#30282B]">Quotation file *</Label>
              <label className="mt-1.5 flex items-center gap-3 rounded-xl border border-dashed border-[#D9D4CC] bg-[#FAF8F5] px-3 py-3 cursor-pointer hover:border-[#EA6E35]/50 transition-colors duration-200">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-[#E6E3DE] shrink-0">
                  <Paperclip className="h-4 w-4 text-[#EA6E35]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium truncate">{file ? file.name : 'PDF or image'}</span>
                  <span className="block text-xs text-[#9A958C]">Required to submit</span>
                </span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {error && <p className="text-sm text-[#D94F4F]">{error}</p>}

            <Button
              className="w-full h-12 rounded-xl font-semibold bg-[#EA6E35] hover:bg-[#d9622f] text-white cursor-pointer transition-colors duration-200"
              disabled={submitting}
              onClick={submit}
            >
              {submitting ? 'Submitting…' : 'Send quote'}
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm text-[#6E7180] hover:text-[#30282B] cursor-pointer py-1"
              disabled={submitting}
              onClick={() => setDeclineConfirm(true)}
            >
              Decline this RFQ
            </button>
          </div>
        )}
      </div>
    </RfqPublicShell>
  );
}
