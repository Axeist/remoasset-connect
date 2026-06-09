import type { ClientRequest } from '@/types/procurement';
import { clientRequestSubtitle, clientRequestTitle } from '@/lib/client-request-display';
import { clientRequestProfitFromRequest } from '@/lib/client-request-pricing';

export interface ClientRequestFiltersState {
  search: string;
  requestType: string;
  status: string;
  payment: string;
  vendorId: string;
  countryId: string;
  vendorAssigned: string;
  profit: string;
  createdPreset: string;
  createdFrom: string;
  createdTo: string;
}

export const EMPTY_CLIENT_REQUEST_FILTERS: ClientRequestFiltersState = {
  search: '',
  requestType: '',
  status: '',
  payment: '',
  vendorId: '',
  countryId: '',
  vendorAssigned: '',
  profit: '',
  createdPreset: '',
  createdFrom: '',
  createdTo: '',
};

export function clientRequestSearchBlob(req: ClientRequest): string {
  return [
    clientRequestTitle(req),
    clientRequestSubtitle(req),
    req.device_summary,
    req.brand,
    req.device_model,
    req.employee_name,
    req.employee_address,
    req.employee_phone,
    req.from_address,
    req.to_address,
    req.origin_poc_name,
    req.destination_poc_name,
    req.itad_services,
    req.notes,
    req.serial_number,
    req.vendor?.company_name,
    req.country?.name,
    req.origin_country?.name,
    req.destination_country?.name,
  ].filter(Boolean).join(' ').toLowerCase();
}

export function requestMatchesCountry(req: ClientRequest, countryId: string) {
  return req.country_id === countryId
    || req.origin_country_id === countryId
    || req.destination_country_id === countryId;
}

export function countActiveClientRequestFilters(filters: ClientRequestFiltersState): number {
  let count = 0;
  if (filters.search.trim()) count++;
  if (filters.requestType) count++;
  if (filters.status) count++;
  if (filters.payment) count++;
  if (filters.vendorId) count++;
  if (filters.countryId) count++;
  if (filters.vendorAssigned) count++;
  if (filters.profit) count++;
  if (filters.createdPreset || filters.createdFrom) count++;
  return count;
}

export function applyClientRequestFilters(
  requests: ClientRequest[],
  filters: ClientRequestFiltersState,
): ClientRequest[] {
  const q = filters.search.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);

  return requests.filter((req) => {
    if (filters.requestType && (req.request_type ?? 'fulfillment') !== filters.requestType) {
      return false;
    }
    if (filters.status && req.status !== filters.status) return false;

    const pay = req.payment_status ?? 'unpaid';
    if (filters.payment && pay !== filters.payment) return false;

    if (filters.vendorId && req.vendor_id !== filters.vendorId) return false;

    if (filters.countryId && !requestMatchesCountry(req, filters.countryId)) return false;

    if (filters.vendorAssigned === 'yes' && !req.vendor_id) return false;
    if (filters.vendorAssigned === 'no' && req.vendor_id) return false;

    if (filters.profit) {
      const p = clientRequestProfitFromRequest(
        req.client_price_usd, req.vendor_price_usd, req.service_cost_usd, req.request_type,
      );
      if (filters.profit === 'positive' && (!p || p.profitAmount <= 0)) return false;
      if (filters.profit === 'negative' && (!p || p.profitAmount >= 0)) return false;
      if (filters.profit === 'unknown' && p !== null) return false;
    }

    if (filters.createdFrom) {
      const created = new Date(req.created_at).getTime();
      if (created < new Date(filters.createdFrom).getTime()) return false;
    }
    if (filters.createdTo) {
      const created = new Date(req.created_at).getTime();
      if (created > new Date(filters.createdTo).getTime()) return false;
    }

    if (words.length > 0) {
      const blob = clientRequestSearchBlob(req);
      if (!words.every((w) => blob.includes(w))) return false;
    }

    return true;
  });
}

export function vendorOptionsFromRequests(requests: ClientRequest[]) {
  const map = new Map<string, string>();
  requests.forEach((r) => {
    if (r.vendor_id && r.vendor?.company_name) {
      map.set(r.vendor_id, r.vendor.company_name);
    }
  });
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function countryOptionsFromRequests(requests: ClientRequest[]) {
  const map = new Map<string, string>();
  const add = (id: string | null | undefined, name: string | undefined) => {
    if (id && name) map.set(id, name);
  };
  requests.forEach((r) => {
    add(r.country_id, r.country?.name);
    add(r.origin_country_id, r.origin_country?.name);
    add(r.destination_country_id, r.destination_country?.name);
  });
  return [...map.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
