export function websiteHost(website: string | null | undefined): string {
  if (!website?.trim()) return '';
  const raw = website.trim();
  try {
    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  }
}

export function normalizeCompanyName(name: string | null | undefined): string {
  if (!name?.trim()) return '';
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(inc|llc|ltd|co|corp|corporation|limited|private|pvt|gmbh|sa|srl)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DuplicateLeadRef {
  id: string;
  company_name: string;
  website?: string | null;
}

export interface DuplicatePair {
  reason: 'website' | 'company';
  key: string;
  a: DuplicateLeadRef;
  b: DuplicateLeadRef;
}

/** Surface pairs only — same website host or normalized company name. */
export function findDuplicatePairs(leads: DuplicateLeadRef[]): DuplicatePair[] {
  const byHost = new Map<string, DuplicateLeadRef[]>();
  const byName = new Map<string, DuplicateLeadRef[]>();
  for (const lead of leads) {
    const host = websiteHost(lead.website);
    if (host) {
      const list = byHost.get(host) ?? [];
      list.push(lead);
      byHost.set(host, list);
    }
    const name = normalizeCompanyName(lead.company_name);
    if (name) {
      const list = byName.get(name) ?? [];
      list.push(lead);
      byName.set(name, list);
    }
  }

  const seen = new Set<string>();
  const pairs: DuplicatePair[] = [];
  const pushGroup = (reason: DuplicatePair['reason'], key: string, group: DuplicateLeadRef[]) => {
    const unique = [...new Map(group.map((l) => [l.id, l])).values()];
    if (unique.length < 2) return;
    for (let i = 0; i < unique.length; i++) {
      for (let j = i + 1; j < unique.length; j++) {
        const a = unique[i];
        const b = unique[j];
        const pairKey = [a.id, b.id].sort().join(':');
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        pairs.push({ reason, key, a, b });
      }
    }
  };

  for (const [key, group] of byHost) pushGroup('website', key, group);
  for (const [key, group] of byName) {
    // Skip name pairs already covered as website pairs for the same two ids
    pushGroup('company', key, group);
  }
  return pairs;
}

export function formatCountDelta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? `+${current}` : '';
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}
