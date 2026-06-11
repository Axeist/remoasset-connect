import { clientRequestSubtitle, clientRequestTitle } from '@/lib/client-request-display';
import { categoryLabel, parseRequestDevices } from '@/lib/device-spec-utils';
import { DEVICE_FIELD_LABELS, type DeviceSpecFieldKey } from '@/constants/device-categories';
import type { Client, ClientRequest, ClientRequestStatus, DeviceSpecValues } from '@/types/procurement';

export type WarehouseStorageState = 'stored' | 'incoming' | 'outbound';

export interface WarehouseDeviceDetail {
  category: string;
  brand: string;
  model: string;
  quantity: number;
  serialNumber: string | null;
  specs: { label: string; value: string }[];
  addons: string[];
  notes: string | null;
}

export interface WarehouseStorageEntry {
  requestId: string;
  clientId: string;
  clientName: string;
  clientCountry: string | null;
  requestType: string;
  title: string;
  subtitle: string | null;
  deviceCount: number;
  deviceSummary: string;
  devices: WarehouseDeviceDetail[];
  warehouseLocation: string | null;
  vendorName: string | null;
  vendorCountry: string | null;
  requestCountry: string | null;
  routeLabel: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  originContact: string | null;
  destinationContact: string | null;
  services: string[];
  direction: 'inbound' | 'outbound';
  storageState: WarehouseStorageState;
  status: ClientRequestStatus;
  warehouseDeliveryDate: string | null;
  expectedDeliveryDate: string | null;
  pickupDate: string | null;
  shippingDate: string | null;
  deliveryDate: string | null;
  notes: string | null;
  createdAt: string;
}

export interface WarehouseClientStorage {
  clientId: string;
  clientName: string;
  clientCountry: string | null;
  storedDevices: number;
  incomingDevices: number;
  outboundDevices: number;
  entries: WarehouseStorageEntry[];
}

const INCOMING_STATUSES: ClientRequestStatus[] = ['pending', 'vendor_allocated', 'ordered', 'in_transit'];
const FULFILLED: ClientRequestStatus = 'fulfilled';

export function isFulfillmentToInventory(req: ClientRequest): boolean {
  return (req.request_type ?? 'fulfillment') === 'fulfillment' && !req.employee_name && !req.employee_phone;
}

export function isRetrievalToInventory(req: ClientRequest): boolean {
  return req.request_type === 'retrieval_redeployment' && req.retrieval_to_type === 'inventory';
}

export function isRetrievalFromInventory(req: ClientRequest): boolean {
  return req.request_type === 'retrieval_redeployment' && req.retrieval_from_type === 'inventory';
}

export function requestDeviceCount(req: ClientRequest): number {
  const devices = parseRequestDevices(req);
  if (devices.length > 0) {
    return devices.reduce((sum, d) => sum + Math.max(1, d.quantity || 1), 0);
  }
  return Math.max(1, req.quantity ?? 1);
}

const SPEC_FIELD_KEYS: DeviceSpecFieldKey[] = [
  'processor', 'display_size', 'ram', 'storage', 'gpu', 'os',
  'color', 'connectivity', 'size_dimensions', 'material', 'spec_description',
];

function buildDeviceDetails(req: ClientRequest): WarehouseDeviceDetail[] {
  const lines = parseRequestDevices(req);
  if (lines.length === 0 && req.device_summary?.trim()) {
    return [{
      category: 'Other',
      brand: req.brand?.trim() || '—',
      model: req.device_model?.trim() || req.device_summary.trim(),
      quantity: Math.max(1, req.quantity ?? 1),
      serialNumber: req.serial_number?.trim() || null,
      specs: [],
      addons: (req.addons ?? []).map((a) => `${a.type}: ${a.model} ×${a.qty}`),
      notes: req.notes?.trim() || null,
    }];
  }

  return lines.map((line) => deviceLineToDetail(line));
}

function deviceLineToDetail(line: DeviceSpecValues): WarehouseDeviceDetail {
  const specs: { label: string; value: string }[] = [];
  for (const key of SPEC_FIELD_KEYS) {
    const val = line[key];
    if (typeof val === 'string' && val.trim()) {
      specs.push({ label: DEVICE_FIELD_LABELS[key].label, value: val.trim() });
    }
  }
  line.custom_fields
    .filter((f) => f.label.trim() && f.value.trim())
    .forEach((f) => specs.push({ label: f.label.trim(), value: f.value.trim() }));

  return {
    category: categoryLabel(line.category),
    brand: line.brand.trim() || '—',
    model: line.device_model.trim() || '—',
    quantity: Math.max(1, line.quantity || 1),
    serialNumber: line.serial_number.trim() || null,
    specs,
    addons: (line.addons ?? []).map((a) => `${a.type}: ${a.model} ×${a.qty}`),
    notes: line.notes?.trim() || null,
  };
}

function deviceSummaryText(req: ClientRequest): string {
  const devices = buildDeviceDetails(req);
  if (devices.length === 0) {
    return req.device_summary?.trim() || '—';
  }
  if (devices.length === 1) {
    const d = devices[0];
    const label = `${d.brand} ${d.model}`.trim();
    return label || req.device_summary?.trim() || '—';
  }
  return `${devices.length} device lines`;
}

function routeLabel(req: ClientRequest): string | null {
  if (req.request_type !== 'retrieval_redeployment') return null;
  const fromKind = req.retrieval_from_type === 'inventory' ? 'Inventory' : (req.origin_poc_name?.trim() || 'Employee');
  const toKind = req.retrieval_to_type === 'inventory' ? 'Inventory' : (req.destination_poc_name?.trim() || 'Employee');
  return `${fromKind} → ${toKind}`;
}

