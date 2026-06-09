import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Search, SlidersHorizontal, RotateCcw, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CLIENT_REQUEST_TYPE_OPTIONS } from '@/constants/client-request-types';
import { CLIENT_REQUEST_STATUSES } from '@/constants/device-options';
import type { ClientRequest } from '@/types/procurement';
import {
  countActiveClientRequestFilters,
  EMPTY_CLIENT_REQUEST_FILTERS,
  type ClientRequestFiltersState,
  vendorOptionsFromRequests,
  countryOptionsFromRequests,
} from '@/lib/client-request-filters';
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
} from 'date-fns';

const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
] as const;

function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const today = startOfDay(now);

  switch (preset) {
    case 'today':
      return { from: today.toISOString(), to: endOfDay(now).toISOString() };
    case 'yesterday': {
      const y = subDays(today, 1);
      return { from: y.toISOString(), to: endOfDay(y).toISOString() };
    }
    case 'this_week':
      return { from: startOfWeek(today, { weekStartsOn: 1 }).toISOString(), to: endOfDay(now).toISOString() };
    case 'last_week': {
      const lw = subWeeks(today, 1);
      return { from: startOfWeek(lw, { weekStartsOn: 1 }).toISOString(), to: endOfWeek(lw, { weekStartsOn: 1 }).toISOString() };
    }
    case 'this_month':
      return { from: startOfMonth(today).toISOString(), to: endOfDay(now).toISOString() };
    case 'last_month': {
      const lm = subMonths(today, 1);
      return { from: startOfMonth(lm).toISOString(), to: endOfMonth(lm).toISOString() };
    }
    case 'last_3_months':
      return { from: startOfMonth(subMonths(today, 2)).toISOString(), to: endOfDay(now).toISOString() };
    case 'this_year':
      return { from: startOfYear(today).toISOString(), to: endOfDay(now).toISOString() };
    default:
      return { from: '', to: '' };
  }
}

interface ClientRequestFiltersProps {
  filters: ClientRequestFiltersState;
  onFiltersChange: (filters: ClientRequestFiltersState) => void;
  requests: ClientRequest[];
  filteredCount: number;
}

export function ClientRequestFilters({
  filters, onFiltersChange, requests, filteredCount,
}: ClientRequestFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const vendorOptions = useMemo(() => vendorOptionsFromRequests(requests), [requests]);
  const countryOptions = useMemo(() => countryOptionsFromRequests(requests), [requests]);

  const activeFilterCount = useMemo(() => countActiveClientRequestFilters(filters), [filters]);

  const hasAdvancedFilter = filters.vendorAssigned || filters.profit
    || filters.createdPreset || filters.createdFrom;

  useEffect(() => {
    if (hasAdvancedFilter) setShowAdvanced(true);
  }, [hasAdvancedFilter]);

  const update = (patch: Partial<ClientRequestFiltersState>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const clearAll = () => onFiltersChange({ ...EMPTY_CLIENT_REQUEST_FILTERS });

  const handleCreatedPreset = (preset: string) => {
    if (preset === 'all') {
      update({ createdPreset: '', createdFrom: '', createdTo: '' });
      return;
    }
    if (preset === 'custom') {
      update({ createdPreset: 'custom' });
      return;
    }
    const range = getPresetRange(preset);
    update({ createdPreset: preset, createdFrom: range.from, createdTo: range.to });
  };

  const customFrom = filters.createdFrom ? new Date(filters.createdFrom) : undefined;
  const customTo = filters.createdTo ? new Date(filters.createdTo) : undefined;

  return (
    <Card className="border-border/80">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search requests, vendors, employees, tracking…"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              className="pl-10 h-10"
            />
          </div>
          <Button
            variant={showAdvanced ? 'secondary' : 'outline'}
            size="sm"
            className="gap-1.5 shrink-0 h-10"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1 shrink-0 h-10 text-muted-foreground" onClick={clearAll}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
          <span className="text-xs text-muted-foreground shrink-0 ml-auto">
            {filteredCount === requests.length
              ? `${requests.length} request${requests.length === 1 ? '' : 's'}`
              : `${filteredCount} of ${requests.length}`}
          </span>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <Select value={filters.requestType || 'all'} onValueChange={(v) => update({ requestType: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {CLIENT_REQUEST_TYPE_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.shortLabel}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.status || 'all'} onValueChange={(v) => update({ status: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {CLIENT_REQUEST_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.payment || 'all'} onValueChange={(v) => update({ payment: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.vendorId || 'all'} onValueChange={(v) => update({ vendorId: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Vendor" />
            </SelectTrigger>
            <SelectContent className="max-h-[min(280px,50vh)]">
              <SelectItem value="all">All vendors</SelectItem>
              {vendorOptions.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filters.countryId || 'all'} onValueChange={(v) => update({ countryId: v === 'all' ? '' : v })}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent className="max-h-[min(280px,50vh)]">
              <SelectItem value="all">All countries</SelectItem>
              {countryOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {showAdvanced && (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 pt-1 border-t border-border/50">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Vendor assigned</Label>
              <Select value={filters.vendorAssigned || 'all'} onValueChange={(v) => update({ vendorAssigned: v === 'all' ? '' : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="yes">Assigned</SelectItem>
                  <SelectItem value="no">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Profit</Label>
              <Select value={filters.profit || 'all'} onValueChange={(v) => update({ profit: v === 'all' ? '' : v })}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="unknown">Not calculated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Created</Label>
              <Select
                value={filters.createdPreset || 'all'}
                onValueChange={handleCreatedPreset}
              >
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Any time" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any time</SelectItem>
                  {DATE_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {filters.createdPreset === 'custom' && (
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <Label className="text-xs text-muted-foreground">Custom range</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-9 flex-1 justify-start text-left font-normal text-xs', !customFrom && 'text-muted-foreground')}>
                        <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                        {customFrom ? format(customFrom, 'MMM d, yyyy') : 'From'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customFrom}
                        onSelect={(d) => update({ createdFrom: d ? startOfDay(d).toISOString() : '' })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-9 flex-1 justify-start text-left font-normal text-xs', !customTo && 'text-muted-foreground')}>
                        <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                        {customTo ? format(customTo, 'MMM d, yyyy') : 'To'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={customTo}
                        onSelect={(d) => update({ createdTo: d ? endOfDay(d).toISOString() : '' })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
