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

export function money(currency: string, value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${currency} ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function lowestLandedId(bids: RfqBid[]): string | null {
  let best: RfqBid | null = null;
  for (const b of bids) {
    if (b.total_landed == null) continue;
    if (!best || Number(b.total_landed) < Number(best.total_landed)) best = b;
  }
  return best?.id ?? bids[0]?.id ?? null;
}

export function RfqBidCards({
  bids,
  rfqStatus,
  onAward,
  onRevise,
  onOpenFile,
}: {
  bids: RfqBid[];
  rfqStatus: RfqStatus;
  onAward: (bid: RfqBid) => void;
  onRevise: (bid: RfqBid) => void;
  onOpenFile: (bid: RfqBid) => void;
}) {
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const recommendedId = lowestLandedId(bids);
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

  return (
    <div className="space-y-3">
      {bids.map((b) => {
        const isRecommended = canAct && b.id === recommendedId;
        const detailsOpen = openDetails.has(b.id);
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
                    <Badge className="text-[10px] uppercase tracking-wide">Lowest landed</Badge>
                  )}
                  {b.award_status === 'won' && <Badge className="bg-emerald-600">Won</Badge>}
                  {b.award_status === 'lost' && <Badge variant="secondary">Lost</Badge>}
                  <Badge variant="outline" className="capitalize">{b.pricing_status.replace(/_/g, ' ')}</Badge>
                </div>
                <p className="text-2xl font-bold tabular-nums tracking-tight mt-1">
                  {money(b.currency, b.total_landed ?? b.quoted_price)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
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
