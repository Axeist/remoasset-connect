import { supabase } from '@/integrations/supabase/client';
import type { ClientRequestAttachment } from '@/types/procurement';

export function parseMoney(s: string): number | null {
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

export async function fetchAllVendors() {
  const { data } = await supabase.from('leads').select('id, company_name, vendor_types').order('company_name');
  return (data ?? []) as { id: string; company_name: string; vendor_types: string[] | null }[];
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
