import { countryCodesMatch, vendorMatchesCountryFilters } from '@/lib/region-filters';

export type VendorDocRef = { document_type: string };

export type VendorForFilter = {
  id: string;
  owner_id: string | null;
  vendor_types: string[] | null;
  warehouse_available?: boolean;
};

export function vendorMatchesOwnerFilters(
  vendor: VendorForFilter,
  ownerFilters: string[],
): boolean {
  if (ownerFilters.length === 0) return true;
  if (ownerFilters.includes('__unassigned__') && !vendor.owner_id) return true;
  if (vendor.owner_id && ownerFilters.includes(vendor.owner_id)) return true;
  return false;
}

export function vendorMatchesVendorTypeFilters(
  vendor: VendorForFilter,
  typeFilters: string[],
): boolean {
  if (typeFilters.length === 0) return true;
  const types = vendor.vendor_types ?? [];
  return typeFilters.some((t) => types.includes(t));
}

export function vendorMatchesNdaFilters(
  vendorId: string,
  ndaFilters: string[],
  docsByLead: Record<string, VendorDocRef[]>,
): boolean {
  if (ndaFilters.length === 0) return true;
  const docs = docsByLead[vendorId] ?? [];
  const hasNda = docs.some((d) => d.document_type === 'nda');
  return ndaFilters.some((f) => {
    if (f === 'has_nda') return hasNda;
    if (f === 'no_nda') return !hasNda;
    return false;
  });
}

export function vendorMatchesDocFilters(
  vendorId: string,
  docFilters: string[],
  docsByLead: Record<string, VendorDocRef[]>,
): boolean {
  if (docFilters.length === 0) return true;
  const docs = docsByLead[vendorId] ?? [];
  return docFilters.some((f) => {
    if (f === 'has_pricing') {
      return docs.some((d) => d.document_type === 'pricing' || d.document_type === 'quotation');
    }
    if (f === 'has_docs') return docs.length > 0;
    if (f === 'no_docs') return docs.length === 0;
    return false;
  });
}

export function vendorMatchesWarehouseFilters(
  vendor: VendorForFilter,
  warehouseFilters: string[],
): boolean {
  if (warehouseFilters.length === 0) return true;
  return warehouseFilters.some((f) => {
    if (f === 'yes') return !!vendor.warehouse_available;
    if (f === 'no') return !vendor.warehouse_available;
    return false;
  });
}

export function isCountrySelectedInFilters(
  code: string,
  countryFilters: string[],
): boolean {
  if (countryFilters.length === 0) return false;
  return countryFilters.some((f) => countryCodesMatch(f, code));
}

export { vendorMatchesCountryFilters };
