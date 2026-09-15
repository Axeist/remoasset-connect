import {
  asMapped,
  cartSpecsFromRfqLines,
  crudePdfText,
  extractJson,
  heuristicMap,
  looksLikePdf,
  MAP_SYSTEM,
  mapUserPrompt,
  sniffImageMedia,
} from '../src/lib/rfq-quote-map';

export const config = {
  api: { bodyParser: { sizeLimit: '4mb' } },
};

const MODEL = 'claude-haiku-4-5-20251001';

function json(res: { status: (n: number) => { json: (b: unknown) => void } }, status: number, body: unknown) {
  return res.status(status).json(body);
}

function readBody(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return {};
}

function decodeFileBytes(fileBase64: string): Buffer {
  const raw = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
  return Buffer.from(raw, 'base64');
}

async function loadRfqCart(token: string) {
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) throw new Error('Supabase env not configured');
  const res = await fetch(`${supabaseUrl}/functions/v1/rfq-campaign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ action: 'get', token }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Invalid or expired link');
  return data;
}

async function claudeMap(content: unknown[], cart: ReturnType<typeof cartSpecsFromRfqLines>, excerptForHeuristic: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    if (excerptForHeuristic.length >= 40) return heuristicMap(excerptForHeuristic, cart);
    throw new Error('Quote reading is not configured on the server.');
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1600,
      temperature: 0,
      system: MAP_SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('Anthropic quote map error', errText.slice(0, 500));
    if (excerptForHeuristic.length >= 40) return heuristicMap(excerptForHeuristic, cart);
    throw new Error('Could not map the quotation. Enter prices below.');
  }
  const payload = await res.json() as { content?: { type: string; text?: string }[] };
  const text = (payload.content || []).map((b) => (b.type === 'text' ? b.text || '' : '')).join('');
  try {
    return asMapped(extractJson(text), cart);
  } catch {
    if (excerptForHeuristic.length >= 40) return heuristicMap(excerptForHeuristic, cart);
    throw new Error('Could not map the quotation. Enter prices below.');
  }
}

export default async function handler(
  req: { method?: string; body?: unknown },
  res: { status: (n: number) => { json: (b: unknown) => void } },
) {
  if (req.method === 'OPTIONS') return json(res, 200, { ok: true });
  if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });

  try {
    const body = readBody(req.body);
    const token = String(body.token || '').trim();
    if (!token) return json(res, 400, { error: 'token required' });
    if (!body.file_base64 || !body.file_name) return json(res, 400, { error: 'Quotation file is required' });

    const rfqData = await loadRfqCart(token);
    const cart = cartSpecsFromRfqLines(rfqData?.rfq?.line_items);
    const fileName = String(body.file_name);
    const contentType = String(body.file_content_type || '');
    const bytes = decodeFileBytes(String(body.file_base64));
    if (bytes.byteLength > 4 * 1024 * 1024) {
      return json(res, 413, { error: 'File is too large to auto-fill (max 4MB). Enter prices below.' });
    }

    const cartJson = JSON.stringify(cart, null, 2);
    const pdf = looksLikePdf(bytes, fileName, contentType);
    let excerpt = pdf ? crudePdfText(bytes) : '';

    if (excerpt.length >= 40) {
      const mapped = await claudeMap(
        [{ type: 'text', text: mapUserPrompt(excerpt.slice(0, 8000), cartJson) }],
        cart,
        excerpt,
      );
      return json(res, 200, mapped);
    }

    if (pdf) {
      const mapped = await claudeMap(
        [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') },
          },
          { type: 'text', text: mapUserPrompt('(see quotation PDF)', cartJson) },
        ],
        cart,
        excerpt,
      );
      return json(res, 200, mapped);
    }

    const media = sniffImageMedia(bytes, fileName, contentType);
    if (media) {
      const mapped = await claudeMap(
        [
          { type: 'image', source: { type: 'base64', media_type: media, data: bytes.toString('base64') } },
          { type: 'text', text: mapUserPrompt('(see quotation image)', cartJson) },
        ],
        cart,
        '',
      );
      return json(res, 200, mapped);
    }

    return json(res, 422, {
      error: 'Could not read this file. Upload a PDF or a JPEG/PNG photo of the quote.',
    });
  } catch (err) {
    console.error('rfq-parse-quotation', err);
    const msg = err instanceof Error ? err.message : String(err);
    return json(res, 422, { error: msg || 'Could not read quotation' });
  }
}
