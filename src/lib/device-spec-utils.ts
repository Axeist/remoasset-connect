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

export function buildDeviceLineSummary(v: DeviceSpecValues): string {
  const cfg = DEVICE_CATEGORY_CONFIG[v.category];
  const head = `${categoryLabel(v.category)}: ${v.brand} ${v.device_model}`.trim();
  const parts = [v.quantity > 1 ? `${head} ×${v.quantity}` : head];
  if (v.serial_number.trim()) parts.push(`S/N ${v.serial_number.trim()}`);

  for (const key of cfg?.fields ?? []) {
    const val = v[key];
    if (typeof val === 'string' && val.trim()) parts.push(val.trim());
  }

  v.custom_fields
    .filter((f) => f.label.trim() && f.value.trim())
    .forEach((f) => parts.push(`${f.label.trim()}: ${f.value.trim()}`));

  return parts.filter(Boolean).join(', ');
}

export function buildMultiDeviceSummary(devices: DeviceSpecValues[]): string {
  return devices.map(buildDeviceLineSummary).filter(Boolean).join(' · ');
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
    addons: v.addons,
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
