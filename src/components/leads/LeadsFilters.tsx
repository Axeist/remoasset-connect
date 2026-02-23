import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Search, SlidersHorizontal, X, CalendarDays, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
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

export interface LeadsFiltersState {
  search: string;
  status: string;
  country: string;
  owner: string;
  scoreMin: number;
  scoreMax: number;
  vendorType: string;
  warehouseAvailable: string;
  createdPreset: string;
  createdFrom: string;
  createdTo: string;
  lastActivityPreset: string;
  lastActivityFrom: string;
  lastActivityTo: string;
  ndaStatus: string;
  linkedinOutreach: string;
}

const EMPTY_FILTERS: LeadsFiltersState = {
  search: '',
  status: '',
  country: '',
  owner: '',
  scoreMin: 0,
  scoreMax: 100,
  vendorType: '',
  warehouseAvailable: '',
  createdPreset: '',
  createdFrom: '',
  createdTo: '',
  lastActivityPreset: '',
  lastActivityFrom: '',
  lastActivityTo: '',
  ndaStatus: '',
  linkedinOutreach: '',
};

interface LeadsFiltersProps {
  filters: LeadsFiltersState;
  onFiltersChange: (filters: LeadsFiltersState) => void;
  ownerOptions: { id: string; full_name: string | null }[];
}

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

