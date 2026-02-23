import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Building2, User, Star, GripVertical, ExternalLink, Plus } from 'lucide-react';
import type { Lead } from '@/types/lead';

interface KanbanCardContentProps {
  lead: Lead;
  onClick?: () => void;
  onAddActivity?: (lead: Lead) => void;
  isDragOverlay?: boolean;
  showGrip?: boolean;
  gripListeners?: Record<string, unknown>;
}

function scoreColor(score: number | null): string {
  if (!score || score === 0) return 'text-muted-foreground bg-muted';
  if (score >= 70) return 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-500/15';
  if (score >= 40) return 'text-amber-700 bg-amber-100 dark:text-amber-400 dark:bg-amber-500/15';
  return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/15';
}

function CardContent({ lead, onClick, onAddActivity, isDragOverlay, showGrip, gripListeners }: KanbanCardContentProps) {
  return (
    <>
      {showGrip && (
        <div
          {...gripListeners}
          className="absolute top-2.5 right-2 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors cursor-grab"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      <div className="flex items-start gap-2 pr-6 mb-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate leading-tight">{lead.company_name}</p>
          {lead.contact_name && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
              <User className="h-3 w-3 shrink-0" />
              {lead.contact_name}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold', scoreColor(lead.lead_score))}>
          <Star className="h-2.5 w-2.5" />
          {lead.lead_score ?? 0}
        </span>
        {lead.country?.code && (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
            {lead.country.code}
          </span>
        )}
        {lead.owner?.full_name && (
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground truncate max-w-[100px]">
            {lead.owner.full_name}
          </span>
        )}
      </div>

      {!isDragOverlay && (
        <div className="absolute bottom-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddActivity && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddActivity(lead); }}
              className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              title="Add activity"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
          {onClick && (
            <button
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Open lead"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ---------- Draggable card (for status view with DnD) ----------

interface KanbanCardProps {
  lead: Lead;
  onClick?: () => void;
  onAddActivity?: (lead: Lead) => void;
  isDragOverlay?: boolean;
  disableDrag?: boolean;
}

export function KanbanCard({ lead, onClick, onAddActivity, isDragOverlay, disableDrag }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id, disabled: disableDrag });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
  };

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...attributes}
      className={cn(
        'group relative rounded-lg border bg-card p-3 select-none',
        'transition-all duration-200 hover:shadow-md hover:border-border',
        'hover:-translate-y-0.5',
        disableDrag ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-30 scale-95',
        isDragOverlay && 'shadow-xl shadow-black/15 ring-2 ring-primary/30 rotate-[2deg] scale-105 z-50',
      )}
    >
      <CardContent
        lead={lead}
        onClick={onClick}
        onAddActivity={onAddActivity}
        isDragOverlay={isDragOverlay}
        showGrip={!disableDrag}
        gripListeners={disableDrag ? undefined : listeners}
      />
    </div>
  );
}

// ---------- Static card (for activity view, no DnD) ----------

interface StaticKanbanCardProps {
  lead: Lead;
  onClick?: () => void;
  onAddActivity?: (lead: Lead) => void;
}

export function StaticKanbanCard({ lead, onClick, onAddActivity }: StaticKanbanCardProps) {
  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-3 select-none',
        'transition-all duration-200 hover:shadow-md hover:border-border',
        'hover:-translate-y-0.5 cursor-default',
      )}
    >
      <CardContent
        lead={lead}
        onClick={onClick}
        onAddActivity={onAddActivity}
        showGrip={false}
      />
    </div>
  );
}
