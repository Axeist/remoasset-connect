import { describe, expect, it } from 'vitest';
import { fieldFromMoney } from '@/lib/rfq-quote-parse';

describe('fieldFromMoney', () => {
  it('formats finite amounts and blanks the rest', () => {
    expect(fieldFromMoney(12.5)).toBe('12.5');
    expect(fieldFromMoney(0)).toBe('0');
    expect(fieldFromMoney(null)).toBe('');
    expect(fieldFromMoney(undefined)).toBe('');
    expect(fieldFromMoney(Number.NaN)).toBe('');
  });
});
