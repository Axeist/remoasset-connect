import { CalendarDays } from 'lucide-react';
import { startOfDay, endOfDay } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
  compact?: boolean;
}

function DatePickerButton({
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
        <Button variant="outline" size="sm" className="h-9 text-sm gap-2 font-normal flex-1 justify-start">
          <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
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
  compact = false,
}: ReportDateFilterProps) {
  const presets = showAllTime
    ? DATE_PRESETS
    : DATE_PRESETS.filter((p) => p.value !== 'all_time');

  const rangeLabel = formatDateRangeSubtitle(value.preset, value.from, value.to);
  const customFrom = value.from ? new Date(value.from) : undefined;
  const customTo = value.to ? new Date(value.to) : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      {!compact && <Label className="text-xs text-muted-foreground font-medium">Date range</Label>}
      <Select
        value={value.preset}
        onValueChange={(preset) => onChange({ ...value, preset })}
      >
        <SelectTrigger className="h-9 text-sm w-full">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Select period" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.preset === 'custom' && !compact && (
        <div className="flex items-center gap-2">
          <DatePickerButton
            value={customFrom}
            onChange={(d) => onChange({ ...value, from: d ? startOfDay(d).toISOString() : null })}
            placeholder="From"
          />
          <span className="text-sm text-muted-foreground shrink-0">to</span>
          <DatePickerButton
            value={customTo}
            onChange={(d) => onChange({ ...value, to: d ? endOfDay(d).toISOString() : null })}
            placeholder="To"
          />
        </div>
      )}

      {rangeLabel && !compact && (
        <p className="text-xs text-muted-foreground">
          {value.preset === 'custom' && (!value.from || !value.to)
            ? 'Select both dates'
            : rangeLabel}
        </p>
      )}
      {compact && value.preset === 'custom' && (
        <div className="flex items-center gap-2 mt-1.5">
          <DatePickerButton
            value={customFrom}
            onChange={(d) => onChange({ ...value, from: d ? startOfDay(d).toISOString() : null })}
            placeholder="From"
          />
          <span className="text-sm text-muted-foreground shrink-0">–</span>
          <DatePickerButton
            value={customTo}
            onChange={(d) => onChange({ ...value, to: d ? endOfDay(d).toISOString() : null })}
            placeholder="To"
          />
        </div>
      )}
    </div>
  );
}
