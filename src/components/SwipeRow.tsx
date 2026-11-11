import { useState, type ReactNode } from 'react';
import { m } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeRowProps {
  children: ReactNode;
  /** Swipe right (e.g. complete). */
  onSwipeRight?: () => void;
  /** Swipe left (e.g. delete). */
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  className?: string;
}

/** Touch-only swipe actions with resistance and a reveal; on mouse devices it renders its children untouched. */
export function SwipeRow({ children, onSwipeRight, onSwipeLeft, rightLabel = 'Done', leftLabel = 'Delete', className }: SwipeRowProps) {
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const [x, setX] = useState(0);
  if (!coarse || (!onSwipeRight && !onSwipeLeft)) return <>{children}</>;
  const LIMIT = 96;
  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      {onSwipeRight && (
        <div className="absolute inset-y-0 left-0 flex w-28 items-center justify-start gap-1.5 bg-success pl-4 text-sm font-semibold text-white" aria-hidden="true">
          <Check className="h-4 w-4" /> {rightLabel}
        </div>
      )}
      {onSwipeLeft && (
        <div className="absolute inset-y-0 right-0 flex w-28 items-center justify-end gap-1.5 bg-destructive pr-4 text-sm font-semibold text-white" aria-hidden="true">
          {leftLabel} <Trash2 className="h-4 w-4" />
        </div>
      )}
      <m.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: onSwipeLeft ? -LIMIT : 0, right: onSwipeRight ? LIMIT : 0 }}
        dragElastic={0.18}
        dragSnapToOrigin
        onDrag={(_, info) => setX(info.offset.x)}
        onDragEnd={(_, info) => {
          setX(0);
          if (info.offset.x > LIMIT * 0.7) onSwipeRight?.();
          else if (info.offset.x < -LIMIT * 0.7) onSwipeLeft?.();
        }}
        className="relative bg-card"
        style={{ touchAction: 'pan-y' }}
        animate={{ opacity: 1 - Math.min(Math.abs(x) / 400, 0.15) }}
      >
        {children}
      </m.div>
    </div>
  );
}
