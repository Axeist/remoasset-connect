export type CountryRow = { id: string; code: string; name: string; region: string | null };

export const BULK_REGION_PRESETS: { id: string; label: string; description: string }[] = [
  { id: 'apac', label: 'APAC', description: 'Asia-Pacific (DB region)' },
  { id: 'anz', label: 'ANZ', description: 'Australia & New Zealand' },
  { id: 'na', label: 'North America', description: 'US, CA, MX' },
  { id: 'latam', label: 'LATAM', description: 'Latin America & Caribbean' },
  { id: 'europe', label: 'Europe', description: 'EU & affiliates (DB region EU)' },
  { id: 'mena', label: 'MENA', description: 'Middle East & North Africa' },
  { id: 'emea', label: 'EMEA', description: 'Europe + MENA + Africa' },
];

function codesInPreset(presetId: string, c: CountryRow): boolean {
  const code = (c.code || '').toUpperCase();
  const reg = (c.region || '').toUpperCase();
  switch (presetId) {
    case 'apac':
      return reg === 'APAC';
    case 'anz':
      return reg === 'ANZ';
    case 'na':
      return ['US', 'CA', 'MX'].includes(code);
    case 'latam':
      return reg === 'LATAM';
    case 'europe':
      return reg === 'EU';
    case 'mena':
      return reg === 'MENA';
    case 'emea':
      return reg === 'EU' || reg === 'MENA' || reg === 'AFRICA';
    default:
      return false;
  }
}

export function countryIdsInPreset(countries: CountryRow[], presetId: string): string[] {
  return countries.filter((c) => codesInPreset(presetId, c)).map((c) => c.id);
}

/** DB `countries.region` group labels to scroll to when a bulk preset is activated. Order = first match wins. */
export function regionGroupKeysForPreset(presetId: string): string[] {
  switch (presetId) {
    case 'apac':
      return ['APAC'];
    case 'anz':
      return ['ANZ'];
    case 'na':
      return ['NA', 'LATAM'];
    case 'latam':
      return ['LATAM'];
    case 'europe':
      return ['EU'];
    case 'mena':
      return ['MENA'];
    case 'emea':
      return ['EU', 'MENA', 'Africa'];
    default:
      return [];
  }
}

/** Toggle: if every id in preset is already selected, remove them; otherwise add all from preset. */
export function togglePresetSelection(
  selected: Set<string>,
  countries: CountryRow[],
  presetId: string,
): Set<string> {
  const ids = countryIdsInPreset(countries, presetId);
  if (ids.length === 0) return new Set(selected);
  const allIn = ids.every((id) => selected.has(id));
  const next = new Set(selected);
  if (allIn) ids.forEach((id) => next.delete(id));
  else ids.forEach((id) => next.add(id));
  return next;
}
