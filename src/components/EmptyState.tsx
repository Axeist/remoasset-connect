import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Illustration = 'leads' | 'tasks' | 'inbox' | 'search' | 'bell';

function Art({ kind }: { kind: Illustration }) {
  const common = 'h-28 w-28 sm:h-32 sm:w-32';
  switch (kind) {
    case 'tasks':
      return (
        <svg className={common} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="hsl(var(--primary) / .08)" />
          <rect x="30" y="26" width="60" height="72" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
          <rect x="42" y="22" width="36" height="12" rx="6" fill="hsl(var(--primary))" />
          {[48, 66, 84].map((y, i) => (
            <g key={y}>
              <rect x="40" y={y - 6} width="12" height="12" rx="4" fill={i === 0 ? 'hsl(var(--success))' : 'none'} stroke={i === 0 ? 'hsl(var(--success))' : 'hsl(var(--border))'} strokeWidth="2" />
              {i === 0 && <path d="M43 y" />}
              <rect x="58" y={y - 3} width={i === 1 ? 20 : 26} height="6" rx="3" fill="hsl(var(--muted))" />
            </g>
          ))}
          <path d="M43.5 48l3 3 5-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'inbox':
      return (
        <svg className={common} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="hsl(var(--primary) / .08)" />
          <rect x="24" y="38" width="72" height="50" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
          <path d="M28 44l32 24 32-24" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="92" cy="40" r="9" fill="hsl(var(--primary))" />
        </svg>
      );
    case 'bell':
      return (
        <svg className={common} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="hsl(var(--primary) / .08)" />
          <path d="M60 28c-14 0-22 10-22 24v14l-8 10h60l-8-10V52c0-14-8-24-22-24z" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" strokeLinejoin="round" />
          <path d="M52 82a8 8 0 0 0 16 0" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />
          <circle cx="82" cy="34" r="7" fill="hsl(var(--primary))" />
        </svg>
      );
    case 'search':
      return (
        <svg className={common} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="hsl(var(--primary) / .08)" />
          <circle cx="54" cy="54" r="22" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="4" />
          <path d="M70 70l20 20" stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round" />
          <path d="M46 54h16" stroke="hsl(var(--border))" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg className={common} viewBox="0 0 120 120" fill="none" aria-hidden="true">
          <circle cx="60" cy="60" r="52" fill="hsl(var(--primary) / .08)" />
          <circle cx="46" cy="50" r="14" fill="hsl(var(--primary))" opacity=".9" />
          <circle cx="76" cy="46" r="11" fill="hsl(var(--primary) / .45)" />
          <path d="M22 92c2-16 14-24 24-24s22 8 24 24z" fill="hsl(var(--primary) / .85)" />
          <path d="M66 90c1-11 8-18 16-18s14 6 16 18z" fill="hsl(var(--primary) / .4)" />
        </svg>
      );
  }
}

interface EmptyStateProps {
  illustration?: Illustration;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Friendly empty state: a gently floating illustration, one line of copy and one clear action. */
export function EmptyState({ illustration = 'leads', title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <div className="empty-float"><Art kind={illustration} /></div>
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
