import { describe, expect, it } from 'vitest';
import {
  aggregateWarehouseStorageByClient,
  buildWarehouseStorageEntries,
  isFulfillmentToInventory,
  isRetrievalFromInventory,
  isRetrievalToInventory,
  requestDeviceCount,
} from '@/lib/warehouse-storage';
import type { Client, ClientRequest } from '@/types/procurement';

const clientA: Client = {
  id: 'client-a',
  name: 'Acme Corp',
  country_id: null,
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  notes: null,
  created_by: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  country: { name: 'UAE', code: 'AE' },
};

function baseRequest(overrides: Partial<ClientRequest>): ClientRequest {
  return {
    id: 'req-1',
    client_id: 'client-a',
    request_type: 'fulfillment',
    vendor_id: null,
    device_pricing_id: null,
    country_id: null,
    expected_delivery_date: null,
    brand: 'Dell',
    device_model: 'Latitude',
    quantity: 2,
    processor: null,
    display_size: null,
    ram: null,
    storage: null,
    gpu: null,
    os: null,
    addons: [],
    device_summary: null,
    employee_name: null,
    employee_address: 'Dubai warehouse',
    employee_phone: null,
    payment_status: 'unpaid',
    client_payment_date: null,
    vendor_price_usd: null,
    client_price_usd: null,
    wire_cost_usd: null,
    serial_number: null,
    devices: [],
    status: 'fulfilled',
    notes: null,
    created_by: null,
    created_at: '2026-02-01',
    updated_at: '2026-02-01',
    country: { name: 'UAE', code: 'AE' },
    ...overrides,
  };
}

describe('warehouse-storage', () => {
  it('detects fulfillment shipped to inventory', () => {
    expect(isFulfillmentToInventory(baseRequest({ employee_name: null, employee_phone: null }))).toBe(true);
    expect(isFulfillmentToInventory(baseRequest({ employee_name: 'Sam', employee_phone: '123' }))).toBe(false);
  });

  it('detects retrieval inventory endpoints', () => {
    const retrieval = baseRequest({
      request_type: 'retrieval_redeployment',
      retrieval_to_type: 'inventory',
      retrieval_from_type: 'employee',
    });
    expect(isRetrievalToInventory(retrieval)).toBe(true);
    expect(isRetrievalFromInventory(retrieval)).toBe(false);

    const outbound = baseRequest({
      id: 'req-2',
      request_type: 'retrieval_redeployment',
      retrieval_from_type: 'inventory',
      retrieval_to_type: 'employee',
      status: 'fulfilled',
      quantity: 1,
    });
    expect(isRetrievalFromInventory(outbound)).toBe(true);
  });

  it('aggregates stored devices net of outbound retrievals', () => {
    const inbound = baseRequest({ id: 'in-1', quantity: 5, status: 'fulfilled' });
    const outbound = baseRequest({
      id: 'out-1',
      request_type: 'retrieval_redeployment',
      retrieval_from_type: 'inventory',
      retrieval_to_type: 'employee',
      quantity: 2,
      status: 'fulfilled',
      created_at: '2026-03-01',
    });
    const clients = new Map([[clientA.id, clientA]]);
    const entries = buildWarehouseStorageEntries([inbound, outbound], clients);
    const rows = aggregateWarehouseStorageByClient(entries);

    expect(rows).toHaveLength(1);
    expect(rows[0].storedDevices).toBe(3);
    expect(requestDeviceCount(inbound)).toBe(5);
  });
});
