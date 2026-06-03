import { useMemo } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type FilterOption = { value: string; label: string };

type Props = {
  emptyLabel: string;
  selected: string[];
  options: FilterOption[];
  onToggle: (value: string) => void;
  onClear: () => void;
  clearLabel?: string;
  resolveLabel?: (value: string) => string;
  className?: string;
  contentClassName?: string;
  maxListHeight?: string;
};

export function multiSelectTriggerLabel(
  selected: string[],
  emptyLabel: string,
  options: FilterOption[],
  resolveLabel?: (value: string) => string,
): string {
  if (selected.length === 0) return emptyLabel;
  if (selected.length === 1) {
    const v = selected[0];
    return resolveLabel?.(v) ?? options.find((o) => o.value === v)?.label ?? v;
  }
  return `${selected.length} selected`;
}

export function FilterMultiSelect({
  emptyLabel,
  selected,
  options,
  onToggle,
  onClear,
  clearLabel = 'Clear',
  resolveLabel,
  className,
  contentClassName,
  maxListHeight = 'max-h-[280px]',
}: Props) {
  const triggerLabel = useMemo(
    () => multiSelectTriggerLabel(selected, emptyLabel, options, resolveLabel),
    [selected, emptyLabel, options, resolveLabel],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-10 min-w-[120px] max-w-[220px] justify-between gap-2 font-normal',
            selected.length > 0 && 'border-primary/50',
            className,
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[220px] p-2', contentClassName)} align="start">
        <div className={cn('space-y-0.5 overflow-y-auto', maxListHeight)}>
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted"
            >
              <Checkbox
                checked={selected.includes(opt.value)}
                onCheckedChange={() => onToggle(opt.value)}
              />
              <span className="truncate">{opt.label}</span>
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-8 w-full text-xs text-muted-foreground"
            onClick={onClear}
          >
            {clearLabel}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
