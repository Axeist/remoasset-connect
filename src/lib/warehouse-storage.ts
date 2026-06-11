import { clientRequestTitle } from '@/lib/client-request-display';
import { parseRequestDevices } from '@/lib/device-spec-utils';
import type { Client, ClientRequest, ClientRequestStatus } from '@/types/procurement';

export type WarehouseStorageState = 'stored' | 'incoming' | 'outbound';

export interface WarehouseStorageEntry {
  requestId: string;
  clientId: string;
  clientName: string;
  clientCountry: string | null;
  requestType: string;
  title: string;
  deviceCount: number;
  deviceSummary: string;
  warehouseLocation: string | null;
  vendorName: string | null;
  direction: 'inbound' | 'outbound';
  storageState: WarehouseStorageState;
  status: ClientRequestStatus;
  warehouseDeliveryDate: string | null;
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

function deviceSummaryText(req: ClientRequest): string {
  const devices = parseRequestDevices(req);
  if (devices.length === 0) {
    return req.device_summary?.trim() || '—';
  }
  if (devices.length === 1) {
    const d = devices[0];
    const label = `${d.brand} ${d.device_model}`.trim();
    return label || req.device_summary?.trim() || '—';
  }
  return `${devices.length} device lines`;
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
    const base = {
      requestId: req.id,
      clientId: req.client_id,
      clientName,
      clientCountry,
      requestType: req.request_type ?? 'fulfillment',
      title: clientRequestTitle(req),
      deviceCount: count,
      deviceSummary: deviceSummaryText(req),
      vendorName: req.vendor?.company_name ?? null,
      status: req.status,
      warehouseDeliveryDate: req.warehouse_delivery_date ?? req.delivery_date ?? null,
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
