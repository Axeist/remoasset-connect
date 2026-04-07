export interface DeviceAddon {
  type: string;
  model: string;
  qty: number;
}

export interface VendorDevicePricing {
  id: string;
  vendor_id: string;
  country_id: string;
  brand: string;
  device_model: string;
  processor: string;
  display_size: string;
  ram: string;
  storage: string;
  gpu: string | null;
  os: string | null;
  addons: DeviceAddon[];
  price_usd: number;
  quantity: number;
  quote_date: string;
  quote_validity_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { company_name: string } | null;
  country?: { name: string; code: string } | null;
}

export interface VendorDevicePricingInsert {
  vendor_id: string;
  country_id: string;
  brand: string;
  device_model: string;
  processor: string;
  display_size: string;
  ram: string;
  storage: string;
  gpu?: string | null;
  os?: string | null;
  addons?: DeviceAddon[];
  price_usd: number;
  quantity?: number;
  quote_date?: string;
  quote_validity_date?: string | null;
  notes?: string | null;
}

export interface Client {
  id: string;
  name: string;
  country_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  country?: { name: string; code: string } | null;
}

export interface ClientInsert {
  name: string;
  country_id?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  notes?: string | null;
}

export type ClientRequestStatus = 'pending' | 'vendor_allocated' | 'ordered' | 'in_transit' | 'fulfilled' | 'cancelled';

export interface ClientRequest {
  id: string;
  client_id: string;
  vendor_id: string | null;
  device_pricing_id: string | null;
  country_id: string | null;
  expected_delivery_date: string | null;
  brand: string;
  device_model: string;
  quantity: number;
  processor: string;
  display_size: string;
  ram: string;
  storage: string;
  gpu: string | null;
  os: string | null;
  addons: DeviceAddon[];
  vendor_price_usd: number | null;
  client_price_usd: number | null;
  shipping_date: string | null;
  status: ClientRequestStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { company_name: string } | null;
  country?: { name: string; code: string } | null;
}

export interface ClientRequestInsert {
  client_id: string;
  vendor_id?: string | null;
  device_pricing_id?: string | null;
  country_id?: string | null;
  expected_delivery_date?: string | null;
  brand: string;
  device_model: string;
  quantity?: number;
  processor: string;
  display_size: string;
  ram: string;
  storage: string;
  gpu?: string | null;
  os?: string | null;
  addons?: DeviceAddon[];
  vendor_price_usd?: number | null;
  client_price_usd?: number | null;
  shipping_date?: string | null;
  status?: ClientRequestStatus;
  notes?: string | null;
}

export interface WarehouseVendorPricing {
  id: string;
  vendor_id: string;
  country_id: string | null;
  box_procurement_charges: number;
  box_custom_printing_charges: number;
  shipping_to_employee: number;
  retrieve_from_employee: number;
  storage_charge: number;
  qc_charges: number;
  repair_upgrade_charges: number;
  redeployment_charges: number;
  grand_total: number;
  currency: string;
  quote_date: string | null;
  quote_validity_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { company_name: string } | null;
  country?: { name: string; code: string } | null;
}

export interface WarehouseVendorPricingInsert {
  vendor_id: string;
  country_id?: string | null;
  box_procurement_charges?: number;
  box_custom_printing_charges?: number;
  shipping_to_employee?: number;
  retrieve_from_employee?: number;
  storage_charge?: number;
  qc_charges?: number;
  repair_upgrade_charges?: number;
  redeployment_charges?: number;
  currency?: string;
  quote_date?: string | null;
  quote_validity_date?: string | null;
  notes?: string | null;
}
