import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  EXTRA_TYPES,
  addonLabel,
  addonQuoteId,
  alternativeLabel,
  asBidQuoteLines,
  asRfqCartLines,
  cartLineLabel,
  computeBidPricing,
  extraTypeLabel,
  formatCountdown,
  isExtraQuoteLine,
  parseExtraType,
  quoteGoodsTotal,
  quoteMrpTotal,
  quoteableCartRows,
  type BidAlternativeSpec,
  type BidQuoteLine,
  type ExtraType,
  type RfqCartLine,
} from '@/lib/rfq';
import { fileToBase64, invokeRfqPublic } from '@/lib/rfq-api';
import { convertToUsd, formatUsdRateLine, getRateToUsd } from '@/lib/fx-rates';
import { FX_CURRENCY_OPTIONS } from '@/lib/country-currencies';
import { Clock, Paperclip, Plus, Trash2 } from 'lucide-react';

type PublicView = 'bid_form' | 'submitted' | 'revise' | 'won' | 'lost' | 'closed';
type LineQuote = { unit: string; mrp: string };
type ExtraRow = {
  id: string;
  extra_type: ExtraType;
  label: string;
  qty: string;
  unit: string;
  mrp: string;
};

const fieldClass =
  'h-12 rounded-xl border-[#E6E3DE] bg-white text-[#30282B] placeholder:text-[#9A958C] shadow-none focus-visible:ring-[#EA6E35]/25 focus-visible:ring-offset-0';
const fieldSm = fieldClass.replace('h-12', 'h-10');

