import { supabase } from '@/integrations/supabase/client';
import type { ClientRequestAttachment } from '@/types/procurement';

export function parseMoney(s: string): number | null {
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

export type VendorWithCountries = {
  id: string;
  company_name: string;
  country_ids: string[];
  hq_country_id?: string | null;
  vendor_types?: string[] | null;
  warehouse_available?: boolean | null;
};

export const REMOASSET_INVENTORY_LABEL = 'Remoasset Inventory';

export type RetrievalEndpointType = 'employee' | 'inventory';

export async function fetchCountries() {
  const { data } = await supabase.from('countries').select('id, name').order('name');
  return (data ?? []) as { id: string; name: string }[];
}

function mapVendorRow(v: {
  id: string;
  company_name: string;
  vendor_types: string[] | null;
  country_ids: string[] | null;
  hq_country_id: string | null;
  warehouse_available: boolean | null;
}): VendorWithCountries {
  return {
    id: v.id,
    company_name: v.company_name,
    vendor_types: v.vendor_types,
    country_ids: Array.isArray(v.country_ids) ? v.country_ids : [],
    hq_country_id: v.hq_country_id,
    warehouse_available: v.warehouse_available,
  };
}

/** Paginate past the default PostgREST row cap so late-alphabet vendors are included. */
export async function fetchAllVendors() {
  const pageSize = 1000;
  let from = 0;
  const rows: VendorWithCountries[] = [];
  for (;;) {
    const { data, error } = await supabase.from('leads')
      .select('id, company_name, vendor_types, country_ids, hq_country_id, warehouse_available')
      .order('company_name')
      .range(from, from + pageSize - 1);
    if (error || !data?.length) break;
    rows.push(...data.map(mapVendorRow));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export async function fetchVendorsWithCountries(): Promise<VendorWithCountries[]> {
  return fetchAllVendors();
}

/** Vendor operates in country if they serve it or are HQ'd there. */
export function vendorOperatesInCountry(vendor: VendorWithCountries, countryId: string) {
  if (!countryId) return false;
  if (vendor.country_ids.includes(countryId)) return true;
  if (vendor.hq_country_id === countryId) return true;
  return false;
}

export function vendorsForCountry(vendors: VendorWithCountries[], countryId: string) {
  if (!countryId) return [];
  return vendors.filter((v) => vendorOperatesInCountry(v, countryId));
}

/** Keep the assigned vendor visible even when country filter would exclude them. */
export function ensureSelectedVendor(
  list: VendorWithCountries[],
  allVendors: VendorWithCountries[],
  selectedVendorId?: string | null,
  selectedVendorName?: string | null,
): VendorWithCountries[] {
  if (!selectedVendorId || list.some((v) => v.id === selectedVendorId)) {
    return list;
  }
  const existing = allVendors.find((v) => v.id === selectedVendorId);
  const pinned: VendorWithCountries = existing ?? {
    id: selectedVendorId,
    company_name: selectedVendorName ?? 'Selected vendor',
    country_ids: [],
    hq_country_id: null,
  };
  return [...list, pinned].sort((a, b) => a.company_name.localeCompare(b.company_name));
}

/** Vendors for a request's country, always including the current selection. */
export function vendorsForRequestSelect(
  allVendors: VendorWithCountries[],
  countryId: string | null | undefined,
  selectedVendorId?: string | null,
  selectedVendorName?: string | null,
) {
  const filtered = countryId ? vendorsForCountry(allVendors, countryId) : [...allVendors];
  return ensureSelectedVendor(filtered, allVendors, selectedVendorId, selectedVendorName);
}

/** All in-country vendors; warehouse-capable partners sorted to the top. */
export function retrievalVendorsForCountry(vendors: VendorWithCountries[], countryId: string) {
  const inCountry = vendorsForCountry(vendors, countryId);
  return [...inCountry].sort((a, b) => {
    const aWarehouse = isWarehouseVendor(a) ? 0 : 1;
    const bWarehouse = isWarehouseVendor(b) ? 0 : 1;
    if (aWarehouse !== bWarehouse) return aWarehouse - bWarehouse;
    return a.company_name.localeCompare(b.company_name);
  });
}

export function isWarehouseVendor(v: VendorWithCountries) {
  return (Array.isArray(v.vendor_types) && v.vendor_types.includes('warehouse')) || !!v.warehouse_available;
}

export function filterItadVendors(
  vendors: { id: string; company_name: string; vendor_types: string[] | null }[],
) {
  const itad = vendors.filter((v) => Array.isArray(v.vendor_types) && v.vendor_types.includes('itad'));
  return itad.length > 0 ? itad : vendors;
}

export async function uploadClientRequestFiles(
  clientId: string,
  files: File[],
  userId: string,
): Promise<{ attachments: ClientRequestAttachment[] } | { error: string }> {
  const attachments: ClientRequestAttachment[] = [];
  for (const file of files) {
    const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${clientId}/${userId}/${Date.now()}_${safe}`;
    const { data, error } = await supabase.storage
      .from('client-request-documents')
      .upload(path, file, { upsert: false });
    if (error) return { error: error.message };
    attachments.push({ type: 'file', path: data.path, name: file.name });
  }
  return { attachments };
}

/** Placeholder specs so legacy NOT NULL columns are satisfied until migration relaxes them. */
export const SERVICE_SPEC_PLACEHOLDERS = {
  brand: '—',
  device_model: 'Service',
  processor: '—',
  display_size: '—',
  ram: '—',
  storage: '—',
} as const;
