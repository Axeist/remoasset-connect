import { format } from 'date-fns';

/**
 * Format a date string for display. Returns fallback if the value is missing or invalid.
 * Prevents "RangeError: Invalid time value" when Supabase or import returns bad dates.
 */
export function safeFormat(
  dateStr: string | null | undefined,
  fmt: string,
  fallback = '—'
): string {
  if (dateStr == null || dateStr === '') return fallback;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return fallback;
  return format(d, fmt);
}