function moneyFmt(currency: string, n: number) {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emptyAltFromLine(line: RfqCartLine): BidAlternativeSpec {
  return {
    brand: line.brand || '',
    device_model: line.device_model || '',
    processor: line.processor || '',
    ram: line.ram || '',
    storage: line.storage || '',
  };
}

function deliveryNotes(scope: string | undefined): string {
  return (scope || '').split('Delivery / notes:')[1]?.trim() || '';
}

function newExtra(): ExtraRow {
  return {
    id: `extra::${crypto.randomUUID()}`,
    extra_type: 'warranty',
    label: '',
    qty: '1',
    unit: '',
    mrp: '',
  };
}

function extrasToQuoteLines(extras: ExtraRow[]): BidQuoteLine[] {
  return extras
    .map((e) => {
      const unit = parseFloat(e.unit);
      const label = e.label.trim();
      if (!label || !Number.isFinite(unit)) return null;
      return {
        id: e.id,
        kind: 'extra' as const,
        extra_type: e.extra_type,
        label,
        qty: Math.max(1, parseInt(e.qty, 10) || 1),
        unit_price: unit,
        mrp_price: e.mrp ? parseFloat(e.mrp) : null,
      };
    })
    .filter((x): x is BidQuoteLine => x != null);
}

function RfqPublicShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="rfq-public min-h-dvh lg:h-dvh lg:overflow-hidden bg-[#F3F0EB] text-[#30282B] flex flex-col"
      style={{ colorScheme: 'light', fontFamily: "'Manrope', system-ui, sans-serif" }}
    >
      <header className="bg-[#30282B] px-4 py-3 lg:py-4 shrink-0">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-1.5 lg:max-w-7xl lg:flex-row lg:items-center lg:justify-between lg:px-2">
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

function SpecBits({ line }: { line: RfqCartLine }) {
  const bits = [
    line.processor && { k: 'CPU', v: line.processor },
    line.ram && { k: 'RAM', v: line.ram },
    line.storage && { k: 'Storage', v: line.storage },
    line.category && { k: 'Category', v: line.category },
  ].filter(Boolean) as { k: string; v: string }[];
  if (bits.length === 0 && !line.notes) return null;
  return (
    <div className="mt-2 space-y-1">
      {bits.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {bits.map((b) => (
            <div key={b.k}>
              <dt className="text-[#9A958C]">{b.k}</dt>
              <dd className="text-[#30282B] font-medium">{b.v}</dd>
            </div>
          ))}
        </dl>
      )}
      {line.notes ? <p className="text-xs text-[#6E7180] whitespace-pre-wrap">{line.notes}</p> : null}
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
  const [lineQuotes, setLineQuotes] = useState<Record<string, LineQuote>>({});
  const [alternatives, setAlternatives] = useState<Record<string, BidAlternativeSpec | null>>({});
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [fxRate, setFxRate] = useState<number | null>(1);

  const cart = asRfqCartLines(payload?.rfq?.line_items);
  const hasCart = cart.length > 0;

  const builtQuotes = useMemo((): BidQuoteLine[] => {
    const fromCart: BidQuoteLine[] = Object.entries(lineQuotes)
      .map(([id, q]) => {
        const unit = parseFloat(q.unit);
        if (!Number.isFinite(unit)) return null;
        const alt = alternatives[id];
        return {
          id,
          unit_price: unit,
          mrp_price: q.mrp ? parseFloat(q.mrp) : null,
          alternative: alt && (alt.brand || alt.device_model) ? alt : null,
        };
      })
      .filter((x): x is BidQuoteLine => x != null);
    return [...fromCart, ...extrasToQuoteLines(extras)];
  }, [lineQuotes, alternatives, extras]);

  const insight = useMemo(() => {
    const goods = hasCart
      ? quoteGoodsTotal(cart, builtQuotes)
      : quoteGoodsTotal(cart, builtQuotes, parseFloat(quoted));
    const m = hasCart
      ? quoteMrpTotal(cart, builtQuotes)
      : quoteMrpTotal(cart, builtQuotes, mrp ? parseFloat(mrp) : null);
    if (!Number.isFinite(goods)) return null;
    return computeBidPricing({
      quotedPrice: goods,
      mrpPrice: Number.isFinite(m as number) ? (m as number) : null,
      shippingFee: parseFloat(shipping) || 0,
      taxFee: parseFloat(tax) || 0,
      otherFees: parseFloat(other) || 0,
    });
  }, [hasCart, cart, builtQuotes, quoted, mrp, shipping, tax, other]);

  useEffect(() => {
    let cancelled = false;
    const code = (currency || 'USD').toUpperCase();
    if (code === 'USD') {
      setFxRate(1);
      return;
    }
    setFxRate(null);
    (async () => {
      try {
        const { rate } = await getRateToUsd(code);
        if (!cancelled) setFxRate(rate);
      } catch {
        if (!cancelled) setFxRate(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currency]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        await invokeRfqPublic({ action: 'open', token });
        const data = await invokeRfqPublic({ action: 'get', token });
        setPayload(data);
        setView(data.view as PublicView);
        if (data.bid) {
          const existingPreview = asBidQuoteLines(data.bid.line_items);
          const extraGoods = existingPreview
            .filter(isExtraQuoteLine)
            .reduce((s, q) => s + q.unit_price * (Number(q.qty) || 1), 0);
          const extraMrp = existingPreview
            .filter((q) => isExtraQuoteLine(q) && q.mrp_price != null)
            .reduce((s, q) => s + (q.mrp_price as number) * (Number(q.qty) || 1), 0);
          const cartLines = asRfqCartLines(data.rfq?.line_items);
          const quotedBase = Number(data.bid.quoted_price ?? 0);
          const mrpBase = data.bid.mrp_price != null ? Number(data.bid.mrp_price) : null;
          setQuoted(String(cartLines.length === 0 ? Math.max(0, Math.round((quotedBase - extraGoods) * 100) / 100) : quotedBase));
          setMrp(
            mrpBase != null
              ? String(cartLines.length === 0 ? Math.max(0, Math.round((mrpBase - extraMrp) * 100) / 100) : mrpBase)
              : '',
          );
          setCurrency(data.bid.currency || 'USD');
          setLeadTime(data.bid.lead_time_days != null ? String(data.bid.lead_time_days) : '');
          setValidUntil(data.bid.quote_valid_until || '');
          setNotes(data.bid.notes || '');
          setShipping(data.bid.shipping_fee != null ? String(data.bid.shipping_fee) : '0');
          setTax(data.bid.tax_fee != null ? String(data.bid.tax_fee) : '0');
          setOther(data.bid.other_fees != null ? String(data.bid.other_fees) : '0');
        }
        const lines = asRfqCartLines(data.rfq?.line_items);
        const existing = asBidQuoteLines(data.bid?.line_items);
        const byId = new Map(existing.map((q) => [q.id, q]));
        const next: Record<string, LineQuote> = {};
        const alts: Record<string, BidAlternativeSpec | null> = {};
        for (const row of quoteableCartRows(lines)) {
          const hit = byId.get(row.id);
          next[row.id] = {
            unit: hit ? String(hit.unit_price) : '',
            mrp: hit?.mrp_price != null ? String(hit.mrp_price) : '',
          };
          if (row.kind === 'device' && hit?.alternative) alts[row.id] = hit.alternative;
        }
        setLineQuotes(next);
        setAlternatives(alts);
        setExtras(
          existing.filter(isExtraQuoteLine).map((q) => ({
            id: q.id,
            extra_type: parseExtraType(q.extra_type),
            label: q.label || '',
            qty: String(q.qty || 1),
            unit: String(q.unit_price),
            mrp: q.mrp_price != null ? String(q.mrp_price) : '',
          })),
        );
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

  const buildLineItems = (): BidQuoteLine[] | { error: string } => {
    const fulfillment = payload?.rfq?.rfq_type === 'fulfillment';
    const items: BidQuoteLine[] = [];
    if (hasCart) {
      for (const line of cart) {
        const id = String(line.id || '');
        const unit = parseFloat(lineQuotes[id]?.unit);
        if (!id || !Number.isFinite(unit) || unit < 0) return { error: 'Quote every line item' };
        const lineMrp = lineQuotes[id]?.mrp ? parseFloat(lineQuotes[id].mrp) : null;
        if (fulfillment && (lineMrp == null || !Number.isFinite(lineMrp) || lineMrp <= 0)) {
          return { error: 'MRP is required on every line' };
        }
        const alt = alternatives[id];
        const usingAlt = !!(alt && (alt.brand?.trim() || alt.device_model?.trim()));
        if (alt && !usingAlt && (alt.processor || alt.ram || alt.storage)) {
          return { error: 'Enter brand or model for the alternative device' };
        }
        items.push({
          id,
          kind: 'device',
          unit_price: unit,
          mrp_price: lineMrp != null && Number.isFinite(lineMrp) ? lineMrp : null,
          alternative: usingAlt ? alt : null,
        });
        const addons = (line.addons || []).filter((a) => (a.type || a.model || '').trim());
        for (let i = 0; i < addons.length; i++) {
          const addon = addons[i];
          const aid = addonQuoteId(line, addon, i);
          const addonUnit = parseFloat(lineQuotes[aid]?.unit);
          if (!Number.isFinite(addonUnit) || addonUnit < 0) {
            if (usingAlt) continue;
            return { error: 'Quote every add-on' };
          }
          const addonMrp = lineQuotes[aid]?.mrp ? parseFloat(lineQuotes[aid].mrp) : null;
          if (fulfillment && (addonMrp == null || !Number.isFinite(addonMrp) || addonMrp <= 0)) {
            return { error: 'MRP is required on every add-on' };
          }
          items.push({
            id: aid,
            kind: 'addon',
            unit_price: addonUnit,
            mrp_price: addonMrp != null && Number.isFinite(addonMrp) ? addonMrp : null,
          });
        }
      }
    }
    for (const extra of extras) {
      const label = extra.label.trim();
      const unit = parseFloat(extra.unit);
      if (!label && !extra.unit && !extra.mrp) continue;
      if (!label || !Number.isFinite(unit) || unit < 0) {
        return { error: 'Complete extra item description and unit price' };
      }
      const extraMrp = extra.mrp ? parseFloat(extra.mrp) : null;
      if (fulfillment && (extraMrp == null || !Number.isFinite(extraMrp) || extraMrp <= 0)) {
        return { error: 'MRP is required on every extra item' };
      }
      items.push({
        id: extra.id,
        kind: 'extra',
        extra_type: extra.extra_type,
        label,
        qty: Math.max(1, parseInt(extra.qty, 10) || 1),
        unit_price: unit,
        mrp_price: extraMrp != null && Number.isFinite(extraMrp) ? extraMrp : null,
      });
    }
    return items;
  };

  const submit = async () => {
    if (!token || !file) {
      setError('Attach a quotation file to send.');
      return;
    }
    const lead = parseInt(leadTime, 10);
    if (!Number.isFinite(lead) || lead < 0) {
      setError('Lead time (days) is required.');
      return;
    }
    const built = buildLineItems();
    if ('error' in built) {
      setError(built.error);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const b64 = await fileToBase64(file);
      const goods = hasCart
        ? quoteGoodsTotal(cart, built)
        : quoteGoodsTotal(cart, built, parseFloat(quoted));
      const mrpTotal = hasCart
        ? quoteMrpTotal(cart, built)
        : quoteMrpTotal(cart, built, mrp ? parseFloat(mrp) : null);
      await invokeRfqPublic({
        action: 'submit',
        token,
        quoted_price: goods,
        mrp_price: mrpTotal,
        shipping_fee: parseFloat(shipping) || 0,
        tax_fee: parseFloat(tax) || 0,
        other_fees: parseFloat(other) || 0,
        currency,
        lead_time_days: lead,
        quote_valid_until: validUntil || null,
        notes,
        line_items: built,
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
        <div className="grid place-items-center py-24 text-sm text-[#6E7180] flex-1">Loading RFQ…</div>
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
  const fulfillment = rfq?.rfq_type === 'fulfillment';
  const notesExtra = deliveryNotes(rfq?.scope_summary);
  const showForm = (view === 'bid_form' || view === 'revise') && !declineConfirm;
  const showStatus = view === 'won' || view === 'lost' || view === 'submitted' || view === 'closed';

  const setLine = (id: string, field: keyof LineQuote, value: string) => {
    setLineQuotes((prev) => ({ ...prev, [id]: { unit: '', mrp: '', ...prev[id], [field]: value } }));
  };

  const setAltField = (id: string, field: keyof BidAlternativeSpec, value: string) => {
    setAlternatives((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || { brand: '', device_model: '' }), [field]: value },
    }));
  };

  const setExtra = (id: string, patch: Partial<ExtraRow>) => {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  const pageHeader = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[1.65rem] font-bold tracking-tight leading-tight">{heading}</h1>
        <p className="text-sm text-[#6E7180] mt-1 truncate">
          {payload?.vendor_name && <span className="text-[#30282B] font-medium">{payload.vendor_name}</span>}
          {payload?.vendor_name && rfq?.country_name && ' · '}
          {rfq?.country_name}
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
  );

  const requestCards = (
    <>
      {hasCart ? (
        <div className="space-y-2">
          {cart.map((line) => {
            const addons = (line.addons || []).filter((a) => (a.type || a.model || '').trim());
            const alt = alternatives[String(line.id)];
            return (
              <div key={line.id || cartLineLabel(line)} className="rounded-2xl bg-white border border-[#E8E4DE] px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-relaxed font-medium">{cartLineLabel(line)}</p>
                  <span className="shrink-0 text-xs font-semibold text-[#6E7180] bg-[#F3F0EB] rounded-full px-2 py-0.5">
                    Qty {line.quantity || 1}
                  </span>
                </div>
                <SpecBits line={line} />
                {alt && (alt.brand || alt.device_model) && (
                  <p className="mt-2 text-xs text-[#EA6E35] font-medium">Quoting alt: {alternativeLabel(alt)}</p>
                )}
                {addons.length > 0 && (
                  <ul className="mt-2 text-xs text-[#6E7180] space-y-0.5 list-disc pl-4">
                    {addons.map((a, i) => (
                      <li key={i}>
                        {[a.type, a.model].filter(Boolean).join(' — ')}
                        {Number(a.qty) > 1 ? ` ×${a.qty}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          {notesExtra ? <p className="text-xs text-[#6E7180] px-1 whitespace-pre-wrap">{notesExtra}</p> : null}
        </div>
      ) : rfq?.scope_summary ? (
        <div className="rounded-2xl bg-white border border-[#E8E4DE] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{rfq.scope_summary}</p>
            <span className="shrink-0 text-xs font-semibold text-[#6E7180] bg-[#F3F0EB] rounded-full px-2 py-0.5">
              Qty {rfq.quantity}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );

  const breakdown = insight && (
    <div className="rounded-2xl bg-white border border-[#E8E4DE] px-4 py-3 space-y-2 text-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9A958C]">Quote breakdown</p>
      {hasCart && cart.map((line) => {
        const id = String(line.id);
        const q = builtQuotes.find((x) => x.id === id);
        if (!q) return null;
        const qty = Number(line.quantity) || 1;
        const alt = q.alternative;
        return (
          <div key={id} className="flex justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-[#6E7180]">
              {alt ? `Alt · ${alternativeLabel(alt)}` : cartLineLabel(line)} ×{qty}
            </span>
            <span className="tabular-nums shrink-0">{moneyFmt(currency, q.unit_price * qty)}</span>
          </div>
        );
      })}
      {builtQuotes.filter(isExtraQuoteLine).map((q) => (
        <div key={q.id} className="flex justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-[#6E7180]">
            {extraTypeLabel(q.extra_type)} · {q.label} ×{q.qty || 1}
          </span>
          <span className="tabular-nums shrink-0">{moneyFmt(currency, q.unit_price * (q.qty || 1))}</span>
        </div>
      ))}
      {(parseFloat(shipping) || parseFloat(tax) || parseFloat(other)) ? (
        <div className="flex justify-between gap-3 text-xs text-[#6E7180] border-t border-[#E8E4DE] pt-2">
          <span>Fees</span>
          <span className="tabular-nums">
            {moneyFmt(currency, (parseFloat(shipping) || 0) + (parseFloat(tax) || 0) + (parseFloat(other) || 0))}
          </span>
        </div>
      ) : null}
      <div className="flex justify-between gap-3 font-semibold border-t border-[#E8E4DE] pt-2">
        <span>{insight.discount_pct != null ? `${insight.discount_pct}% off MRP` : 'Landed total'}</span>
        <span className="tabular-nums">{moneyFmt(currency, insight.total_landed)}</span>
      </div>
      {currency.toUpperCase() !== 'USD' && fxRate != null && (
        <p className="text-xs text-[#6E7180]">
          ≈ {moneyFmt('USD', convertToUsd(insight.total_landed, fxRate))}
          <span className="block mt-0.5">{formatUsdRateLine(currency, fxRate)}</span>
        </p>
      )}
    </div>
  );

  const landedBar = insight && (
    <div className="rounded-xl bg-[#30282B] text-white px-4 py-3 space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-white/70">
          {insight.discount_pct != null ? `${insight.discount_pct}% off MRP` : 'Landed total'}
        </span>
        <span className="text-lg font-bold tabular-nums">{moneyFmt(currency, insight.total_landed)}</span>
      </div>
      {currency.toUpperCase() !== 'USD' && fxRate != null && (
        <div className="flex items-start justify-between gap-3 text-sm border-t border-white/10 pt-1.5">
          <span className="text-white/65">{formatUsdRateLine(currency, fxRate)}</span>
          <span className="font-semibold tabular-nums text-right">
            ≈ {moneyFmt('USD', convertToUsd(insight.total_landed, fxRate))}
          </span>
        </div>
      )}
      {currency.toUpperCase() !== 'USD' && fxRate == null && (
        <p className="text-xs text-white/50">Looking up live USD rate…</p>
      )}
    </div>
  );

  const extraItemsBlock = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9A958C]">Extra items</p>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#EA6E35] cursor-pointer"
          onClick={() => setExtras((prev) => [...prev, newExtra()])}
        >
          <Plus className="h-3.5 w-3.5" /> Add extra item
        </button>
      </div>
      {extras.length === 0 && (
        <p className="text-xs text-[#9A958C]">AppleCare, warranties, accessories — add a priced line if you offer them.</p>
      )}
      {extras.map((extra) => {
        const qty = Math.max(1, parseInt(extra.qty, 10) || 1);
        const unit = parseFloat(extra.unit);
        const lineTotal = Number.isFinite(unit) ? unit * qty : null;
        return (
          <div key={extra.id} className="rounded-xl border border-[#E8E4DE] p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Select value={extra.extra_type} onValueChange={(v) => setExtra(extra.id, { extra_type: parseExtraType(v) })}>
                <SelectTrigger className={`${fieldSm} w-[140px] shrink-0`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXTRA_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{extraTypeLabel(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={extra.label}
                onChange={(e) => setExtra(extra.id, { label: e.target.value })}
                className={`${fieldSm} flex-1`}
                placeholder="AppleCare+ 2 year"
              />
              <button
                type="button"
                className="h-10 w-10 shrink-0 grid place-items-center rounded-xl text-[#9A958C] hover:text-[#D94F4F] cursor-pointer"
                onClick={() => setExtras((prev) => prev.filter((x) => x.id !== extra.id))}
                aria-label="Remove extra item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-[#6E7180]">Qty</Label>
                <Input type="number" min={1} value={extra.qty} onChange={(e) => setExtra(extra.id, { qty: e.target.value })} className={fieldSm} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#6E7180]">Unit * ({currency})</Label>
                <Input type="number" min={0} step="0.01" value={extra.unit} onChange={(e) => setExtra(extra.id, { unit: e.target.value })} className={fieldSm} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#6E7180]">MRP {fulfillment ? '*' : ''} ({currency})</Label>
                <Input type="number" min={0} step="0.01" value={extra.mrp} onChange={(e) => setExtra(extra.id, { mrp: e.target.value })} className={fieldSm} placeholder="0.00" />
              </div>
            </div>
            {lineTotal != null && (
              <p className="text-xs text-[#6E7180] text-right tabular-nums">Line {moneyFmt(currency, lineTotal)}</p>
            )}
          </div>
        );
      })}
    </div>
  );

  const priceFields = hasCart ? (
    <div className="space-y-3">
      {cart.map((line) => {
        const id = line.id as string;
        const q = lineQuotes[id] || { unit: '', mrp: '' };
        const addons = (line.addons || []).filter((a) => (a.type || a.model || '').trim());
        const usingAlt = !!alternatives[id];
        return (
          <div key={id} className="rounded-xl border border-[#E8E4DE] p-3 space-y-3">
            <div className="flex items-start gap-3">
              <p className="text-sm font-medium flex-1 min-w-0">{cartLineLabel(line)}</p>
              <span className="shrink-0 text-xs font-semibold text-[#6E7180] bg-[#F3F0EB] rounded-full px-2 py-0.5">
                Qty {line.quantity || 1}
              </span>
            </div>
            <div className="grid grid-cols-2 rounded-xl bg-[#F3F0EB] p-1">
              <button
                type="button"
                className={`h-9 rounded-lg text-xs font-semibold cursor-pointer ${!usingAlt ? 'bg-white text-[#30282B] shadow-sm' : 'text-[#6E7180]'}`}
                onClick={() => setAlternatives((prev) => ({ ...prev, [id]: null }))}
              >
                As requested
              </button>
              <button
                type="button"
                className={`h-9 rounded-lg text-xs font-semibold cursor-pointer ${usingAlt ? 'bg-white text-[#30282B] shadow-sm' : 'text-[#6E7180]'}`}
                onClick={() => setAlternatives((prev) => ({ ...prev, [id]: prev[id] || emptyAltFromLine(line) }))}
              >
                Alternative
              </button>
            </div>
            {usingAlt && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-[#6E7180]">Brand *</Label>
                  <Input value={alternatives[id]?.brand || ''} onChange={(e) => setAltField(id, 'brand', e.target.value)} className={fieldSm} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-[#6E7180]">Model *</Label>
                  <Input value={alternatives[id]?.device_model || ''} onChange={(e) => setAltField(id, 'device_model', e.target.value)} className={fieldSm} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-[#6E7180]">Processor</Label>
                  <Input value={alternatives[id]?.processor || ''} onChange={(e) => setAltField(id, 'processor', e.target.value)} className={fieldSm} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-[#6E7180]">RAM</Label>
                  <Input value={alternatives[id]?.ram || ''} onChange={(e) => setAltField(id, 'ram', e.target.value)} className={fieldSm} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-[#6E7180]">Storage</Label>
                  <Input value={alternatives[id]?.storage || ''} onChange={(e) => setAltField(id, 'storage', e.target.value)} className={fieldSm} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-[#6E7180]">Unit price * ({currency})</Label>
                <Input type="number" min={0} step="0.01" value={q.unit} onChange={(e) => setLine(id, 'unit', e.target.value)} className={fieldClass} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-[#6E7180]">MRP / list {fulfillment ? '*' : ''} ({currency})</Label>
                <Input type="number" min={0} step="0.01" value={q.mrp} onChange={(e) => setLine(id, 'mrp', e.target.value)} className={fieldClass} placeholder="0.00" />
              </div>
            </div>
            {addons.length > 0 && (
              <div className="rounded-lg bg-[#F3F0EB] px-3 py-2.5 space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6E7180]">
                  Add-ons{usingAlt ? ' (optional if they no longer apply)' : ''}
                </p>
                {addons.map((addon, i) => {
                  const aid = addonQuoteId(line, addon, i);
                  const aq = lineQuotes[aid] || { unit: '', mrp: '' };
                  return (
                    <div key={aid}>
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-sm">{addonLabel(addon)}</p>
                        <span className="text-xs text-[#6E7180]">Qty {addon.qty || 1}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-[#6E7180]">Unit {usingAlt ? '' : '*'} ({currency})</Label>
                          <Input type="number" min={0} step="0.01" value={aq.unit} onChange={(e) => setLine(aid, 'unit', e.target.value)} className={fieldClass} placeholder="0.00" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-[#6E7180]">MRP {fulfillment && !usingAlt ? '*' : ''} ({currency})</Label>
                          <Input type="number" min={0} step="0.01" value={aq.mrp} onChange={(e) => setLine(aid, 'mrp', e.target.value)} className={fieldClass} placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  ) : (
    <>
      <div className="space-y-1.5">
        <Label className="text-[#30282B]">Your price * ({currency})</Label>
        <Input type="number" min={0} step="0.01" value={quoted} onChange={(e) => setQuoted(e.target.value)} className={`${fieldClass} text-lg font-semibold tabular-nums`} placeholder="0.00" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[#30282B]">MRP / list {fulfillment ? '*' : '(optional)'} ({currency})</Label>
        <Input type="number" min={0} step="0.01" value={mrp} onChange={(e) => setMrp(e.target.value)} className={fieldClass} placeholder="0.00" />
      </div>
    </>
  );

  const formBody = (
    <>
      {view === 'revise' && payload?.bid?.revision_note && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {payload.bid.revision_note}
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-[#30282B]">Currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger className={`${fieldClass} w-full`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {FX_CURRENCY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {priceFields}
      {extraItemsBlock}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#9A958C] mb-2">Fees (optional, {currency})</p>
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
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[#30282B]">Lead time (days) *</Label>
          <Input type="number" min={0} value={leadTime} onChange={(e) => setLeadTime(e.target.value)} className={fieldClass} placeholder="0 = in stock" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[#30282B]">Valid until</Label>
          <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={fieldClass} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[#30282B]">Notes</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className={`${fieldClass} min-h-[72px] h-auto`} placeholder="Inclusions, exclusions…" />
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
          <input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>
      {error && <p className="text-sm text-[#D94F4F]">{error}</p>}
    </>
  );

  const sendActions = (
    <>
      <Button className="w-full h-12 rounded-xl font-semibold bg-[#EA6E35] hover:bg-[#d9622f] text-white cursor-pointer transition-colors duration-200" disabled={submitting} onClick={submit}>
        {submitting ? 'Submitting…' : 'Send quote'}
      </Button>
      <button type="button" className="w-full text-center text-sm text-[#6E7180] hover:text-[#30282B] cursor-pointer py-1" disabled={submitting} onClick={() => setDeclineConfirm(true)}>
        Decline this RFQ
      </button>
    </>
  );

  const declineCard = declineConfirm && (view === 'bid_form' || view === 'revise') && (
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
  );

  const statusCard = showStatus && (
    <div className="rounded-2xl bg-white border border-[#E8E4DE] p-5 space-y-3 shadow-[0_8px_30px_rgba(48,40,43,0.06)] text-sm">
      {doneMsg && <p className="font-medium">{doneMsg}</p>}
      {view === 'won' && <p>Pricing is accepted. RemoAsset will follow up on next steps.</p>}
      {view === 'lost' && <p>Another partner was selected. You’re still on the Closed network for future RFQs.</p>}
      {view === 'submitted' && <p>Under review. You can edit until the campaign closes.</p>}
      {payload?.bid && (
        <div className="rounded-xl bg-[#F3F0EB] px-3 py-3 space-y-1">
          <p className="text-lg font-bold tabular-nums">
            {moneyFmt(payload.bid.currency, Number(payload.bid.quoted_price))}
          </p>
          {payload.bid.total_landed != null && (
            <p className="text-[#6E7180]">Landed {moneyFmt(payload.bid.currency, Number(payload.bid.total_landed))}</p>
          )}
          {payload.bid.currency !== 'USD' && fxRate != null && payload.bid.total_landed != null && (
            <p className="text-sm text-[#30282B]">
              ≈ {moneyFmt('USD', convertToUsd(Number(payload.bid.total_landed), fxRate))}
              <span className="block text-xs text-[#6E7180] mt-0.5">{formatUsdRateLine(payload.bid.currency, fxRate)}</span>
            </p>
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
  );

  return (
    <RfqPublicShell>
      <div className="lg:hidden max-w-lg mx-auto px-4 py-6 pb-10 w-full">
        <div className="mb-4">{pageHeader}</div>
        <div className="mb-4">{requestCards}</div>
        {declineCard}
        {statusCard}
        {showForm && (
          <div className="rounded-2xl bg-white border border-[#E8E4DE] p-5 space-y-5 shadow-[0_8px_30px_rgba(48,40,43,0.06)]">
            {formBody}
            {landedBar}
            {sendActions}
          </div>
        )}
      </div>

      <div className="hidden lg:flex flex-1 min-h-0 max-w-7xl mx-auto w-full gap-6 px-6 py-5">
        <aside className="w-[40%] min-h-0 overflow-y-auto pr-1 space-y-4">
          {pageHeader}
          {requestCards}
          {showForm && breakdown}
        </aside>
        <section className="flex-1 min-h-0 flex flex-col">
          {declineCard}
          {statusCard}
          {showForm && (
            <div className="flex-1 min-h-0 flex flex-col rounded-2xl bg-white border border-[#E8E4DE] shadow-[0_8px_30px_rgba(48,40,43,0.06)]">
              <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
                {formBody}
              </div>
              <div className="shrink-0 border-t border-[#E8E4DE] p-4 space-y-3 bg-white rounded-b-2xl">
                {landedBar}
                {sendActions}
              </div>
            </div>
          )}
        </section>
      </div>
    </RfqPublicShell>
  );
}
