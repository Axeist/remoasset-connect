import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const RFQ_WIZARD_STEPS = [
  { n: 1 as const, label: 'Brief' },
  { n: 2 as const, label: 'Partners' },
  { n: 3 as const, label: 'Email' },
];

type Step = 1 | 2 | 3;

export function RfqWizardRail({
  step,
  onStepChange,
}: {
  step: Step;
  onStepChange: (step: Step) => void;
}) {
  return (
    <nav aria-label="Form progress" className="flex gap-1.5 sm:gap-2">
      {RFQ_WIZARD_STEPS.map((s) => {
        const done = s.n < step;
        const active = s.n === step;
        return (
          <button
            key={s.n}
            type="button"
            onClick={() => {
              if (s.n < step) onStepChange(s.n);
            }}
            disabled={s.n > step}
            className={cn(
              'flex-1 min-w-0 rounded-lg px-1.5 py-2 sm:px-3 sm:py-2.5 text-left transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              s.n <= step ? 'cursor-pointer hover:bg-muted/80' : 'cursor-not-allowed opacity-50',
              active && 'bg-primary/10 ring-1 ring-primary/30',
            )}
          >
            <div
              className={cn(
                'h-1 rounded-full mb-2 transition-colors duration-200',
                done ? 'bg-primary' : active ? 'bg-primary/70' : 'bg-muted',
              )}
            />
            <div className="flex items-center gap-1">
              {done && <Check className="h-3 w-3 text-primary shrink-0 hidden sm:block" aria-hidden />}
              <span
                className={cn(
                  'text-[10px] sm:text-xs font-semibold uppercase tracking-wide truncate',
                  active && 'text-primary',
                )}
              >
                {s.label}
              </span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
