import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatPriceRange,
  type MrpLookupHistoryRow,
} from '@/lib/mrp-lookup';
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
  onRestore,
  onRerun,
  onDelete,
  onClearAll,
}: {
  rows: MrpLookupHistoryRow[];
  loading?: boolean;
  onRestore: (row: MrpLookupHistoryRow) => void;
  onRerun: (row: MrpLookupHistoryRow) => void;
  onDelete: (row: MrpLookupHistoryRow) => void;
  onClearAll: () => void;
}) {
  return (
    <Card className="rounded-xl border-border/80 card-shadow animate-fade-in-up animate-fade-in-up-delay-2">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-sm">Recent searches</h3>
          {rows.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 ml-auto text-xs text-muted-foreground hover:text-destructive"
              onClick={onClearAll}
            >
              Clear all
            </Button>
          )}
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Loading history…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Searches you run will show up here. Click one to restore the range without spending tokens.
          </p>
        ) : (
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {rows.map((row) => {
              const q = row.query;
              const title = `${q.brand} ${q.model}`.trim() || 'Lookup';
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-border/70 px-3 py-2.5 hover:bg-primary/[0.04] transition-colors"
                >
                  <button type="button" className="w-full text-left" onClick={() => onRestore(row)}>
                    <p className="text-sm font-semibold truncate">{title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {q.country} · {relativeTime(row.created_at)}
                    </p>
                    <p className="text-xs font-medium tabular-nums mt-1">
                      {formatPriceRange(
                        row.summary.range_from,
                        row.summary.range_to,
                        row.summary.currency,
                        q.country_code,
                      )}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 mt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => onRerun(row)}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" /> Search again
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive ml-auto"
                      onClick={() => onDelete(row)}
                      aria-label={`Delete ${title}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
