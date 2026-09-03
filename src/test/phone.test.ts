import { describe, it, expect } from 'vitest';
import { normalizePhoneE164, toE164Display, cloudtalkDialHref, digitsOnly } from '@/lib/phone';

describe('normalizePhoneE164', () => {
  it('keeps existing plus numbers as +digits', () => {
    expect(normalizePhoneE164('+1 (415) 555-0100')).toBe('+14155550100');
    expect(normalizePhoneE164('00441234567890')).toBe('+441234567890');
  });

  it('uses HQ country for national numbers', () => {
    expect(normalizePhoneE164('9876543210', 'IN')).toBe('+919876543210');
    expect(normalizePhoneE164('09876543210', 'IN')).toBe('+919876543210');
    expect(normalizePhoneE164('4155550100', 'US')).toBe('+14155550100');
  });

  it('does not invent a country for short local numbers', () => {
    expect(normalizePhoneE164('9876543210')).toBe('9876543210');
  });
});

describe('toE164Display / dial href', () => {
  it('keeps plus visible for the C2C extension', () => {
    expect(toE164Display('+44 20 1234 5678').startsWith('+')).toBe(true);
  });

  it('builds ct+tel deep links', () => {
    expect(cloudtalkDialHref('+14155550100')).toBe('ct+tel:+14155550100');
    expect(cloudtalkDialHref('+14155550100', '+442012345678')).toBe(
      'ct+tel:+14155550100?from=%2B442012345678'
    );
  });

  it('digitsOnly strips formatting', () => {
    expect(digitsOnly('+1-415-555-0100')).toBe('14155550100');
  });
});
