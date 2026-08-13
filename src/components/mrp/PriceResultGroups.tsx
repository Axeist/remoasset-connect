import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PRICE_TYPE_LABEL,
  formatPriceRange,
  formatPublicPrice,
  rangeFromHits,
  type PublicPriceHit,
  type PublicPriceType,
} from '@/lib/mrp-lookup';
import { cn } from '@/lib/utils';
import { ArrowRight, ExternalLink } from 'lucide-react';

const PRICE_BADGE: Record<PublicPriceType, string> = {
  mrp: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
  msrp: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
  list: 'bg-sky-500/15 text-sky-700 border-sky-500/25 dark:text-sky-300',
  street: 'bg-amber-500/15 text-amber-800 border-amber-500/25 dark:text-amber-300',
  unknown: 'bg-muted text-muted-foreground border-border',
};

function HitList({ hits, countryCode }: { hits: PublicPriceHit[]; countryCode: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-card overflow-hidden card-shadow">
      {hits.map((hit, idx) => (
        <div
          key={`${hit.url}-${idx}`}
          className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 border-b last:border-b-0 border-border/60 hover:bg-primary/[0.04] transition-colors"
        >
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">{hit.retailer}</p>
              <Badge variant="outline" className={cn('rounded-md text-[10px] uppercase', PRICE_BADGE[hit.price_type])}>
                {PRICE_TYPE_LABEL[hit.price_type]}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate mt-0.5">{hit.title}</p>
            {hit.notes && <p className="text-xs text-muted-foreground mt-1">{hit.notes}</p>}
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
            <p className="text-base font-display font-bold tabular-nums">
              {formatPublicPrice(hit.price, hit.currency, countryCode)}
            </p>
            <Button asChild variant="outline" size="sm" className="rounded-lg h-8 group">
              <a href={hit.url} target="_blank" rel="noopener noreferrer">
                Open site
                <ArrowRight className="h-3.5 w-3.5 ml-1.5 transition-transform group-hover:translate-x-0.5" />
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PriceResultGroups({
  marketplaces,
  others,
  countryCode,
}: {
  marketplaces: PublicPriceHit[];
  others: PublicPriceHit[];
  countryCode: string;
}) {
  if (marketplaces.length === 0 && others.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center">
        No matching listings. Add more specs or try another country.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {marketplaces.length > 0 && (
        <section className="space-y-2 animate-fade-in-up">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-display font-semibold">Major marketplaces</h3>
              <p className="text-xs text-muted-foreground">Amazon, Flipkart, Croma, official stores, and other high-confidence retailers</p>
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {formatPriceRange(
                rangeFromHits(marketplaces).from,
                rangeFromHits(marketplaces).to,
                rangeFromHits(marketplaces).currency,
                countryCode,
              )}
              <span className="text-muted-foreground font-normal ml-2">{marketplaces.length} sites</span>
            </p>
          </div>
          <HitList hits={marketplaces} countryCode={countryCode} />
        </section>
      )}
      {others.length > 0 && (
        <section className="space-y-2 animate-fade-in-up animate-fade-in-up-delay-1">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-display font-semibold">Other listings</h3>
              <p className="text-xs text-muted-foreground">Smaller shops and aggregators — confirm the exact config before quoting</p>
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {formatPriceRange(
                rangeFromHits(others).from,
                rangeFromHits(others).to,
                rangeFromHits(others).currency,
                countryCode,
              )}
              <span className="text-muted-foreground font-normal ml-2">{others.length} sites</span>
            </p>
          </div>
          <HitList hits={others} countryCode={countryCode} />
        </section>
      )}
    </div>
  );
}
