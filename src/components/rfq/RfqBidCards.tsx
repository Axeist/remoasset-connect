import { useState } from 'react';
import { FileText, MoreHorizontal, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { RfqBid, RfqStatus } from '@/types/rfq';
import { asBidQuoteLines, asRfqCartLines, cartLineLabel, type RfqCartLine } from '@/lib/rfq';
import { convertToUsd, formatUsdRateLine } from '@/lib/fx-rates';

export function money(currency: string, value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${currency} ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function usdOf(amount: number | null | undefined, currency: string, rates: Record<string, number>): number | null {
  if (amount == null || Number.isNaN(Number(amount))) return null;
  const rate = rates[(currency || 'USD').toUpperCase()] ?? (currency === 'USD' ? 1 : undefined);
  if (rate == null) return null;
  return convertToUsd(Number(amount), rate);
}

function lowestUsdId(bids: RfqBid[], rates: Record<string, number>): string | null {
  let best: { id: string; usd: number } | null = null;
  for (const b of bids) {
    const usd = usdOf(b.total_landed ?? b.quoted_price, b.currency, rates);
    if (usd == null) continue;
    if (!best || usd < best.usd) best = { id: b.id, usd };
  }
  return best?.id ?? bids[0]?.id ?? null;
}

export function RfqBidCards({
  bids,
  rfqStatus,
  rfqLines,
  usdRates,
  onAward,
  onRevise,
  onOpenFile,
}: {
  bids: RfqBid[];
  rfqStatus: RfqStatus;
  rfqLines?: unknown;
  usdRates: Record<string, number>;
  onAward: (bid: RfqBid) => void;
  onRevise: (bid: RfqBid) => void;
  onOpenFile: (bid: RfqBid) => void;
}) {
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const cart = asRfqCartLines(rfqLines);
  const recommendedId = lowestUsdId(bids, usdRates);
  const canAct = rfqStatus !== 'awarded';

  if (bids.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">
        No quotes yet. They appear here as partners submit.
      </p>
    );
  }

  const toggleDetails = (id: string) => {
    setOpenDetails((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ordered = [...bids].sort((a, b) => {
    const ua = usdOf(a.total_landed ?? a.quoted_price, a.currency, usdRates);
    const ub = usdOf(b.total_landed ?? b.quoted_price, b.currency, usdRates);
    if (ua == null && ub == null) return 0;
    if (ua == null) return 1;
    if (ub == null) return -1;
    return ua - ub;
  });

  return (
    <div className="space-y-3">
      {ordered.map((b) => {
        const isRecommended = canAct && b.id === recommendedId;
        const detailsOpen = openDetails.has(b.id);
        const code = (b.currency || 'USD').toUpperCase();
        const rate = usdRates[code] ?? (code === 'USD' ? 1 : undefined);
        const landed = b.total_landed ?? b.quoted_price;
        const usdLanded = usdOf(landed, b.currency, usdRates);
        return (
          <Card
            key={b.id}
            className={cn(
              'card-shadow p-4 transition-colors duration-200',
              isRecommended && 'ring-1 ring-primary/40',
              b.award_status === 'won' && 'ring-1 ring-emerald-500/50',
            )}
          >
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold truncate">{b.vendor?.company_name || '—'}</p>
                  {isRecommended && (
                    <Badge className="text-[10px] uppercase tracking-wide">Lowest USD</Badge>
                  )}
                  {b.award_status === 'won' && <Badge className="bg-emerald-600">Won</Badge>}
                  {b.award_status === 'lost' && <Badge variant="secondary">Lost</Badge>}
                  <Badge variant="outline" className="capitalize">{b.pricing_status.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight mt-1">
                  {money('USD', usdLanded)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {money(b.currency, landed)} landed
                  {rate != null && code !== 'USD' && (
                    <> → {money('USD', usdLanded)} · {formatUsdRateLine(code, rate)}</>
                  )}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Quoted {money(b.currency, b.quoted_price)}
                  {b.mrp_price != null && <> · MRP {money(b.currency, b.mrp_price)}</>}
                  {b.discount_pct != null && <> · {b.discount_pct}% off</>}
                  {b.lead_time_days != null && <> · {b.lead_time_days}d lead</>}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {b.quotation_file_path ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs cursor-pointer"
                      onClick={() => onOpenFile(b)}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1 shrink-0" />
                      <span className="truncate max-w-[160px]">{b.quotation_file_name || 'Quotation'}</span>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-xs cursor-pointer"
                    onClick={() => toggleDetails(b.id)}
                  >
                    {detailsOpen ? 'Hide details' : 'Details'}
                  </Button>
                </div>
                {detailsOpen && (
                  <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                    <p>Shipping {money(b.currency, b.shipping_fee)} · Tax {money(b.currency, b.tax_fee)} · Other {money(b.currency, b.other_fees)}</p>
                    {cart.length > 0 && asBidQuoteLines(b.line_items).map((q) => {
                      const line = cart.find((c) => c.id === q.id);
                      const qty = Number(line?.quantity) || 1;
                      return (
                        <p key={q.id} className="text-xs">
                          {line ? cartLineLabel(line as RfqCartLine) : q.id} ×{qty}: {money(b.currency, q.unit_price)}
                          {q.mrp_price != null && <> · MRP {money(b.currency, q.mrp_price)}</>}
                          {usdRates[(b.currency || 'USD').toUpperCase()] != null && (
                            <> · {money('USD', convertToUsd(q.unit_price * qty, usdRates[(b.currency || 'USD').toUpperCase()]))}</>
                          )}
                        </p>
                      );
                    })}
                    {b.notes && <p className="text-muted-foreground whitespace-pre-wrap">{b.notes}</p>}
                    {b.revision_note && (
                      <p className="text-amber-700 dark:text-amber-400">Revision: {b.revision_note}</p>
                    )}
                    {b.submitted_at && (
                      <p className="text-xs text-muted-foreground">
                        Submitted {new Date(b.submitted_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {canAct && (
                <div className="flex items-center gap-2 shrink-0">
                  {isRecommended ? (
                    <>
                      <Button
                        size="sm"
                        className="rounded-lg cursor-pointer"
                        onClick={() => onAward(b)}
                      >
                        <Trophy className="h-3.5 w-3.5 mr-1" /> Award
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg cursor-pointer"
                        onClick={() => onRevise(b)}
                      >
                        Request revision
                      </Button>
                    </>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="rounded-lg cursor-pointer">
                          <MoreHorizontal className="h-4 w-4 mr-1" /> Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="cursor-pointer" onClick={() => onAward(b)}>
                          Award
                        </DropdownMenuItem>
                        <DropdownMenuItem className="cursor-pointer" onClick={() => onRevise(b)}>
                          Request revision
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
