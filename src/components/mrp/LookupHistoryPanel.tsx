import { Button } from '@/components/ui/button';
import {
  formatPriceRange,
  type MrpLookupHistoryRow,
} from '@/lib/mrp-lookup';
import { cn } from '@/lib/utils';
import { Clock, RotateCcw, Trash2 } from 'lucide-react';

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function LookupHistoryPanel({
  rows,
  loading,
  selectedId,
  onRestore,
  onRerun,
  onDelete,
  onClearAll,
}: {
  rows: MrpLookupHistoryRow[];
  loading?: boolean;
  selectedId?: string | null;
  onRestore: (row: MrpLookupHistoryRow) => void;
  onRerun: (row: MrpLookupHistoryRow) => void;
  onDelete: (row: MrpLookupHistoryRow) => void;
  onClearAll: () => void;
}) {
  return (
    <aside className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm p-4 card-shadow lg:sticky lg:top-20">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-primary" />
        <h3 className="font-display font-semibold text-sm">Recent</h3>
        {rows.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 ml-auto text-xs text-muted-foreground hover:text-destructive cursor-pointer"
            onClick={onClearAll}
          >
            Clear
          </Button>
        )}
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground py-8 text-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center leading-relaxed">
          Your searches land here. Restore a range without spending tokens.
        </p>
      ) : (
        <div className="relative space-y-0 max-h-[70vh] overflow-y-auto pr-1">
          <div className="absolute left-[11px] top-3 bottom-3 w-px bg-border/80" />
          {rows.map((row) => {
            const q = row.query;
            const title = `${q.brand} ${q.model}`.trim() || 'Lookup';
            const active = selectedId === row.id;
            return (
              <div key={row.id} className="relative pl-7 py-2 group">
                <span
                  className={cn(
                    'absolute left-[7px] top-4 h-2.5 w-2.5 rounded-full border-2 bg-background',
                    active ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                  )}
                />
                <button
                  type="button"
                  className={cn(
                    'w-full text-left rounded-xl px-3 py-2.5 cursor-pointer transition-colors duration-200',
                    active ? 'bg-primary/10' : 'hover:bg-primary/[0.05]',
                  )}
                  onClick={() => onRestore(row)}
                >
                  <p className="text-sm font-semibold truncate">{title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {q.country} · {relativeTime(row.created_at)}
                  </p>
                  <p className="text-sm font-display font-bold tabular-nums mt-1">
                    {formatPriceRange(
                      row.summary.range_from,
                      row.summary.range_to,
                      row.summary.currency,
                      q.country_code,
                    )}
                  </p>
                </button>
                <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs cursor-pointer"
                    onClick={() => onRerun(row)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Again
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive ml-auto cursor-pointer"
                    onClick={() => onDelete(row)}
                    aria-label={`Delete ${title}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
