import type { DeviceCategory } from '@/constants/device-categories';

export interface DeviceAddon {
  type: string;
  model: string;
  qty: number;
}

export interface CustomSpecField {
  label: string;
  value: string;
}

/** One device line on a client request (stored in client_requests.devices JSONB). */
export interface RequestDeviceLine {
  id?: string;
  category: DeviceCategory;
  brand: string;
  device_model: string;
  quantity: number;
  serial_number?: string | null;
  processor?: string | null;
  display_size?: string | null;
  ram?: string | null;
  storage?: string | null;
  gpu?: string | null;
  os?: string | null;
  color?: string | null;
  connectivity?: string | null;
  size_dimensions?: string | null;
  material?: string | null;
  spec_description?: string | null;
  custom_fields?: CustomSpecField[];
  addons?: DeviceAddon[];
  notes?: string | null;
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
  mrp_usd?: number | null;
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
  mrp_usd?: number | null;
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

export type ClientRequestPaymentStatus = 'paid' | 'unpaid';

export type ClientRequestType = 'fulfillment' | 'retrieval_redeployment' | 'cross_border' | 'itad';

export type RetrievalEndpointType = 'employee' | 'inventory';

export interface ClientRequestAttachment {
  type: 'file' | 'url';
  /** Public or signed URL when stored as url */
  url?: string;
  /** Storage path in client-request-documents bucket */
  path?: string;
  name?: string;
}

export interface ClientRequest {
  id: string;
  client_id: string;
  request_type?: ClientRequestType;
  vendor_id: string | null;
  device_pricing_id: string | null;
  country_id: string | null;
  expected_delivery_date: string | null;
  brand: string | null;
  device_model: string | null;
  quantity: number;
  processor: string | null;
  display_size: string | null;
  ram: string | null;
  storage: string | null;
  gpu: string | null;
  os: string | null;
  addons: DeviceAddon[];
  device_summary: string | null;
  employee_name: string | null;
  employee_address: string | null;
  employee_phone: string | null;
  payment_status?: ClientRequestPaymentStatus;
  client_payment_date: string | null;
  vendor_price_usd: number | null;
  service_cost_usd?: number | null;
  client_price_usd: number | null;
  wire_cost_usd: number | null;
  mrp_usd?: number | null;
  shipping_date: string | null;
  delivery_date: string | null;
  serial_number: string | null;
  devices: RequestDeviceLine[];
  status: ClientRequestStatus;
  notes: string | null;
  from_address?: string | null;
  to_address?: string | null;
  retrieval_from_type?: RetrievalEndpointType | null;
  retrieval_to_type?: RetrievalEndpointType | null;
  qc_required?: boolean;
  data_wipe_required?: boolean;
  pickup_date?: string | null;
  warehouse_delivery_date?: string | null;
  receiver_delivery_date?: string | null;
  service_request_date?: string | null;
  origin_country_id?: string | null;
  destination_country_id?: string | null;
  origin_poc_name?: string | null;
  origin_poc_email?: string | null;
  origin_poc_phone?: string | null;
  destination_poc_name?: string | null;
  destination_poc_email?: string | null;
  destination_poc_phone?: string | null;
  itad_services?: string | null;
  attachments?: ClientRequestAttachment[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { company_name: string } | null;
  country?: { name: string; code: string } | null;
  origin_country?: { name: string; code: string } | null;
  destination_country?: { name: string; code: string } | null;
}

export interface ClientRequestInsert {
  client_id: string;
  request_type?: ClientRequestType;
  vendor_id?: string | null;
  device_pricing_id?: string | null;
  country_id?: string | null;
  expected_delivery_date?: string | null;
  brand?: string | null;
  device_model?: string | null;
  quantity?: number;
  processor?: string | null;
  display_size?: string | null;
  ram?: string | null;
  storage?: string | null;
  gpu?: string | null;
  os?: string | null;
  addons?: DeviceAddon[];
  device_summary?: string | null;
  employee_name?: string | null;
  employee_address?: string | null;
  employee_phone?: string | null;
  payment_status?: ClientRequestPaymentStatus;
  client_payment_date?: string | null;
  vendor_price_usd?: number | null;
  service_cost_usd?: number | null;
  client_price_usd?: number | null;
  wire_cost_usd?: number | null;
  mrp_usd?: number | null;
  shipping_date?: string | null;
  delivery_date?: string | null;
  serial_number?: string | null;
  devices?: RequestDeviceLine[];
  status?: ClientRequestStatus;
  notes?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  retrieval_from_type?: RetrievalEndpointType | null;
  retrieval_to_type?: RetrievalEndpointType | null;
  qc_required?: boolean;
  data_wipe_required?: boolean;
  pickup_date?: string | null;
  warehouse_delivery_date?: string | null;
  receiver_delivery_date?: string | null;
  service_request_date?: string | null;
  origin_country_id?: string | null;
  destination_country_id?: string | null;
  origin_poc_name?: string | null;
  origin_poc_email?: string | null;
  origin_poc_phone?: string | null;
  destination_poc_name?: string | null;
  destination_poc_email?: string | null;
  destination_poc_phone?: string | null;
  itad_services?: string | null;
  attachments?: ClientRequestAttachment[];
  created_by?: string | null;
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
  client_box_procurement_charges?: number;
  client_box_custom_printing_charges?: number;
  client_shipping_to_employee?: number;
  client_retrieve_from_employee?: number;
  client_storage_charge?: number;
  client_qc_charges?: number;
  client_repair_upgrade_charges?: number;
  client_redeployment_charges?: number;
  client_grand_total?: number;
  client_sub_box_procurement_charges?: number;
  client_sub_box_custom_printing_charges?: number;
  client_sub_shipping_to_employee?: number;
  client_sub_retrieve_from_employee?: number;
  client_sub_storage_charge?: number;
  client_sub_qc_charges?: number;
  client_sub_repair_upgrade_charges?: number;
  client_sub_redeployment_charges?: number;
  client_sub_grand_total?: number;
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
  client_box_procurement_charges?: number;
  client_box_custom_printing_charges?: number;
  client_shipping_to_employee?: number;
  client_retrieve_from_employee?: number;
  client_storage_charge?: number;
  client_qc_charges?: number;
  client_repair_upgrade_charges?: number;
  client_redeployment_charges?: number;
  client_sub_box_procurement_charges?: number;
  client_sub_box_custom_printing_charges?: number;
  client_sub_shipping_to_employee?: number;
  client_sub_retrieve_from_employee?: number;
  client_sub_storage_charge?: number;
  client_sub_qc_charges?: number;
  client_sub_repair_upgrade_charges?: number;
  client_sub_redeployment_charges?: number;
  currency?: string;
  quote_date?: string | null;
  quote_validity_date?: string | null;
  notes?: string | null;
}
