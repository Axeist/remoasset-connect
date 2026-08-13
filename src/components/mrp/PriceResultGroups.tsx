import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  LOOKUP_MARKETS,
  PRICE_TYPE_LABEL,
  formatPriceRange,
  formatPublicPrice,
  rangeFromHits,
  splitExactNearby,
  splitPublicPriceHits,
  type PublicPriceHit,
  type PublicPriceType,
} from '@/lib/mrp-lookup';
import {
  formatStoreList,
  marketplaceNamesForCountry,
} from '@/lib/reputable-retailers';
import { cn } from '@/lib/utils';
import { ExternalLink, Search } from 'lucide-react';

const PRICE_BADGE: Record<PublicPriceType, string> = {
  mrp: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
  msrp: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300',
  list: 'bg-sky-500/15 text-sky-700 border-sky-500/25 dark:text-sky-300',
  street: 'bg-amber-500/15 text-amber-800 border-amber-500/25 dark:text-amber-300',
  unknown: 'bg-muted text-muted-foreground border-border',
};

function countryLabel(countryCode: string): string {
  return LOOKUP_MARKETS.find((m) => m.code === countryCode.toLowerCase())?.name || countryCode.toUpperCase();
}

function StoreMark({ name }: { name: string }) {
  return (
    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-display font-bold shrink-0">
      {(name.trim()[0] || '?').toUpperCase()}
    </div>
  );
}

function HitList({ hits, countryCode }: { hits: PublicPriceHit[]; countryCode: string }) {
  return (
    <div className="space-y-2">
      {hits.map((hit, idx) => (
        <a
          key={`${hit.url}-${idx}`}
          href={hit.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/80 px-3 py-3 hover:border-primary/40 hover:bg-primary/[0.04] transition-colors duration-200 cursor-pointer group"
        >
          <StoreMark name={hit.retailer} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-sm font-semibold truncate">{hit.retailer}</p>
              <Badge variant="outline" className={cn('rounded-md text-[10px] uppercase', PRICE_BADGE[hit.price_type])}>
                {PRICE_TYPE_LABEL[hit.price_type]}
              </Badge>
              {hit.match_quality === 'near' && (
                <Badge variant="outline" className="rounded-md text-[10px] uppercase bg-amber-500/10 text-amber-800 border-amber-500/25 dark:text-amber-300">
                  Nearby
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{hit.title}</p>
            {hit.notes && <p className="text-[11px] text-muted-foreground mt-1">{hit.notes}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <p className="text-base font-display font-bold tabular-nums">
              {formatPublicPrice(hit.price, hit.currency, countryCode)}
            </p>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity" />
          </div>
        </a>
      ))}
    </div>
  );
}

function GroupRail({
  title,
  subtitle,
  hits,
  countryCode,
}: {
  title: string;
  subtitle: string;
  hits: PublicPriceHit[];
  countryCode: string;
}) {
  if (!hits.length) return null;
  const range = rangeFromHits(hits);
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-2 px-0.5">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <p className="text-sm font-semibold tabular-nums">
          {formatPriceRange(range.from, range.to, range.currency, countryCode)}
          <span className="text-muted-foreground font-normal ml-2">{hits.length}</span>
        </p>
      </div>
      <HitList hits={hits} countryCode={countryCode} />
    </section>
  );
}

function StoreGroups({
  hits,
  countryCode,
}: {
  hits: PublicPriceHit[];
  countryCode: string;
}) {
  const split = splitPublicPriceHits(hits, countryCode);
  const country = countryLabel(countryCode);
  const storeNames = formatStoreList(marketplaceNamesForCountry(countryCode), 8);
  return (
    <div className="space-y-6">
      <GroupRail
        title="Official brand stores"
        subtitle="Manufacturer list and street prices"
        hits={split.official}
        countryCode={countryCode}
      />
      <GroupRail
        title="Major players"
        subtitle={storeNames || `National and regional chains in ${country}`}
        hits={split.marketplaces}
        countryCode={countryCode}
      />
      <GroupRail
        title="Local vendors"
        subtitle="Smaller shops — confirm the config before quoting"
        hits={split.others}
        countryCode={countryCode}
      />
    </div>
  );
}

export function PriceResultGroups({
  results,
  countryCode,
  countryName,
  queries,
}: {
  results: PublicPriceHit[];
  countryCode: string;
  countryName?: string;
  queries?: string[];
}) {
  const { exact, nearby } = splitExactNearby(results);
  const [tab, setTab] = useState<'exact' | 'nearby'>(exact.length ? 'exact' : 'nearby');
  const country = countryName || countryLabel(countryCode);

  useEffect(() => {
    setTab(exact.length ? 'exact' : 'nearby');
  }, [exact.length, nearby.length, results]);

  if (exact.length === 0 && nearby.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-card/40 px-6 py-12 text-center space-y-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
          <Search className="h-5 w-5" />
        </div>
        <p className="font-display font-semibold">No computers found in {country}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Public stores did not return this device. Cases and accessories are hidden on purpose.
        </p>
        {!!queries?.length && (
          <div className="flex flex-wrap justify-center gap-1.5 pt-2">
            {queries.map((q) => (
              <code key={q} className="text-[10px] px-2 py-1 rounded-md bg-muted/80 text-muted-foreground max-w-full truncate">
                {q.replace(/^(shopping|search):\s*/i, '')}
              </code>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {(exact.length > 0 && nearby.length > 0) && (
        <div className="inline-flex rounded-xl bg-muted/60 p-1">
          <button
            type="button"
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors duration-200',
              tab === 'exact' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab('exact')}
          >
            Exact · {exact.length}
          </button>
          <button
            type="button"
            className={cn(
              'h-8 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors duration-200',
              tab === 'nearby' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab('nearby')}
          >
            Nearby · {nearby.length}
          </button>
        </div>
      )}
      {tab === 'exact' && exact.length > 0 && <StoreGroups hits={exact} countryCode={countryCode} />}
      {tab === 'nearby' && nearby.length > 0 && <StoreGroups hits={nearby} countryCode={countryCode} />}
    </div>
  );
}
