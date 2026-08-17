import { describe, it, expect } from 'vitest';
import { findDuplicatePairs, normalizeCompanyName, websiteHost, formatCountDelta } from '@/lib/leadDuplicates';
import { explainLeadScore } from '@/lib/leadScore';
import { parseStatusIds } from '@/lib/leadWorkQueue';

describe('lead duplicates', () => {
  it('normalizes company suffixes', () => {
    expect(normalizeCompanyName('Acme Inc.')).toBe('acme');
    expect(normalizeCompanyName('Acme LLC')).toBe('acme');
  });

  it('extracts website host without www', () => {
    expect(websiteHost('https://www.acme.com/about')).toBe('acme.com');
    expect(websiteHost('acme.com')).toBe('acme.com');
  });

  it('pairs matching hosts and names without merging', () => {
    const pairs = findDuplicatePairs([
      { id: '1', company_name: 'Acme Inc', website: 'https://www.acme.com' },
      { id: '2', company_name: 'Other', website: 'https://acme.com/careers' },
      { id: '3', company_name: 'Acme LLC', website: 'https://other.io' },
    ]);
    expect(pairs.some((p) => p.reason === 'website' && p.key === 'acme.com')).toBe(true);
    expect(pairs.some((p) => p.reason === 'company' && p.a.id !== p.b.id)).toBe(true);
  });
});

describe('formatCountDelta', () => {
  it('formats percent change', () => {
    expect(formatCountDelta(12, 10)).toBe('+20%');
    expect(formatCountDelta(5, 0)).toBe('+5');
    expect(formatCountDelta(0, 0)).toBe('');
  });
});

describe('explainLeadScore', () => {
  it('summarizes activity mix', () => {
    const r = explainLeadScore([
      { activity_type: 'call', description: 'Intro call' },
      { activity_type: 'email', description: 'They replied yes' },
    ]);
    expect(r.rawTotal).toBe(6 + 3 + 8);
    expect(r.summary).toMatch(/2 logged activities/);
    expect(r.lines.find((l) => l.type === 'email')?.points).toBe(11);
  });
});

describe('parseStatusIds', () => {
  it('splits comma-separated ids', () => {
    expect(parseStatusIds('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseStatusIds('')).toEqual([]);
  });
});
