/** Country row shape used for region lookups (matches `countries` table). */
export type CountryWithRegion = { code: string; region: string | null; name?: string };

export function normalizeCountryCode(code: string): string {
  return code.trim().toUpperCase();
}

/** UK and GB are stored interchangeably in the DB and on the map. */
export function countryCodesMatch(a: string, b: string): boolean {
  const x = normalizeCountryCode(a);
  const y = normalizeCountryCode(b);
  if (x === y) return true;
  return (x === 'UK' && y === 'GB') || (x === 'GB' && y === 'UK');
}

export function buildCodeToRegion(countries: CountryWithRegion[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  countries.forEach((c) => {
    map[normalizeCountryCode(c.code)] = c.region ?? null;
  });
  return map;
}

export function countryMatchesRegion(
  code: string,
  region: string,
  codeToRegion: Record<string, string | null>,
): boolean {
  return codeToRegion[normalizeCountryCode(code)] === region;
}

export function countryMatchesAnyRegion(
  code: string,
  regionFilters: string[],
  codeToRegion: Record<string, string | null>,
): boolean {
  if (regionFilters.length === 0) return true;
  const region = codeToRegion[normalizeCountryCode(code)];
  return region != null && regionFilters.includes(region);
}

export function countryMatchesAnyCountryFilter(
  code: string,
  countryFilters: string[],
): boolean {
  if (countryFilters.length === 0) return true;
  return countryFilters.some((f) => countryCodesMatch(code, f));
}

export function isCountryVisibleInFilters(
  code: string,
  opts: {
    regionFilters?: string[];
    countryFilters?: string[];
    codeToRegion: Record<string, string | null>;
  },
): boolean {
  const upper = normalizeCountryCode(code);
  const { regionFilters = [], countryFilters = [], codeToRegion } = opts;
  if (regionFilters.length > 0 && !countryMatchesAnyRegion(upper, regionFilters, codeToRegion)) {
    return false;
  }
  if (countryFilters.length > 0 && !countryMatchesAnyCountryFilter(upper, countryFilters)) {
    return false;
  }
  return true;
}

/** Vendor included when they operate in at least one of the selected regions. */
export function vendorMatchesRegionFilters(
  countryCodes: string[],
  regionFilters: string[],
  codeToRegion: Record<string, string | null>,
): boolean {
  if (regionFilters.length === 0) return true;
  return countryCodes.some((code) => countryMatchesAnyRegion(code, regionFilters, codeToRegion));
}

/** @deprecated Use vendorMatchesRegionFilters with a single-element array. */
export function vendorMatchesRegionFilter(
  countryCodes: string[],
  regionFilter: string,
  codeToRegion: Record<string, string | null>,
): boolean {
  return vendorMatchesRegionFilters(countryCodes, [regionFilter], codeToRegion);
}

export function vendorMatchesCountryFilters(
  countryCodes: string[],
  countryFilters: string[],
): boolean {
  if (countryFilters.length === 0) return true;
  return countryCodes.some((code) => countryMatchesAnyCountryFilter(code, countryFilters));
}

/** @deprecated Use vendorMatchesCountryFilters. */
export function vendorMatchesCountryFilter(
  countryCodes: string[],
  countryFilter: string,
): boolean {
  return vendorMatchesCountryFilters(countryCodes, [countryFilter]);
}

export interface CountryRef {
  name: string;
  code: string;
}

/** Operating countries = service countries plus HQ when HQ is not already listed. */
export function mergeVendorCountries(
  countries: CountryRef[] | null | undefined,
  hqCountry: CountryRef | null | undefined,
): CountryRef[] {
  const list = [...(countries ?? [])];
  if (hqCountry?.code) {
    const hq = normalizeCountryCode(hqCountry.code);
    if (!list.some((c) => normalizeCountryCode(c.code) === hq)) {
      list.push(hqCountry);
    }
  }
  return list;
}

/** Country codes to show on map / lists after region (and optional country) filters. */
export function visibleCountryCodes(
  countryCodes: string[],
  opts: {
    regionFilters?: string[];
    countryFilters?: string[];
    codeToRegion: Record<string, string | null>;
  },
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const code of countryCodes) {
    const upper = normalizeCountryCode(code);
    if (!upper || seen.has(upper)) continue;
    if (!isCountryVisibleInFilters(upper, opts)) continue;
    seen.add(upper);
    out.push(upper);
  }
  return out;
}