export function LeadsFilters({ filters, onFiltersChange, ownerOptions }: LeadsFiltersProps) {
  const [statuses, setStatuses] = useState<{ id: string; name: string; color: string }[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    (async () => {
      const [statusRes, countryRes] = await Promise.all([
        supabase.from('lead_statuses').select('id, name, color').order('sort_order'),
        supabase.from('countries').select('id, name').order('name'),
      ]);
      if (statusRes.data) setStatuses(statusRes.data);
      if (countryRes.data) setCountries(countryRes.data);
    })();
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status) count++;
    if (filters.country) count++;
    if (filters.owner) count++;
    if (filters.vendorType) count++;
    if (filters.warehouseAvailable) count++;
    if (filters.ndaStatus) count++;
    if (filters.linkedinOutreach) count++;
    if (filters.scoreMin > 0 || filters.scoreMax < 100) count++;
    if (filters.createdPreset || filters.createdFrom) count++;
    if (filters.lastActivityPreset || filters.lastActivityFrom) count++;
    return count;
  }, [filters]);

  const hasAnyAdvancedFilter = filters.scoreMin > 0 || filters.scoreMax < 100 ||
    filters.createdPreset || filters.createdFrom ||
    filters.lastActivityPreset || filters.lastActivityFrom;

  useEffect(() => {
    if (hasAnyAdvancedFilter) setShowAdvanced(true);
  }, [hasAnyAdvancedFilter]);

  const update = (patch: Partial<LeadsFiltersState>) => {
    onFiltersChange({ ...filters, ...patch });
  };

  const clearAll = () => {
    onFiltersChange({ ...EMPTY_FILTERS, search: filters.search });
  };

  const handleCreatedPreset = (preset: string) => {
    if (preset === '' || preset === 'all') {
      update({ createdPreset: '', createdFrom: '', createdTo: '' });
    } else if (preset === 'custom') {
      update({ createdPreset: 'custom' });
    } else {
      const range = getPresetRange(preset);
      update({ createdPreset: preset, createdFrom: range.from, createdTo: range.to });
    }
  };

  const handleLastActivityPreset = (preset: string) => {
    if (preset === '' || preset === 'all') {
      update({ lastActivityPreset: '', lastActivityFrom: '', lastActivityTo: '' });
    } else if (preset === 'custom') {
      update({ lastActivityPreset: 'custom' });
    } else {
      const range = getPresetRange(preset);
      update({ lastActivityPreset: preset, lastActivityFrom: range.from, lastActivityTo: range.to });
    }
  };

  return (
    <Card className="card-shadow rounded-xl border-border/80">
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Search + toggle advanced + active filter count */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              className="pl-10"
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
        </div>

        {/* Row 2: Basic filters (always visible) */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          <Select
            value={filters.status || 'all'}
            onValueChange={(v) => update({ status: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.country || 'all'}
            onValueChange={(v) => update({ country: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.owner || 'all'}
            onValueChange={(v) => update({ owner: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Owners</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {ownerOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.full_name || o.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.vendorType || 'all'}
            onValueChange={(v) => update({ vendorType: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Vendor Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendor Types</SelectItem>
              <SelectItem value="new_device">New Device</SelectItem>
              <SelectItem value="refurbished">Refurbished</SelectItem>
              <SelectItem value="rental">Rental</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.warehouseAvailable || 'all'}
            onValueChange={(v) => update({ warehouseAvailable: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              <SelectItem value="true">Warehouse Available</SelectItem>
              <SelectItem value="false">No Warehouse</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.ndaStatus || 'all'}
            onValueChange={(v) => update({ ndaStatus: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="NDA Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All NDA</SelectItem>
              <SelectItem value="nda_sent">NDA Sent</SelectItem>
              <SelectItem value="nda_received">NDA Received</SelectItem>
              <SelectItem value="nda_any">Has NDA</SelectItem>
              <SelectItem value="no_nda">No NDA</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.linkedinOutreach || 'all'}
            onValueChange={(v) => update({ linkedinOutreach: v === 'all' ? '' : v })}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="LinkedIn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All LinkedIn</SelectItem>
              <SelectItem value="has_linkedin">Has Outreach</SelectItem>
              <SelectItem value="no_linkedin">No Outreach</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Row 3: Advanced filters (expandable) */}
        {showAdvanced && (
          <div className="border-t pt-3 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {/* Created date */}
              <DatePresetFilter
                label="Created date"
                preset={filters.createdPreset}
                from={filters.createdFrom}
                to={filters.createdTo}
                onPresetChange={handleCreatedPreset}
                onFromChange={(d) => update({ createdFrom: d })}
                onToChange={(d) => update({ createdTo: d })}
              />

              {/* Last activity date */}
              <DatePresetFilter
                label="Last activity"
                preset={filters.lastActivityPreset}
                from={filters.lastActivityFrom}
                to={filters.lastActivityTo}
                onPresetChange={handleLastActivityPreset}
                onFromChange={(d) => update({ lastActivityFrom: d })}
                onToChange={(d) => update({ lastActivityTo: d })}
              />

              {/* Lead score range */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Lead score</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={filters.scoreMin}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      update({ scoreMin: v });
                    }}
                    className="h-9 text-xs w-20"
                    placeholder="Min"
                  />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={filters.scoreMax}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      update({ scoreMax: v });
                    }}
                    className="h-9 text-xs w-20"
                    placeholder="Max"
                  />
                  {(filters.scoreMin > 0 || filters.scoreMax < 100) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => update({ scoreMin: 0, scoreMax: 100 })}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Active filter chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {filters.status && (
                  <FilterChip
                    label={`Status: ${statuses.find((s) => s.id === filters.status)?.name ?? 'Unknown'}`}
                    onRemove={() => update({ status: '' })}
                  />
                )}
                {filters.country && (
                  <FilterChip
                    label={`Country: ${countries.find((c) => c.id === filters.country)?.name ?? 'Unknown'}`}
                    onRemove={() => update({ country: '' })}
                  />
                )}
                {filters.owner && (
                  <FilterChip
                    label={`Owner: ${filters.owner === 'unassigned' ? 'Unassigned' : ownerOptions.find((o) => o.id === filters.owner)?.full_name ?? 'Unknown'}`}
                    onRemove={() => update({ owner: '' })}
                  />
                )}
                {filters.vendorType && (
                  <FilterChip
                    label={`Vendor: ${filters.vendorType.replace(/_/g, ' ')}`}
                    onRemove={() => update({ vendorType: '' })}
                  />
                )}
                {filters.warehouseAvailable && (
                  <FilterChip
                    label={filters.warehouseAvailable === 'true' ? 'Has warehouse' : 'No warehouse'}
                    onRemove={() => update({ warehouseAvailable: '' })}
                  />
                )}
                {filters.ndaStatus && (
                  <FilterChip
                    label={`NDA: ${
                      filters.ndaStatus === 'nda_sent' ? 'Sent' :
                      filters.ndaStatus === 'nda_received' ? 'Received' :
                      filters.ndaStatus === 'nda_any' ? 'Has NDA' : 'No NDA'
                    }`}
                    onRemove={() => update({ ndaStatus: '' })}
                  />
                )}
                {filters.linkedinOutreach && (
                  <FilterChip
                    label={`LinkedIn: ${filters.linkedinOutreach === 'has_linkedin' ? 'Has Outreach' : 'No Outreach'}`}
                    onRemove={() => update({ linkedinOutreach: '' })}
                  />
                )}
                {(filters.scoreMin > 0 || filters.scoreMax < 100) && (
                  <FilterChip
                    label={`Score: ${filters.scoreMin}–${filters.scoreMax}`}
                    onRemove={() => update({ scoreMin: 0, scoreMax: 100 })}
                  />
                )}
                {(filters.createdPreset || filters.createdFrom) && (
                  <FilterChip
                    label={`Created: ${filters.createdPreset && filters.createdPreset !== 'custom'
                      ? DATE_PRESETS.find((p) => p.value === filters.createdPreset)?.label ?? ''
                      : filters.createdFrom ? formatDateRange(filters.createdFrom, filters.createdTo) : ''
                    }`}
                    onRemove={() => update({ createdPreset: '', createdFrom: '', createdTo: '' })}
                  />
                )}
                {(filters.lastActivityPreset || filters.lastActivityFrom) && (
                  <FilterChip
                    label={`Activity: ${filters.lastActivityPreset && filters.lastActivityPreset !== 'custom'
                      ? DATE_PRESETS.find((p) => p.value === filters.lastActivityPreset)?.label ?? ''
                      : filters.lastActivityFrom ? formatDateRange(filters.lastActivityFrom, filters.lastActivityTo) : ''
                    }`}
                    onRemove={() => update({ lastActivityPreset: '', lastActivityFrom: '', lastActivityTo: '' })}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 pr-1 text-xs font-normal">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

function formatDateRange(from: string, to: string): string {
  try {
    const f = from ? format(new Date(from), 'MMM d') : '?';
    const t = to ? format(new Date(to), 'MMM d') : 'now';
    return `${f} – ${t}`;
  } catch {
    return '';
  }
}

function DatePresetFilter({
  label,
  preset,
  from,
  to,
  onPresetChange,
  onFromChange,
  onToChange,
}: {
  label: string;
  preset: string;
  from: string;
  to: string;
  onPresetChange: (preset: string) => void;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-medium">{label}</Label>
      <Select
        value={preset || 'all'}
        onValueChange={(v) => onPresetChange(v === 'all' ? '' : v)}
      >
        <SelectTrigger className="h-9 text-xs">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <SelectValue placeholder="Any time" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any time</SelectItem>
          {DATE_PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <DatePickerMini
            value={from ? new Date(from) : undefined}
            onChange={(d) => onFromChange(d ? startOfDay(d).toISOString() : '')}
            placeholder="From"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <DatePickerMini
            value={to ? new Date(to) : undefined}
            onChange={(d) => onToChange(d ? endOfDay(d).toISOString() : '')}
            placeholder="To"
          />
        </div>
      )}
    </div>
  );
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
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-8 text-xs justify-start font-normal flex-1',
            !value && 'text-muted-foreground'
          )}
        >
          <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
          {value ? format(value, 'MMM d, yyyy') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          initialFocus
          className="pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
