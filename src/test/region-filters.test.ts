import { describe, it, expect } from 'vitest';
import { REGIONS } from '@/components/leads/LeadsFilters';
import {
  buildCodeToRegion,
  isCountryVisibleInFilters,
  vendorMatchesRegionFilter,
  vendorMatchesRegionFilters,
  visibleCountryCodes,
} from '@/lib/region-filters';

/** Mirrors `countries.region` assignments from migration 20260316100000. */
const FIXTURE_COUNTRIES = [
  { code: 'US', region: 'NA', name: 'United States' },
  { code: 'CA', region: 'NA', name: 'Canada' },
  { code: 'MX', region: 'LATAM', name: 'Mexico' },
  { code: 'IN', region: 'APAC', name: 'India' },
  { code: 'SG', region: 'APAC', name: 'Singapore' },
  { code: 'AU', region: 'ANZ', name: 'Australia' },
  { code: 'NZ', region: 'ANZ', name: 'New Zealand' },
  { code: 'DE', region: 'EU', name: 'Germany' },
  { code: 'UK', region: 'EU', name: 'United Kingdom' },
  { code: 'BR', region: 'LATAM', name: 'Brazil' },
  { code: 'AE', region: 'MENA', name: 'United Arab Emirates' },
  { code: 'EG', region: 'MENA', name: 'Egypt' },
  { code: 'ZA', region: 'Africa', name: 'South Africa' },
  { code: 'KE', region: 'Africa', name: 'Kenya' },
] as const;

const codeToRegion = buildCodeToRegion([...FIXTURE_COUNTRIES]);

const REGION_SAMPLE_CODES: Record<string, string[]> = {
  NA: ['US', 'CA'],
  APAC: ['IN', 'SG'],
  ANZ: ['AU', 'NZ'],
  EU: ['DE', 'UK'],
  LATAM: ['MX', 'BR'],
  MENA: ['AE', 'EG'],
};

describe('region-filters', () => {
  for (const { value: region } of REGIONS) {
    describe(`region ${region}`, () => {
      const inRegion = REGION_SAMPLE_CODES[region] ?? [];
      const outOfRegion = FIXTURE_COUNTRIES.map((c) => c.code).filter(
        (code) => !inRegion.includes(code),
      );

      it('includes only countries assigned to that region in visibility', () => {
        for (const code of inRegion) {
          expect(
            isCountryVisibleInFilters(code, { regionFilters: [region], codeToRegion }),
          ).toBe(true);
        }
      });

      it('excludes countries from other regions', () => {
        for (const code of outOfRegion) {
          expect(
            isCountryVisibleInFilters(code, { regionFilters: [region], codeToRegion }),
          ).toBe(false);
        }
      });

      it('matches vendors that operate in the region', () => {
        expect(vendorMatchesRegionFilter(inRegion, region, codeToRegion)).toBe(true);
        expect(vendorMatchesRegionFilter(outOfRegion, region, codeToRegion)).toBe(false);
      });
    });
  }

  it('multi-region vendor shows only filtered-region countries on map/list', () => {
    const vendorCodes = ['IN', 'ZA', 'BR', 'AE'];
    const visible = visibleCountryCodes(vendorCodes, {
      regionFilters: ['APAC'],
      codeToRegion,
    });
    expect(visible).toEqual(['IN']);
  });

  it('each UI region filter hides cross-region countries for a global vendor', () => {
    const vendorCodes = ['IN', 'ZA', 'BR', 'DE', 'US', 'AU', 'AE'];
    for (const { value: region } of REGIONS) {
      const visible = visibleCountryCodes(vendorCodes, { regionFilters: [region], codeToRegion });
      for (const code of visible) {
        expect(codeToRegion[code]).toBe(region);
      }
      expect(visible.length).toBeGreaterThan(0);
    }
  });

  it('multiselect regions show union of countries on map/list', () => {
    const vendorCodes = ['IN', 'DE', 'US', 'AE'];
    const visible = visibleCountryCodes(vendorCodes, {
      regionFilters: ['APAC', 'EU'],
      codeToRegion,
    });
    expect(visible).toEqual(['IN', 'DE']);
  });

  it('multiselect regions match vendor in any selected region', () => {
    expect(vendorMatchesRegionFilters(['US', 'IN'], ['APAC', 'EU'], codeToRegion)).toBe(true);
    expect(vendorMatchesRegionFilters(['US'], ['APAC', 'EU'], codeToRegion)).toBe(false);
    expect(vendorMatchesRegionFilters(['IN'], ['APAC', 'EU'], codeToRegion)).toBe(true);
  });

  it('country filter accepts UK and GB interchangeably', () => {
    expect(
      isCountryVisibleInFilters('GB', {
        countryFilter: 'UK',
        codeToRegion,
      }),
    ).toBe(true);
  });
});
