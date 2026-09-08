import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { computeBidPricing, formatCountdown } from '@/lib/rfq';
import { fileToBase64, invokeRfqPublic } from '@/lib/rfq-api';

type PublicView = 'bid_form' | 'submitted' | 'revise' | 'won' | 'lost' | 'closed';

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
      setError('Quotation file is mandatory');
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
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading RFQ…</div>;
  }

  if (error && !payload) {
    const isPlaceholder = token === 'test';
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center bg-[#F0F0F5]" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
        <div className="max-w-md space-y-3">
          <p className="text-lg font-bold text-[#30282B]">
            {isPlaceholder ? 'This was a placeholder test link' : 'Link invalid or expired'}
          </p>
          <p className="text-sm text-[#6E7180] leading-relaxed">
            {isPlaceholder
              ? 'Older test emails used /rfq/respond/test, which is not a real quote link. Raise the RFQ again and use Test send — the new email includes a working partner link.'
              : (error || 'This quote link is not valid. Ask RemoAsset for a fresh invite.')}
          </p>
        </div>
      </div>
    );
  }

  const rfq = payload?.rfq;
  const deadline = rfq?.deadline as string;
  const urgent = deadline ? new Date(deadline).getTime() - Date.now() < 4 * 3600_000 : false;

  return (
    <div className="min-h-screen bg-[#F0F0F5] text-[#30282B]" style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <div className="bg-[#30282B] text-white px-4 py-5">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-xl font-extrabold tracking-tight" style={{ fontFamily: "'Outfit', Manrope, sans-serif" }}>
            Remo<span className="text-[#EA6E35]">Asset</span>
          </p>
          <p className="text-[#9DA2B3] text-xs mt-1">Partner quote</p>
        </div>
      </div>

      {deadline && view !== 'won' && view !== 'lost' && view !== 'closed' && (
        <div className={`px-4 py-3 text-center text-sm font-semibold ${urgent ? 'bg-[#EA6E35] text-white' : 'bg-[#FFF6F0] text-[#30282B] border-b border-[#F5D0B8]'}`}>
          Due {new Date(deadline).toLocaleString()} · {formatCountdown(deadline)} left
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {view === 'won' && 'You’re selected — pricing accepted'}
            {view === 'lost' && 'Not selected this round'}
            {view === 'submitted' && 'Quote received — under review'}
            {view === 'revise' && 'RemoAsset needs a revised quote'}
            {view === 'closed' && 'This RFQ is closed'}
            {view === 'bid_form' && 'Submit your quote'}
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            {payload?.vendor_name && <>For <strong>{payload.vendor_name}</strong> · </>}
            {rfq?.country_name} · {rfq?.client_name}
          </p>
        </div>

        {rfq?.scope_summary && (
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Scope</p>
            <p className="text-sm whitespace-pre-wrap">{rfq.scope_summary}</p>
            <p className="text-sm mt-2 text-slate-600">Quantity: {rfq.quantity}</p>
          </div>
        )}

        {view === 'revise' && payload?.bid?.revision_note && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>RemoAsset note:</strong> {payload.bid.revision_note}
          </div>
        )}

        {declineConfirm && (view === 'bid_form' || view === 'revise') && (
          <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
            <p className="font-semibold">Decline this RFQ?</p>
            <p className="text-sm text-slate-600">We’ll stop reminders for this request. You can still quote later from the original email.</p>
            <Label>Optional reason</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="rounded-xl" placeholder="Capacity, spec, timing…" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full rounded-xl h-11 font-semibold bg-[#EA6E35] hover:bg-[#d9622f] text-white cursor-pointer" disabled={submitting} onClick={decline}>
              {submitting ? 'Declining…' : 'Confirm decline'}
            </Button>
            <Button variant="ghost" className="w-full rounded-xl cursor-pointer" disabled={submitting} onClick={() => setDeclineConfirm(false)}>
              Go back and quote
            </Button>
          </div>
        )}

        {(view === 'won' || view === 'lost' || view === 'submitted' || view === 'closed') && (
          <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-2 text-sm">
            {doneMsg && <p className="font-medium">{doneMsg}</p>}
            {view === 'won' && (
              <p>You won this RFQ. RemoAsset accepted your pricing and will follow up on next steps.</p>
            )}
            {view === 'lost' && (
              <p>Another partner was selected. You remain on the Closed network for future RFQs.</p>
            )}
            {view === 'submitted' && (
              <p>Your quote is under review. You can edit and resubmit until the campaign closes.</p>
            )}
            {payload?.bid && (
              <div className="rounded-lg bg-slate-50 border p-3 text-slate-700 space-y-1">
                <p>
                  Your quote: <strong>{payload.bid.currency} {payload.bid.quoted_price}</strong>
                  {payload.bid.discount_pct != null && <> · {payload.bid.discount_pct}% off MRP</>}
                </p>
                {payload.bid.total_landed != null && (
                  <p>Total landed: <strong>{payload.bid.currency} {payload.bid.total_landed}</strong></p>
                )}
                {payload.bid.quotation_file_name && <p>File: {payload.bid.quotation_file_name}</p>}
              </div>
            )}
            {(view === 'submitted' || view === 'revise') && (
              <Button variant="outline" className="rounded-xl mt-2 cursor-pointer" onClick={() => setView(view === 'revise' ? 'revise' : 'bid_form')}>
                {view === 'revise' ? 'Enter revised quote' : 'Edit / resubmit quote'}
              </Button>
            )}
          </div>
        )}

        {(view === 'bid_form' || view === 'revise') && !declineConfirm && (
          <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-6">
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Offer</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Quoted price *</Label>
                  <Input type="number" min={0} step="0.01" value={quoted} onChange={(e) => setQuoted(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value)} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>MRP / list {rfq?.rfq_type === 'fulfillment' ? '*' : '(optional)'}</Label>
                <Input type="number" min={0} step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} className="rounded-xl" />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Landed extras</h2>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5">
                  <Label>Shipping</Label>
                  <Input type="number" min={0} step="0.01" value={shipping} onChange={(e) => setShipping(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tax / VAT</Label>
                  <Input type="number" min={0} step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Other</Label>
                  <Input type="number" min={0} step="0.01" value={other} onChange={(e) => setOther(e.target.value)} className="rounded-xl" />
                </div>
              </div>
              {insight && (
                <div className="sticky bottom-2 rounded-xl bg-[#30282B] text-white px-3 py-2 text-sm tabular-nums">
                  {insight.discount_pct != null && <span className="mr-3 opacity-80">{insight.discount_pct}% off MRP</span>}
                  <strong>Total landed: {currency} {insight.total_landed.toLocaleString()}</strong>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Terms</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Lead time (days)</Label>
                  <Input type="number" min={0} value={leadTime} onChange={(e) => setLeadTime(e.target.value)} className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Valid until</Label>
                  <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="rounded-xl" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-xl"
                  placeholder="Warranty, inclusions…"
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">File</h2>
              <div className="space-y-1.5">
                <Label>Quotation PDF or image *</Label>
                <Input
                  type="file"
                  accept=".pdf,image/*"
                  className="rounded-xl"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
            </section>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full rounded-xl h-11 font-semibold bg-[#EA6E35] hover:bg-[#d9622f] text-white cursor-pointer" disabled={submitting} onClick={submit}>
              {submitting ? 'Submitting…' : 'Send your quote'}
            </Button>
            <Button variant="ghost" className="w-full rounded-xl text-[#6E7180] cursor-pointer" disabled={submitting} onClick={() => setDeclineConfirm(true)}>
              Decline this RFQ
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-[#9DA2B3] pb-8">RemoAsset · Global IT asset lifecycle</p>
      </div>
    </div>
  );
}
