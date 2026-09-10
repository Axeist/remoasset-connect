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
import {
  asRfqCartLines,
  bidLineViews,
  bidMatchKind,
  bidMatchLabel,
  type BidLineView,
} from '@/lib/rfq';
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

function kindBadge(kind: BidLineView['kind'], isAlt: boolean) {
  if (isAlt) return { label: 'Alternative', className: 'bg-amber-100 text-amber-900 border-amber-200' };
  if (kind === 'extra') return { label: 'Extra', className: 'bg-sky-100 text-sky-900 border-sky-200' };
  if (kind === 'addon') return { label: 'Add-on', className: 'bg-muted text-muted-foreground' };
  return { label: 'As requested', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
}

export function BidLineList({
  views,
  currency,
  usdRate,
  compact,
}: {
  views: BidLineView[];
  currency: string;
  usdRate?: number;
  compact?: boolean;
}) {
  if (views.length === 0) return null;
  return (
    <div className={cn('space-y-2', compact && 'space-y-1.5')}>
      {views.map((v) => {
        const badge = kindBadge(v.kind, v.isAlternative);
        const lineTotal = v.unit_price * v.qty;
        return (
          <div
            key={v.id}
            className={cn(
              'rounded-lg border px-3 py-2',
              v.isAlternative ? 'border-amber-200 bg-amber-50/60 dark:bg-amber-950/20' : 'bg-muted/30',
            )}
          >
            <div className="flex items-start gap-2">
              <Badge variant="outline" className={cn('text-[10px] shrink-0 mt-0.5', badge.className)}>
                {badge.label}
              </Badge>
              <div className="min-w-0 flex-1">
                {v.isAlternative && v.requested && (
                  <p className="text-[11px] text-muted-foreground">
                    Asked: <span className="line-through">{v.requested}</span>
                  </p>
                )}
                <p className="text-sm font-medium leading-snug">{v.quoted}</p>
                <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
                  ×{v.qty} · {money(currency, v.unit_price)} unit
                  {v.mrp_price != null && <> · MRP {money(currency, v.mrp_price)}</>}
                  {usdRate != null && <> · {money('USD', convertToUsd(lineTotal, usdRate))}</>}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums shrink-0">{money(currency, lineTotal)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
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
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
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

  const toggleNotes = (id: string) => {
    setOpenNotes((prev) => {
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
        const notesOpen = openNotes.has(b.id);
        const code = (b.currency || 'USD').toUpperCase();
        const rate = usdRates[code] ?? (code === 'USD' ? 1 : undefined);
        const landed = b.total_landed ?? b.quoted_price;
        const usdLanded = usdOf(landed, b.currency, usdRates);
        const views = bidLineViews(b.line_items, cart);
        const match = bidMatchKind(views);
        const extraCount = views.filter((v) => v.kind === 'extra').length;
        const altCount = views.filter((v) => v.isAlternative).length;
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
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{b.vendor?.company_name || '—'}</p>
                      {isRecommended && (
                        <Badge className="text-[10px] uppercase tracking-wide">Lowest USD</Badge>
                      )}
                      {b.award_status === 'won' && <Badge className="bg-emerald-600">Won</Badge>}
                      {b.award_status === 'lost' && <Badge variant="secondary">Lost</Badge>}
                      <Badge variant="outline" className="capitalize">{b.pricing_status.replace(/_/g, ' ')}</Badge>
                      {match !== 'as_requested' && (
                        <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50">
                          {bidMatchLabel(match)}
                          {altCount > 0 ? ` · ${altCount}` : ''}
                        </Badge>
                      )}
                      {extraCount > 0 && (
                        <Badge variant="outline" className="text-sky-800 border-sky-300 bg-sky-50">
                          {extraCount} extra{extraCount === 1 ? '' : 's'}
                        </Badge>
                      )}
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
                      Goods {money(b.currency, b.quoted_price)}
                      {b.mrp_price != null && <> · MRP {money(b.currency, b.mrp_price)}</>}
                      {b.discount_pct != null && <> · {b.discount_pct}% off</>}
                      {b.lead_time_days != null && <> · {b.lead_time_days}d lead</>}
                      {b.quote_valid_until && <> · valid {b.quote_valid_until}</>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fees {money(b.currency, b.shipping_fee)} ship · {money(b.currency, b.tax_fee)} tax · {money(b.currency, b.other_fees)} other
                    </p>
                  </div>
                </div>

                <BidLineList views={views} currency={b.currency} usdRate={rate} />

                <div className="flex flex-wrap items-center gap-2">
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
                  {(b.notes || b.revision_note || b.submitted_at) && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs cursor-pointer"
                      onClick={() => toggleNotes(b.id)}
                    >
                      {notesOpen ? 'Hide notes' : 'Notes'}
                    </Button>
                  )}
                </div>
                {notesOpen && (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                    {b.notes && <p className="whitespace-pre-wrap">{b.notes}</p>}
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
