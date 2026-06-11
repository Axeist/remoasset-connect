import { describe, it, expect } from 'vitest';
import {
  getPresetRange,
  getPreviousPeriodRange,
  formatDateRangeSubtitle,
  DATE_PRESETS,
} from '@/lib/datePresets';

describe('datePresets', () => {
  it('exports all report presets including all_time, last_year, last_quarter', () => {
    const values = DATE_PRESETS.map((p) => p.value);
    expect(values).toContain('all_time');
    expect(values).toContain('last_year');
    expect(values).toContain('last_quarter');
    expect(values).toContain('custom');
  });

  it('all_time returns null bounds', () => {
    const range = getPresetRange('all_time');
    expect(range).toEqual({ from: null, to: null });
  });

  it('this_month filter variant ends at now (MTD)', () => {
    const range = getPresetRange('this_month', 'filter')!;
    expect(range.from).toBeTruthy();
    expect(range.to).toBeTruthy();
    const to = new Date(range.to!);
    const now = new Date();
    expect(to.getDate()).toBe(now.getDate());
  });

  it('this_month calendar variant ends at end of month', () => {
    const range = getPresetRange('this_month', 'calendar')!;
    const to = new Date(range.to!);
    const now = new Date();
    expect(to.getMonth()).toBe(now.getMonth());
    expect(to.getHours()).toBe(23);
  });

  it('last_quarter returns previous calendar quarter', () => {
    const range = getPresetRange('last_quarter')!;
    const from = new Date(range.from!);
    const to = new Date(range.to!);
    expect(from.getTime()).toBeLessThan(to.getTime());
    const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    expect(months).toBeGreaterThanOrEqual(2);
  });

  it('getPreviousPeriodRange returns equal-length prior window', () => {
    const from = '2026-06-01T00:00:00.000Z';
    const to = '2026-06-10T23:59:59.999Z';
    const prev = getPreviousPeriodRange(from, to);
    const days =
      (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
    const prevDays =
      (new Date(prev.to).getTime() - new Date(prev.from).getTime()) / 86400000;
    expect(Math.round(prevDays)).toBe(Math.round(days));
  });

  it('formatDateRangeSubtitle formats same-month range', () => {
    const label = formatDateRangeSubtitle(
      'this_month',
      '2026-06-01T00:00:00.000Z',
      '2026-06-10T23:59:59.999Z',
    );
    expect(label).toMatch(/Jun/);
  });
});