function warehouseServices(req: ClientRequest): string[] {
  const services: string[] = [];
  if (req.qc_required) services.push('Quality check');
  if (req.data_wipe_required) services.push('Data wipe');
  if (req.itad_services?.trim()) services.push('ITAD');
  return services;
}

function formatContact(name?: string | null, phone?: string | null): string | null {
  const n = name?.trim();
  const p = phone?.trim();
  if (n && p) return `${n} · ${p}`;
  return n || p || null;
}

function warehouseLocation(req: ClientRequest, direction: 'inbound' | 'outbound'): string | null {
  if (direction === 'inbound') {
    if (isRetrievalToInventory(req)) {
      return req.to_address?.trim() || req.country?.name || null;
    }
    return req.employee_address?.trim() || req.country?.name || null;
  }
  return req.from_address?.trim() || req.country?.name || null;
}

function classifyInboundStatus(status: ClientRequestStatus): WarehouseStorageState | null {
  if (status === 'cancelled') return null;
  if (status === FULFILLED) return 'stored';
  if (INCOMING_STATUSES.includes(status)) return 'incoming';
  return null;
}

function classifyOutboundStatus(status: ClientRequestStatus): WarehouseStorageState | null {
  if (status === 'cancelled') return null;
  if (status === FULFILLED) return 'outbound';
  if (INCOMING_STATUSES.includes(status)) return 'outbound';
  return null;
}

export function buildWarehouseStorageEntries(
  requests: ClientRequest[],
  clientsById: Map<string, Client>,
): WarehouseStorageEntry[] {
  const entries: WarehouseStorageEntry[] = [];

  for (const req of requests) {
    const client = clientsById.get(req.client_id);
    const clientName = client?.name ?? 'Unknown client';
    const clientCountry = client?.country?.name ?? null;
    const count = requestDeviceCount(req);
    const devices = buildDeviceDetails(req);
    const base = {
      requestId: req.id,
      clientId: req.client_id,
      clientName,
      clientCountry,
      requestType: req.request_type ?? 'fulfillment',
      title: clientRequestTitle(req),
      subtitle: clientRequestSubtitle(req),
      deviceCount: count,
      deviceSummary: deviceSummaryText(req),
      devices,
      vendorName: req.vendor?.company_name ?? null,
      vendorCountry: req.country?.name ?? null,
      requestCountry: req.country?.name ?? req.origin_country?.name ?? null,
      routeLabel: routeLabel(req),
      fromAddress: req.from_address?.trim() || null,
      toAddress: req.to_address?.trim() || null,
      originContact: formatContact(req.origin_poc_name, req.origin_poc_phone),
      destinationContact: formatContact(req.destination_poc_name, req.destination_poc_phone),
      services: warehouseServices(req),
      status: req.status,
      warehouseDeliveryDate: req.warehouse_delivery_date ?? null,
      expectedDeliveryDate: req.expected_delivery_date ?? null,
      pickupDate: req.pickup_date ?? null,
      shippingDate: req.shipping_date ?? null,
      deliveryDate: req.delivery_date ?? null,
      notes: req.notes?.trim() || req.device_summary?.trim() || null,
      createdAt: req.created_at,
    };

    if (isFulfillmentToInventory(req) || isRetrievalToInventory(req)) {
      const storageState = classifyInboundStatus(req.status);
      if (!storageState) continue;
      entries.push({
        ...base,
        warehouseLocation: warehouseLocation(req, 'inbound'),
        direction: 'inbound',
        storageState,
      });
    }

    if (isRetrievalFromInventory(req)) {
      const storageState = classifyOutboundStatus(req.status);
      if (!storageState) continue;
      entries.push({
        ...base,
        warehouseLocation: warehouseLocation(req, 'outbound'),
        direction: 'outbound',
        storageState,
      });
    }
  }

  return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function aggregateWarehouseStorageByClient(entries: WarehouseStorageEntry[]): WarehouseClientStorage[] {
  const map = new Map<string, WarehouseClientStorage>();

  for (const entry of entries) {
    let row = map.get(entry.clientId);
    if (!row) {
      row = {
        clientId: entry.clientId,
        clientName: entry.clientName,
        clientCountry: entry.clientCountry,
        storedDevices: 0,
        incomingDevices: 0,
        outboundDevices: 0,
        entries: [],
      };
      map.set(entry.clientId, row);
    }
    row.entries.push(entry);
    if (entry.direction === 'inbound' && entry.storageState === 'stored') {
      row.storedDevices += entry.deviceCount;
    } else if (entry.direction === 'inbound' && entry.storageState === 'incoming') {
      row.incomingDevices += entry.deviceCount;
    } else if (entry.direction === 'outbound') {
      row.outboundDevices += entry.deviceCount;
    }
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      storedDevices: Math.max(0, row.storedDevices - row.outboundDevices),
    }))
    .filter((row) => row.storedDevices > 0 || row.incomingDevices > 0 || row.outboundDevices > 0)
    .sort((a, b) => b.storedDevices - a.storedDevices || a.clientName.localeCompare(b.clientName));
}

export function warehouseStorageStats(rows: WarehouseClientStorage[]) {
  const storedDevices = rows.reduce((sum, r) => sum + r.storedDevices, 0);
  const incomingDevices = rows.reduce((sum, r) => sum + r.incomingDevices, 0);
  const clients = rows.filter((r) => r.storedDevices > 0).length;
  const locations = new Set(
    rows.flatMap((r) => r.entries.map((e) => e.warehouseLocation).filter(Boolean)),
  ).size;
  return { storedDevices, incomingDevices, clients, locations, clientRows: rows.length };
}
