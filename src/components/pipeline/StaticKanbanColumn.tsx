import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StaticKanbanColumnProps {
  title: string;
  color: string;
  count: number;
  totalScore: number;
  children: ReactNode;
}

export function StaticKanbanColumn({ title, color, count, totalScore, children }: StaticKanbanColumnProps) {
  return (
    <div
      className={cn(
        'w-[290px] shrink-0 flex flex-col rounded-xl transition-all duration-200',
        'bg-muted/30 border border-border/60',
      )}
    >
      <div className="shrink-0 px-3 py-2.5 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-semibold text-foreground truncate">{title}</span>
            <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-foreground/10 text-[11px] font-semibold text-foreground/70">
              {count}
            </span>
          </div>
          {totalScore > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded px-1.5 py-0.5">
              {totalScore} pts
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
        {children}
      </div>
    </div>
  );
}
