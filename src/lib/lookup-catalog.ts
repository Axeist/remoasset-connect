import type { DeviceSpecFieldKey } from '@/constants/device-categories';
import {
  BRANDS,
  DISPLAY_SIZES,
  MODELS_BY_BRAND,
  OS_OPTIONS,
  PROCESSORS_BY_BRAND,
  RAM_OPTIONS,
  STORAGE_OPTIONS,
} from '@/constants/device-options';

export const LOOKUP_BRANDS = [...BRANDS];

export const GPU_OPTIONS = [
  'Apple GPU',
  'Intel Arc',
  'AMD Radeon',
  'NVIDIA RTX 4050',
  'NVIDIA RTX 4060',
  'NVIDIA RTX 4070',
  'NVIDIA RTX 4080',
  'Integrated',
];

export const CONNECTIVITY_OPTIONS = [
  'USB-C', 'Thunderbolt 4', 'HDMI', 'DisplayPort', 'Wi-Fi 6E', 'Wi-Fi 7', 'Bluetooth 5.3',
];

export const COLOR_OPTIONS = [
  'Silver', 'Space Gray', 'Space Black', 'Midnight', 'Starlight', 'Black', 'White', 'Blue',
];

export function isAppleBrand(brand: string): boolean {
  return brand.trim().toLowerCase() === 'apple';
}

export function modelsForBrand(brand: string): string[] {
  if (!brand.trim()) return [];
  const exact = MODELS_BY_BRAND[brand];
  if (exact) return exact;
  const key = Object.keys(MODELS_BY_BRAND).find((k) => k.toLowerCase() === brand.toLowerCase());
  return key ? MODELS_BY_BRAND[key] : [];
}

export function processorsForBrand(brand: string): string[] {
  return isAppleBrand(brand)
    ? [...PROCESSORS_BY_BRAND.Apple]
    : [...PROCESSORS_BY_BRAND.Intel, ...PROCESSORS_BY_BRAND.AMD, ...PROCESSORS_BY_BRAND.Qualcomm];
}

export function osForBrand(brand: string): string[] {
  if (isAppleBrand(brand)) return OS_OPTIONS.filter((o) => o.startsWith('macOS'));
  return OS_OPTIONS.filter((o) => !o.startsWith('macOS'));
}

export function gpuForBrand(brand: string): string[] {
  return isAppleBrand(brand) ? ['Apple GPU'] : GPU_OPTIONS.filter((g) => g !== 'Apple GPU');
}

function inchFromModel(model: string): string | null {
  const m = model.match(/(\d{2}(?:\.\d)?)\s*(?:-?inch|")?/i);
  if (!m) return null;
  const n = m[1];
  const listed = DISPLAY_SIZES.find((d) => d.startsWith(n));
  return listed || `${n}-inch`;
}

function isGaming(model: string): boolean {
  return /legion|rog|tuf|predator|nitro|raider|stealth|blade|precision 7|zbook fury|zbook power/i.test(model);
}

export function presetFor(brand: string, model: string): Partial<Record<DeviceSpecFieldKey, string>> {
  const apple = isAppleBrand(brand);
  const display = inchFromModel(model)
    || (apple && /air 15/i.test(model) ? '15.3-inch'
      : apple && /air/i.test(model) ? '13.6-inch'
        : apple && /pro 16/i.test(model) ? '16.2-inch'
          : apple && /pro 14/i.test(model) ? '14.2-inch'
            : '14-inch');

  if (apple) {
    const pro = /pro/i.test(model);
    const air = /air/i.test(model);
    const m5 = /m5/i.test(model);
    const processor = m5
      ? (pro ? 'M5 Pro' : 'M5')
      : pro ? 'M4 Pro' : air ? 'M4' : 'M4';
    return {
      processor,
      display_size: display,
      ram: pro ? '24GB' : '16GB',
      storage: pro ? '512GB SSD' : '256GB SSD',
      os: 'macOS Sequoia',
      gpu: 'Apple GPU',
    };
  }

  const gaming = isGaming(model);
  const surface = /surface/i.test(model);
  return {
    processor: surface
      ? 'Snapdragon X Elite X1E-80-100'
      : gaming
        ? 'Core Ultra 9 185H'
        : 'Core Ultra 7 155H',
    display_size: display,
    ram: gaming ? '32GB' : '16GB',
    storage: gaming ? '1TB SSD' : '512GB SSD',
    os: /chrome/i.test(model) ? 'Chrome OS' : 'Windows 11 Pro',
    gpu: gaming ? 'NVIDIA RTX 4060' : 'Integrated',
  };
}

export function specOptions(
  field: DeviceSpecFieldKey,
  brand: string,
): string[] {
  switch (field) {
    case 'processor': return processorsForBrand(brand);
    case 'display_size': return [...DISPLAY_SIZES];
    case 'ram': return [...RAM_OPTIONS];
    case 'storage': return [...STORAGE_OPTIONS];
    case 'os': return osForBrand(brand);
    case 'gpu': return gpuForBrand(brand);
    case 'connectivity': return CONNECTIVITY_OPTIONS;
    case 'color': return COLOR_OPTIONS;
    default: return [];
  }
}

export function sanitizeSpec(
  field: DeviceSpecFieldKey,
  value: string,
  brand: string,
): string {
  const options = specOptions(field, brand);
  if (!value) return value;
  if (options.length === 0) return value;
  if (options.includes(value)) return value;
  return options[0] || '';
}
