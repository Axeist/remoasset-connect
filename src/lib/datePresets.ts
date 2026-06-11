import {
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
  endOfYear,
  subYears,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  format,
  differenceInDays,
} from 'date-fns';

export type DatePresetValue =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_3_months'
  | 'this_year'
  | 'last_year'
  | 'last_quarter'
  | 'all_time'
  | 'custom';

/** Presets used by Leads, Pipeline, Client Requests (legacy set). */
export const LEGACY_DATE_PRESETS = [
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

/** Full preset list for reports. */
export const DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'last_year', label: 'Last year' },
  { value: 'last_quarter', label: 'Last quarter' },
  { value: 'all_time', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
] as const;

export type DateRangeResult = { from: string | null; to: string | null };

export type DatePresetVariant = 'filter' | 'calendar';

/**
 * filter   — MTD-style ranges (this_month/week end at now). Used by Leads, Client Requests, Lead Report.
 * calendar — Full calendar periods (this_month/week end at period end). Used by Pipeline.
 */
export function getPresetRange(
  preset: string,
  variant: DatePresetVariant = 'filter',
): DateRangeResult | null {
  if (preset === 'all_time') {
    return { from: null, to: null };
  }
  if (preset === 'custom') {
    return { from: '', to: '' };
  }

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
      if (variant === 'calendar') {
        return {
          from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
          to: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        };
      }
      return {
        from: startOfWeek(today, { weekStartsOn: 1 }).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'last_week': {
      if (variant === 'calendar') {
        const s = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
        return {
          from: s.toISOString(),
          to: endOfWeek(s, { weekStartsOn: 1 }).toISOString(),
        };
      }
      const lw = subWeeks(today, 1);
      return {
        from: startOfWeek(lw, { weekStartsOn: 1 }).toISOString(),
        to: endOfWeek(lw, { weekStartsOn: 1 }).toISOString(),
      };
    }
    case 'this_month':
      if (variant === 'calendar') {
        return {
          from: startOfMonth(now).toISOString(),
          to: endOfMonth(now).toISOString(),
        };
      }
      return {
        from: startOfMonth(today).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'last_month': {
      const lm = subMonths(today, 1);
      return {
        from: startOfMonth(lm).toISOString(),
        to: endOfMonth(lm).toISOString(),
      };
    }
    case 'last_3_months':
      if (variant === 'calendar') {
        return { from: subMonths(now, 3).toISOString(), to: now.toISOString() };
      }
      return {
        from: startOfMonth(subMonths(today, 2)).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'this_year':
      if (variant === 'calendar') {
        return { from: startOfYear(now).toISOString(), to: now.toISOString() };
      }
      return {
        from: startOfYear(today).toISOString(),
        to: endOfDay(now).toISOString(),
      };
    case 'last_year': {
      const ly = subYears(today, 1);
      return {
        from: startOfYear(ly).toISOString(),
        to: endOfYear(ly).toISOString(),
      };
    }
    case 'last_quarter': {
      const lq = subQuarters(today, 1);
      return {
        from: startOfQuarter(lq).toISOString(),
        to: endOfQuarter(lq).toISOString(),
      };
    }
    default:
      return variant === 'calendar' ? null : { from: '', to: '' };
  }
}

export function getPreviousPeriodRange(
  from: string,
  to: string,
): { from: string; to: string } {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days = Math.max(1, differenceInDays(toDate, fromDate) + 1);
  const prevTo = endOfDay(subDays(fromDate, 1));
  const prevFrom = startOfDay(subDays(prevTo, days - 1));
  return { from: prevFrom.toISOString(), to: prevTo.toISOString() };
}

export function formatPresetLabel(preset: string): string {
  const found = DATE_PRESETS.find((p) => p.value === preset)
    ?? LEGACY_DATE_PRESETS.find((p) => p.value === preset);
  return found?.label ?? preset;
}

export function formatDateRangeSubtitle(
  preset: string,
  from: string | null,
  to: string | null,
): string {
  if (preset === 'all_time') return 'All time';
  if (!from || !to) return '';
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const sameYear = fromDate.getFullYear() === toDate.getFullYear();
  const sameMonth = sameYear && fromDate.getMonth() === toDate.getMonth();
  if (sameMonth) {
    return `${format(fromDate, 'MMM d')}–${format(toDate, 'd, yyyy')}`;
  }
  if (sameYear) {
    return `${format(fromDate, 'MMM d')} – ${format(toDate, 'MMM d, yyyy')}`;
  }
  return `${format(fromDate, 'MMM d, yyyy')} – ${format(toDate, 'MMM d, yyyy')}`;
}

export function getReportTitle(preset: string, from: string | null, to: string | null): string {
  const now = new Date();
  if (preset === 'this_month' && from) {
    return `${format(new Date(from), 'MMMM yyyy')} — MTD lead report`;
  }
  if (preset === 'all_time') return 'All time — Lead report';
  if (from && to) {
    return `${formatDateRangeSubtitle(preset, from, to)} — Lead report`;
  }
  return `${format(now, 'MMMM yyyy')} — Lead report`;
}
