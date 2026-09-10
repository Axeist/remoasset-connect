import { useState } from 'react';
import { FileText, LayoutGrid, MoreHorizontal, Table2, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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

function kindLabel(v: BidLineView) {
  if (v.isAlternative) return 'Alternative';
  if (v.kind === 'extra') return 'Extra';
  if (v.kind === 'addon') return 'Add-on';
  return 'As requested';
}

function BidLinesTable({
  views,
  currency,
  usdRate,
}: {
  views: BidLineView[];
  currency: string;
  usdRate?: number;
}) {
  if (views.length === 0) {
    return <p className="text-sm text-muted-foreground px-1">No line breakdown on this quote.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="text-left font-medium px-3 py-2">Type</th>
            <th className="text-left font-medium px-3 py-2">Asked</th>
            <th className="text-left font-medium px-3 py-2">Quoted</th>
            <th className="text-right font-medium px-3 py-2">Qty</th>
            <th className="text-right font-medium px-3 py-2">Unit</th>
            <th className="text-right font-medium px-3 py-2">MRP</th>
            <th className="text-right font-medium px-3 py-2">Line</th>
            {usdRate != null && <th className="text-right font-medium px-3 py-2">USD</th>}
          </tr>
        </thead>
        <tbody>
          {views.map((v) => {
            const lineTotal = v.unit_price * v.qty;
            return (
              <tr
                key={v.id}
                className={cn(
                  'border-t',
                  v.isAlternative && 'bg-amber-50/80 dark:bg-amber-950/25',
                  v.kind === 'extra' && !v.isAlternative && 'bg-sky-50/60 dark:bg-sky-950/20',
                )}
              >
                <td className="px-3 py-1.5 whitespace-nowrap">
                  <span className={cn(
                    'inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
                    v.isAlternative && 'bg-amber-200/80 text-amber-950',
                    v.kind === 'extra' && !v.isAlternative && 'bg-sky-200/80 text-sky-950',
                    v.kind === 'addon' && !v.isAlternative && 'bg-muted text-muted-foreground',
                    v.kind === 'device' && !v.isAlternative && 'bg-emerald-100 text-emerald-900',
                  )}>
                    {kindLabel(v)}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-muted-foreground max-w-[280px]">{v.isAlternative ? v.requested || '—' : v.requested || '—'}</td>
                <td className="px-3 py-1.5 font-medium max-w-[320px]">{v.quoted}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{v.qty}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(currency, v.unit_price)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{money(currency, v.mrp_price)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{money(currency, lineTotal)}</td>
                {usdRate != null && (
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {money('USD', convertToUsd(lineTotal, usdRate))}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BidActions({
  bid,
  canAct,
  isRecommended,
  onAward,
  onRevise,
}: {
  bid: RfqBid;
  canAct: boolean;
  isRecommended: boolean;
  onAward: (bid: RfqBid) => void;
  onRevise: (bid: RfqBid) => void;
}) {
  if (!canAct) return null;
  if (isRecommended) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" className="rounded-lg cursor-pointer" onClick={() => onAward(bid)}>
          <Trophy className="h-3.5 w-3.5 mr-1" /> Award
        </Button>
        <Button size="sm" variant="outline" className="rounded-lg cursor-pointer" onClick={() => onRevise(bid)}>
          Request revision
        </Button>
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-lg cursor-pointer">
          <MoreHorizontal className="h-4 w-4 mr-1" /> Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="cursor-pointer" onClick={() => onAward(bid)}>Award</DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onClick={() => onRevise(bid)}>Request revision</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

  const ordered = [...bids].sort((a, b) => {
    const ua = usdOf(a.total_landed ?? a.quoted_price, a.currency, usdRates);
    const ub = usdOf(b.total_landed ?? b.quoted_price, b.currency, usdRates);
    if (ua == null && ub == null) return 0;
    if (ua == null) return 1;
    if (ub == null) return -1;
    return ua - ub;
  });

  return (
    <div className="space-y-4">
      {ordered.map((b) => {
        const isRecommended = canAct && b.id === recommendedId;
        const code = (b.currency || 'USD').toUpperCase();
        const rate = usdRates[code] ?? (code === 'USD' ? 1 : undefined);
        const landed = b.total_landed ?? b.quoted_price;
        const usdLanded = usdOf(landed, b.currency, usdRates);
        const views = bidLineViews(b.line_items, cart);
        const match = bidMatchKind(views);
        const extraCount = views.filter((v) => v.kind === 'extra').length;
        const altCount = views.filter((v) => v.isAlternative).length;
        const bestUsd = usdOf(
          ordered[0].total_landed ?? ordered[0].quoted_price,
          ordered[0].currency,
          usdRates,
        );
        return (
          <Card
            key={b.id}
            className={cn(
              'overflow-hidden border-border/80',
              isRecommended && 'ring-1 ring-primary/35',
              b.award_status === 'won' && 'ring-1 ring-emerald-500/50',
            )}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 py-3 border-b bg-muted/20">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-base truncate">{b.vendor?.company_name || '—'}</p>
                  {isRecommended && <Badge className="text-[10px] uppercase tracking-wide">Lowest USD</Badge>}
                  {b.award_status === 'won' && <Badge className="bg-emerald-600">Won</Badge>}
                  {b.award_status === 'lost' && <Badge variant="secondary">Lost</Badge>}
                  <Badge variant="outline" className="capitalize">{b.pricing_status.replace(/_/g, ' ')}</Badge>
                  {match !== 'as_requested' && (
                    <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50">
                      {bidMatchLabel(match)}{altCount > 0 ? ` · ${altCount}` : ''}
                    </Badge>
                  )}
                  {extraCount > 0 && (
                    <Badge variant="outline" className="text-sky-800 border-sky-300 bg-sky-50">
                      {extraCount} extra{extraCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
                  <div className="rounded-lg border bg-background px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Landed USD</p>
                    <p className="text-lg font-bold tabular-nums leading-tight">{money('USD', usdLanded)}</p>
                    {bestUsd != null && usdLanded != null && usdLanded > bestUsd && (
                      <p className="text-[10px] text-amber-700">+{money('USD', usdLanded - bestUsd)} vs lowest</p>
                    )}
                  </div>
                  <div className="rounded-lg border bg-background px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Goods</p>
                    <p className="text-sm font-semibold tabular-nums">{money(b.currency, b.quoted_price)}</p>
                  </div>
                  <div className="rounded-lg border bg-background px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">vs MRP</p>
                    <p className="text-sm font-semibold tabular-nums">{b.discount_pct != null ? `${b.discount_pct}% off` : '—'}</p>
                  </div>
                  <div className="rounded-lg border bg-background px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Lead</p>
                    <p className="text-sm font-semibold">{b.lead_time_days != null ? `${b.lead_time_days} days` : '—'}</p>
                  </div>
                  <div className="rounded-lg border bg-background px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fees</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {money(b.currency, (Number(b.shipping_fee) || 0) + (Number(b.tax_fee) || 0) + (Number(b.other_fees) || 0))}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-background px-2.5 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valid</p>
                    <p className="text-sm font-semibold">{b.quote_valid_until || '—'}</p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {money(b.currency, landed)} landed
                  {rate != null && code !== 'USD' && <> · {formatUsdRateLine(code, rate)}</>}
                  {b.mrp_price != null && <> · MRP {money(b.currency, b.mrp_price)}</>}
                  {' · '}Ship {money(b.currency, b.shipping_fee)} · Tax {money(b.currency, b.tax_fee)} · Other {money(b.currency, b.other_fees)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-start">
                {b.quotation_file_path && (
                  <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs cursor-pointer" onClick={() => onOpenFile(b)}>
                    <FileText className="h-3.5 w-3.5 mr-1 shrink-0" />
                    File
                  </Button>
                )}
                <BidActions bid={b} canAct={canAct} isRecommended={isRecommended} onAward={onAward} onRevise={onRevise} />
              </div>
            </div>
            <div className="p-0">
              <BidLinesTable views={views} currency={b.currency} usdRate={rate} />
            </div>
            {b.notes && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap px-4 py-2 border-t">{b.notes}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export function RfqBidSpreadsheet({
  bids,
  rfqLines,
  usdRates,
}: {
  bids: RfqBid[];
  rfqLines?: unknown;
  usdRates: Record<string, number>;
}) {
  const cart = asRfqCartLines(rfqLines);
  if (bids.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-10 text-center">No quotes yet.</p>
    );
  }
  return (
    <div className="rounded-xl border overflow-auto max-h-[calc(100vh-220px)]">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            <TableHead className="sticky left-0 z-20 bg-background min-w-[160px]">Vendor</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="min-w-[200px]">Asked</TableHead>
            <TableHead className="min-w-[220px]">Quoted</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit</TableHead>
            <TableHead className="text-right">MRP</TableHead>
            <TableHead className="text-right">Line</TableHead>
            <TableHead className="text-right">USD</TableHead>
            <TableHead>Landed</TableHead>
            <TableHead>Lead</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {bids.map((b, bi) => {
            const views = bidLineViews(b.line_items, cart);
            const match = bidMatchKind(views);
            const usdLanded = usdOf(b.total_landed ?? b.quoted_price, b.currency, usdRates);
            const code = (b.currency || 'USD').toUpperCase();
            const rate = usdRates[code] ?? (code === 'USD' ? 1 : undefined);
            const lineRows = views.length > 0 ? views : [null];
            const stripe = bi % 2 === 0;
            return lineRows.map((v, i) => (
              <TableRow
                key={`${b.id}-${v?.id || i}`}
                className={cn(stripe && 'bg-muted/20', v?.isAlternative && 'bg-amber-50/70 dark:bg-amber-950/20')}
              >
                {i === 0 ? (
                  <TableCell className="align-top sticky left-0 z-10 bg-inherit font-medium" rowSpan={lineRows.length}>
                    <p>{b.vendor?.company_name || '—'}</p>
                    <p className="text-[11px] text-muted-foreground font-normal mt-1">{bidMatchLabel(match)}</p>
                    <p className="text-[11px] text-muted-foreground font-normal capitalize">{b.pricing_status.replace(/_/g, ' ')}</p>
                  </TableCell>
                ) : null}
                <TableCell className="align-top whitespace-nowrap text-xs font-semibold">
                  {v ? kindLabel(v) : '—'}
                </TableCell>
                <TableCell className="align-top text-muted-foreground text-sm">
                  {v?.isAlternative ? v.requested : v?.requested || '—'}
                </TableCell>
                <TableCell className="align-top text-sm font-medium">{v?.quoted || '—'}</TableCell>
                <TableCell className="align-top text-right tabular-nums">{v ? v.qty : '—'}</TableCell>
                <TableCell className="align-top text-right tabular-nums">{v ? money(b.currency, v.unit_price) : '—'}</TableCell>
                <TableCell className="align-top text-right tabular-nums">{v ? money(b.currency, v.mrp_price) : '—'}</TableCell>
                <TableCell className="align-top text-right tabular-nums font-medium">
                  {v ? money(b.currency, v.unit_price * v.qty) : '—'}
                </TableCell>
                <TableCell className="align-top text-right tabular-nums text-muted-foreground">
                  {v && rate != null ? money('USD', convertToUsd(v.unit_price * v.qty, rate)) : '—'}
                </TableCell>
                {i === 0 ? (
                  <TableCell className="align-top whitespace-nowrap" rowSpan={lineRows.length}>
                    <div className="font-semibold tabular-nums">{money('USD', usdLanded)}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">{money(b.currency, b.total_landed)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Ship {money(b.currency, b.shipping_fee)} · Tax {money(b.currency, b.tax_fee)}
                    </div>
                  </TableCell>
                ) : null}
                {i === 0 ? (
                  <TableCell className="align-top" rowSpan={lineRows.length}>
                    {b.lead_time_days != null ? `${b.lead_time_days}d` : '—'}
                  </TableCell>
                ) : null}
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function BidViewToggle({
  spreadsheet,
  onChange,
}: {
  spreadsheet: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border p-0.5">
      <Button
        type="button"
        size="sm"
        variant={spreadsheet ? 'ghost' : 'secondary'}
        className="h-8 rounded-md cursor-pointer"
        onClick={() => onChange(false)}
      >
        <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Cards
      </Button>
      <Button
        type="button"
        size="sm"
        variant={spreadsheet ? 'secondary' : 'ghost'}
        className="h-8 rounded-md cursor-pointer"
        onClick={() => onChange(true)}
      >
        <Table2 className="h-3.5 w-3.5 mr-1" /> Spreadsheet
      </Button>
    </div>
  );
}
