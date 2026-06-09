import { getClientRequestTypeMeta } from '@/constants/client-request-types';
import type { ClientRequest, ClientRequestAttachment } from '@/types/procurement';
import { parseRequestDevices } from '@/lib/device-spec-utils';

export function clientRequestTitle(req: ClientRequest): string {
  const type = req.request_type ?? 'fulfillment';
  if (type === 'retrieval_redeployment') {
    return req.device_summary?.trim() || 'Retrieval & redeployment';
  }
  if (type === 'cross_border') {
    const from = req.origin_country?.name ?? 'Origin';
    const to = req.destination_country?.name ?? 'Destination';
    return `Cross-border: ${from} → ${to}`;
  }
  if (type === 'itad') {
    const n = req.quantity ?? 0;
    return `ITAD · ${n} device${n === 1 ? '' : 's'}`;
  }
  const brand = req.brand?.trim() || '';
  const model = req.device_model?.trim() || '';
  const devices = parseRequestDevices(req);
  if (devices.length > 1) {
    const first = devices[0];
    const firstLabel = `${first.brand} ${first.device_model}`.trim();
    return firstLabel ? `${firstLabel} +${devices.length - 1} more` : `${devices.length} devices`;
  }
  return `${brand} ${model}`.trim() || 'Device request';
}

export function clientRequestSubtitle(req: ClientRequest): string | null {
  const type = req.request_type ?? 'fulfillment';
  if (type === 'retrieval_redeployment') {
    const fromKind = req.retrieval_from_type === 'inventory' ? 'Inventory' : (req.origin_poc_name?.trim() || 'Employee');
    const toKind = req.retrieval_to_type === 'inventory' ? 'Inventory' : (req.destination_poc_name?.trim() || 'Employee');
    const services = [req.qc_required && 'QC', req.data_wipe_required && 'Wipe'].filter(Boolean).join(' · ');
    const route = `${fromKind} → ${toKind}`;
    return services ? `${route} · ${services}` : route;
  }
  if (type === 'cross_border') {
    return req.device_summary?.trim() || null;
  }
  if (type === 'itad') {
    return req.itad_services?.trim() ? truncate(req.itad_services, 80) : null;
  }
  return req.device_summary?.trim() || null;
}

export function clientRequestTypeBadgeStyle(type: string | undefined | null) {
  const { color } = getClientRequestTypeMeta(type);
  return {
    backgroundColor: `${color}20`,
    color,
    borderColor: `${color}40`,
  };
}

export function parseAttachments(raw: unknown): ClientRequestAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((a): a is ClientRequestAttachment => {
    if (a == null || typeof a !== 'object') return false;
    const att = a as ClientRequestAttachment;
    return typeof att.url === 'string' || typeof att.path === 'string';
  });
}

function truncate(s: string, max: number) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Supabase select fragment for client_requests with related vendor/country rows. */
export const CLIENT_REQUEST_SELECT = `
  *,
  vendor:leads!vendor_id(company_name),
  country:countries!country_id(name, code),
  origin_country:countries!origin_country_id(name, code),
  destination_country:countries!destination_country_id(name, code)
`;
