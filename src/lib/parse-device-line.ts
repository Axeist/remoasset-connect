import type { DeviceCategory, DeviceSpecFieldKey } from '@/constants/device-categories';
import { COLOR_OPTIONS, LOOKUP_BRANDS, modelsForBrand, specOptions } from '@/lib/lookup-catalog';

export interface ParsedDeviceLine {
  category: DeviceCategory;
  brand: string;
  model: string;
  specs: Partial<Record<DeviceSpecFieldKey, string>>;
}

const BRANDS_BY_LENGTH = [...LOOKUP_BRANDS].sort((a, b) => b.length - a.length);

function normalizeLine(raw: string): string {
  return raw
    .replace(/\u00a0/g, ' ')
    .replace(/[—–−]/g, ' — ')
    .replace(/[·•|/]+/g, ' · ')
    .replace(/[“”]/g, '"')
    .replace(/[″″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstDeviceLine(raw: string): string {
  return raw
    .split(/\n+/)
    .map((l) => l.trim())
    .find((l) => l.length > 3) || raw.trim();
}

function findBrand(text: string): { brand: string; rest: string } | null {
  const lower = text.toLowerCase();
  for (const brand of BRANDS_BY_LENGTH) {
    const idx = lower.indexOf(brand.toLowerCase());
    if (idx === -1) continue;
    if (idx > 0 && /[a-z0-9]/i.test(text[idx - 1] || '')) continue;
    const after = text.slice(idx + brand.length).replace(/^[\s,:-]+/, '');
    return { brand, rest: after };
  }
  return null;
}

function inferCategory(text: string): DeviceCategory {
  const t = text.toLowerCase();
  if (/monitor|ultrasharp|display|cinema display/i.test(t) && !/macbook|laptop/i.test(t)) return 'monitor';
  if (/imac|mac mini|mac studio|mac pro|optiplex|precision tower|poweredge|thinkcentre|elitedesk/i.test(t)) {
    return 'desktop_server';
  }
  if (/iphone|pixel \d|galaxy s\d/i.test(t)) return 'other';
  if (/ipad|galaxy tab|surface pro|surface go/i.test(t)) return 'other';
  return 'laptop';
}

function extractDisplay(text: string): string | null {
  const m = text.match(/\b(\d{2}(?:\.\d)?)\s*(?:-?inch|''|"|″)?\b/i);
  if (!m) return null;
  return `${m[1]}-inch`;
}

function extractRam(text: string): string | null {
  const m = text.match(/\b(8|12|16|18|24|32|36|48|64|96|128)\s*gb(?:\s*(?:ram|unified|memory))?\b/i);
  return m ? `${m[1]}GB` : null;
}

function extractStorage(text: string): string | null {
  const tb = text.match(/\b([1-8])\s*tb(?:\s*ssd)?\b/i);
  if (tb) return `${tb[1]}TB SSD`;
  const gb = text.match(/\b(128|256|512)\s*gb(?:\s*ssd)?\b/i);
  return gb ? `${gb[1]}GB SSD` : null;
}

function extractProcessor(text: string, brand: string): string | null {
  const apple = text.match(/\b(m[1-5])(?:\s*(pro|max|ultra))?\b/i);
  if (apple) {
    return [apple[1].toUpperCase(), apple[2] ? apple[2][0].toUpperCase() + apple[2].slice(1).toLowerCase() : '']
      .filter(Boolean)
      .join(' ');
  }
  const ultra = text.match(/\b(?:intel\s+)?core\s+ultra\s*([579])(?:\s*(\d{3}\w?))?\b/i);
  if (ultra) return `Intel Core Ultra ${ultra[1]}${ultra[2] ? ` ${ultra[2].toUpperCase()}` : ''}`.replace(/\s+/g, ' ').trim();
  const intel = text.match(/\b(?:intel\s+)?core\s+(i[3579])(?:-(\d+\w+))?\b/i);
  if (intel) return `Intel Core ${intel[1]}${intel[2] ? `-${intel[2]}` : ''}`;
  const ryzen = text.match(/\b(?:amd\s+)?ryzen(?:\s+ai)?\s*([579]|9\s*hx)?[^\u00b7,]{0,20}/i);
  if (ryzen) return ryzen[0].replace(/\s+/g, ' ').trim();
  const snap = text.match(/\bsnapdragon\s+x[^\u00b7,]{0,24}/i);
  if (snap) return snap[0].replace(/\s+/g, ' ').trim();
  if (brand.toLowerCase() === 'apple') return null;
  return null;
}

function extractGpu(text: string, brand: string): string | null {
  if (/rtx\s*40\d0/i.test(text)) {
    const m = text.match(/rtx\s*(40\d0)/i);
    return m ? `NVIDIA RTX ${m[1]}` : 'NVIDIA RTX';
  }
  if (/integrated/i.test(text)) return 'Integrated';
  if (brand.toLowerCase() === 'apple') return 'Apple GPU';
  return null;
}

function extractColor(text: string): string | null {
  const lower = text.toLowerCase();
  const hit = COLOR_OPTIONS.find((c) => lower.includes(c.toLowerCase()));
  return hit || null;
}

function extractOs(text: string, brand: string): string | null {
  if (/windows\s*11\s*pro/i.test(text)) return 'Windows 11 Pro';
  if (/windows/i.test(text)) return 'Windows 11 Pro';
  if (/macos|mac os|sequoia|sonoma|tahoe/i.test(text)) return 'macOS Sequoia';
  if (brand.toLowerCase() === 'apple') return 'macOS Sequoia';
  return null;
}

function productName(rest: string): string {
  const cut = rest.split(/\s+—\s+|\s+·\s+/)[0] || rest;
  return cut.replace(/\s+/g, ' ').trim();
}

function keepSpec(field: DeviceSpecFieldKey, value: string, brand: string): string {
  const options = specOptions(field, brand);
  if (!value) return value;
  if (options.includes(value)) return value;
  const lower = value.toLowerCase();
  const fuzzy = options.find((o) => o.toLowerCase().includes(lower) || lower.includes(o.toLowerCase()));
  return fuzzy || value;
}

function bestCatalogModel(brand: string, name: string, display: string | null): string {
  const models = modelsForBrand(brand);
  if (!models.length) return name;
  const tokens = name.toLowerCase().split(/[^a-z0-9.]+/).filter((t) => t.length > 1);
  const inch = display?.replace(/-inch$/i, '') || null;
  let best = name;
  let bestScore = 0;
  for (const model of models) {
    const m = model.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (m.includes(t)) score += t.length;
    }
    if (inch && m.includes(inch)) score += 8;
    if (score > bestScore) {
      bestScore = score;
      best = model;
    }
  }
  return bestScore >= 6 ? best : name;
}

export function parseDeviceLine(raw: string): ParsedDeviceLine | null {
  const line = firstDeviceLine(raw);
  if (line.length < 4) return null;
  const text = normalizeLine(line);
  const found = findBrand(text);
  if (!found) {
    const words = text.split(/\s+/);
    if (words.length < 2) return null;
    return {
      category: inferCategory(text),
      brand: words[0],
      model: words.slice(1, 4).join(' '),
      specs: {},
    };
  }

  const { brand, rest } = found;
  const blob = `${rest} ${text}`;
  const display = extractDisplay(blob);
  const ram = extractRam(blob);
  const storage = extractStorage(blob);
  const processor = extractProcessor(blob, brand);
  const gpu = extractGpu(blob, brand);
  const color = extractColor(blob);
  const os = extractOs(blob, brand);
  const name = productName(rest) || rest;
  const model = bestCatalogModel(brand, name, display);
  const category = inferCategory(`${brand} ${name}`);

  const specs: Partial<Record<DeviceSpecFieldKey, string>> = {};
  if (processor) specs.processor = keepSpec('processor', processor, brand);
  if (display) specs.display_size = keepSpec('display_size', display, brand);
  if (ram) specs.ram = keepSpec('ram', ram, brand);
  if (storage) specs.storage = keepSpec('storage', storage, brand);
  if (os) specs.os = keepSpec('os', os, brand);
  if (gpu) specs.gpu = keepSpec('gpu', gpu, brand);
  if (color) specs.color = color;

  return { category, brand, model, specs };
}

export function parsedSummary(parsed: ParsedDeviceLine): string {
  const bits = [
    parsed.brand,
    parsed.model,
    parsed.specs.processor,
    parsed.specs.display_size,
    parsed.specs.ram,
    parsed.specs.storage,
    parsed.specs.gpu,
    parsed.specs.color,
  ].filter(Boolean);
  return bits.join(' · ');
}
