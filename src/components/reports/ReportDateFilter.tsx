import { CalendarDays } from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DATE_PRESETS, formatDateRangeSubtitle } from '@/lib/datePresets';

export interface ReportDateFilterValue {
  preset: string;
  from: string | null;
  to: string | null;
}

interface ReportDateFilterProps {
  value: ReportDateFilterValue;
  onChange: (value: ReportDateFilterValue) => void;
  showAllTime?: boolean;
  className?: string;
}

function DatePickerMini({
  value,
  onChange,
  placeholder,
}: {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs font-normal flex-1">
          <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
          {value ? value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus />
      </PopoverContent>
    </Popover>
  );
}

export function ReportDateFilter({
  value,
  onChange,
  showAllTime = true,
  className,
}: ReportDateFilterProps) {
  const presets = showAllTime
    ? DATE_PRESETS
    : DATE_PRESETS.filter((p) => p.value !== 'all_time');

  const rangeLabel = formatDateRangeSubtitle(value.preset, value.from, value.to);
  const customFrom = value.from ? new Date(value.from) : undefined;
  const customTo = value.to ? new Date(value.to) : undefined;

  return (
    <div className={cn('space-y-1', className)}>
      <Select
        value={value.preset}
        onValueChange={(preset) => onChange({ ...value, preset })}
      >
        <SelectTrigger className="h-9 w-[180px] text-xs">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Select period" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === 'custom' && (
        <div className="flex items-center gap-2">
          <DatePickerMini
            value={customFrom}
            onChange={(d) => onChange({ ...value, from: d ? startOfDay(d).toISOString() : null })}
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <DatePickerMini
            value={customTo}
            onChange={(d) => onChange({ ...value, to: d ? endOfDay(d).toISOString() : null })}
            placeholder="To"
          />
        </div>
      )}

      {rangeLabel && value.preset !== 'custom' && (
        <p className="text-[11px] text-muted-foreground">{rangeLabel}</p>
      )}
      {value.preset === 'custom' && value.from && value.to && (
        <p className="text-[11px] text-muted-foreground">
          {formatDateRangeSubtitle('custom', value.from, value.to)}
        </p>
      )}
    </div>
  );
}
