import { useEffect, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, HelpCircle, Search } from 'lucide-react';

export function SpecCombobox({
  label,
  value,
  onChange,
  options,
  placeholder,
  required,
  tooltip,
  size = 'default',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  required?: boolean;
  tooltip?: string;
  size?: 'default' | 'sm';
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const compact = size === 'sm';

  const filtered = search
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const selectOption = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={cn('min-w-0', compact ? 'space-y-1' : 'space-y-1.5')}>
      <Label className={cn(
        'font-medium flex items-center gap-1',
        compact ? 'text-xs text-muted-foreground h-4 leading-4' : 'text-sm',
      )}>
        <span className="truncate">{label}</span>
        {required && <span className="text-destructive">*</span>}
        {tooltip && !compact && (
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help shrink-0" />
            </TooltipTrigger>
            <TooltipContent><p className="text-xs">{tooltip}</p></TooltipContent>
          </Tooltip>
        )}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            title={tooltip}
            className={cn(
              'flex w-full items-center justify-between border-[1.5px] border-input bg-background px-3 text-sm ring-offset-background',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              compact ? 'h-9 rounded-lg' : 'h-10 rounded-[10px] py-2',
              !value && 'text-muted-foreground',
            )}
          >
            <span className="truncate text-left">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0 overflow-hidden"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              className="spec-combo-search flex h-9 w-full bg-transparent text-sm outline-none border-0 shadow-none ring-0 focus:outline-none focus-visible:outline-none placeholder:text-muted-foreground"
              placeholder="Search or type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search) {
                  selectOption(filtered[0] || search);
                }
                if (e.key === 'Escape') setOpen(false);
              }}
            />
          </div>
          <ScrollArea className="max-h-[200px]">
            {filtered.length === 0 && search ? (
              <button
                type="button"
                className="w-full px-3 py-2 text-sm text-left hover:bg-accent rounded cursor-pointer"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(search)}
              >
                Use “<span className="font-medium">{search}</span>”
              </button>
            ) : filtered.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No options</p>
            ) : (
              <div className="p-1">
                {filtered.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground',
                      value === opt && 'bg-accent/50',
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectOption(opt)}
                  >
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt ? 'opacity-100' : 'opacity-0')} />
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}
