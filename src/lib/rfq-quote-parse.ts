import type { BidAlternativeSpec, ExtraType } from '@/lib/rfq';

export type ParsedQuoteLine = {
  id: string;
  unit_price: number | null;
  mrp_price: number | null;
  confidence?: 'high' | 'low';
  alternative?: BidAlternativeSpec | null;
};

export type ParsedQuoteExtra = {
  extra_type: ExtraType;
  label: string;
  qty: number;
  unit_price: number;
  mrp_price: number | null;
  confidence?: 'high' | 'low';
};

export type ParsedQuoteFill = {
  currency: string | null;
  quoted_price: number | null;
  mrp_price: number | null;
  shipping_fee: number | null;
  tax_fee: number | null;
  other_fees: number | null;
  lead_time_days: number | null;
  quote_valid_until: string | null;
  notes: string | null;
  line_items: ParsedQuoteLine[];
  extras: ParsedQuoteExtra[];
  source?: 'claude' | 'heuristic';
};

export function fieldFromMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return String(n);
}

/** Compress photos for the parse request; keep the original File for submit. */
export async function fileForParse(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size < 1_200_000) return file;
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82);
  });
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
}
