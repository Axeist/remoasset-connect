import { DEVICE_CATEGORIES, DEVICE_CATEGORY_CONFIG, type DeviceCategory } from '@/constants/device-categories';
import type { ClientRequest, CustomSpecField, DeviceSpecValues, RequestDeviceLine } from '@/types/procurement';

export function createEmptyDeviceSpec(category: DeviceCategory = 'laptop'): DeviceSpecValues {
  return {
    id: crypto.randomUUID(),
    category,
    brand: '',
    device_model: '',
    quantity: 1,
    serial_number: '',
    processor: '',
    display_size: '',
    ram: '',
    storage: '',
    gpu: '',
    os: '',
    color: '',
    connectivity: '',
    size_dimensions: '',
    material: '',
    spec_description: '',
    custom_fields: [],
    addons: [],
    notes: '',
  };
}

export function categoryLabel(category: DeviceCategory | string): string {
  return DEVICE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export type CartLineDescription = {
  category: string;
  title: string;
  quantity: number;
  specs: string[];
  addons: string[];
  notes: string | null;
};

export function describeCartLine(v: DeviceSpecValues): CartLineDescription {
  const cfg = DEVICE_CATEGORY_CONFIG[v.category];
  const title = `${v.brand || ''} ${v.device_model || ''}`.trim() || 'Item';
  const specs: string[] = [];
  if (v.serial_number?.trim()) specs.push(`S/N ${v.serial_number.trim()}`);
  for (const key of cfg?.fields ?? []) {
    const val = v[key];
    if (typeof val === 'string' && val.trim()) specs.push(val.trim());
  }
  (v.custom_fields || [])
    .filter((f) => f.label?.trim() && f.value?.trim())
    .forEach((f) => specs.push(`${f.label.trim()}: ${f.value.trim()}`));

  const addons = (v.addons || [])
    .filter((a) => (a.type || a.model || '').trim())
    .map((a) => {
      const label = [a.type, a.model].filter((x) => x?.trim()).join(' — ');
      const q = Number(a.qty) || 1;
      return q > 1 ? `${label} ×${q}` : label;
    });

  return {
    category: categoryLabel(v.category),
    title,
    quantity: Number(v.quantity) || 1,
    specs,
    addons,
    notes: v.notes?.trim() || null,
  };
}

export function buildDeviceLineSummary(v: DeviceSpecValues): string {
  const d = describeCartLine(v);
  const bits = [`${d.category}: ${d.title} ×${d.quantity}`];
  if (d.specs.length) bits.push(d.specs.join(', '));
  if (d.addons.length) bits.push(`Add-ons: ${d.addons.join('; ')}`);
  if (d.notes) bits.push(d.notes);
  return bits.filter(Boolean).join(' · ');
}

export function buildMultiDeviceSummary(devices: DeviceSpecValues[]): string {
  return devices.map((d, i) => `${i + 1}. ${buildDeviceLineSummary(d)}`).filter(Boolean).join('\n');
}

export function buildCartNeedPlain(devices: DeviceSpecValues[], extraNotes?: string): string {
  const blocks = devices.map((v, i) => {
    const d = describeCartLine(v);
    const lines = [`${i + 1}. ${d.category} — ${d.title}  (qty ${d.quantity})`];
    if (d.specs.length) lines.push(`   Specs: ${d.specs.join(', ')}`);
    if (d.addons.length) {
      lines.push('   Add-ons:');
      d.addons.forEach((a) => lines.push(`     • ${a}`));
    }
    if (d.notes) lines.push(`   Notes: ${d.notes}`);
    return lines.join('\n');
  });
  if (extraNotes?.trim()) blocks.push(`Delivery / notes: ${extraNotes.trim()}`);
  return blocks.join('\n\n');
}

export function validateDeviceLine(v: DeviceSpecValues): string | null {
  if (!v.brand.trim()) return 'Brand / manufacturer is required';
  if (!v.device_model.trim()) return 'Product / model name is required';
  if (!v.quantity || v.quantity < 1) return 'Quantity must be at least 1';
  return null;
}

export function validateDeviceLines(devices: DeviceSpecValues[]): string | null {
  if (devices.length === 0) return 'Add at least one device';
  for (let i = 0; i < devices.length; i++) {
    const err = validateDeviceLine(devices[i]);
    if (err) return `Device ${i + 1}: ${err}`;
  }
  return null;
}

/** Map form values to JSON stored on client_requests.devices */
export function deviceSpecToLine(v: DeviceSpecValues): RequestDeviceLine {
  return {
    id: v.id,
    category: v.category,
    brand: v.brand.trim(),
    device_model: v.device_model.trim(),
    quantity: v.quantity,
    serial_number: v.serial_number.trim() || null,
    processor: v.processor.trim() || null,
    display_size: v.display_size.trim() || null,
    ram: v.ram.trim() || null,
    storage: v.storage.trim() || null,
    gpu: v.gpu.trim() || null,
    os: v.os.trim() || null,
    color: v.color.trim() || null,
    connectivity: v.connectivity.trim() || null,
    size_dimensions: v.size_dimensions.trim() || null,
    material: v.material.trim() || null,
    spec_description: v.spec_description.trim() || null,
    custom_fields: v.custom_fields.filter((f) => f.label.trim() || f.value.trim()),
    addons: v.addons
      .filter((a) => a.type.trim() || a.model.trim())
      .map((a) => ({
        id: a.id || crypto.randomUUID(),
        type: a.type.trim(),
        model: a.model.trim(),
        qty: a.qty || 1,
      })),
    notes: v.notes.trim() || null,
  };
}

export function requestDeviceLineToSpec(line: RequestDeviceLine): DeviceSpecValues {
  return {
    id: line.id || crypto.randomUUID(),
    category: line.category ?? 'other',
    brand: line.brand ?? '',
    device_model: line.device_model ?? '',
    quantity: line.quantity ?? 1,
    serial_number: line.serial_number ?? '',
    processor: line.processor ?? '',
    display_size: line.display_size ?? '',
    ram: line.ram ?? '',
    storage: line.storage ?? '',
    gpu: line.gpu ?? '',
    os: line.os ?? '',
    color: line.color ?? '',
    connectivity: line.connectivity ?? '',
    size_dimensions: line.size_dimensions ?? '',
    material: line.material ?? '',
    spec_description: line.spec_description ?? '',
    custom_fields: (line.custom_fields ?? []) as CustomSpecField[],
    addons: line.addons ?? [],
    notes: line.notes ?? '',
  };
}

/** Read devices from request — prefers `devices` JSON, falls back to legacy flat columns. */
export function parseRequestDevices(req: ClientRequest): DeviceSpecValues[] {
  const raw = req.devices;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((d) => requestDeviceLineToSpec(d as RequestDeviceLine));
  }
  if (req.brand && req.device_model) {
    return [
      requestDeviceLineToSpec({
        id: req.id,
        category: inferCategoryFromRequest(req),
        brand: req.brand,
        device_model: req.device_model,
        quantity: req.quantity ?? 1,
        serial_number: req.serial_number,
        processor: req.processor,
        display_size: req.display_size,
        ram: req.ram,
        storage: req.storage,
        gpu: req.gpu,
        os: req.os,
        addons: req.addons ?? [],
        notes: req.notes,
      }),
    ];
  }
  return [];
}

function inferCategoryFromRequest(req: ClientRequest): DeviceCategory {
  if (req.processor || req.ram || req.storage) return 'laptop';
  if (req.display_size && !req.processor) return 'monitor';
  return 'other';
}

/** Primary row fields for list views & legacy columns */
export function flattenPrimaryDevice(devices: DeviceSpecValues[]) {
  const first = devices[0];
  const totalQty = devices.reduce((sum, d) => sum + (d.quantity || 1), 0);
  return {
    brand: first.brand.trim(),
    device_model: first.device_model.trim(),
    quantity: totalQty,
    processor: first.processor.trim() || null,
    display_size: first.display_size.trim() || null,
    ram: first.ram.trim() || null,
    storage: first.storage.trim() || null,
    gpu: first.gpu.trim() || null,
    os: first.os.trim() || null,
    addons: first.addons,
    serial_number: devices.map((d) => d.serial_number.trim()).filter(Boolean).join(', ') || null,
  };
}
