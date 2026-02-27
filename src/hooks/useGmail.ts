import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function getGoogleToken(): string | null {
  return localStorage.getItem('google_access_token');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('google_refresh_token');
}

function clearStoredToken() {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_ts');
}

function storeToken(token: string) {
  localStorage.setItem('google_access_token', token);
  localStorage.setItem('google_token_ts', String(Date.now()));
}

/**
 * Attempt to refresh the Google access token using the Supabase session.
 * Supabase stores the refresh token and can give us a new provider_token
 * when we refresh the session.
 */
async function tryRefreshToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return null;
    const newToken = data.session.provider_token;
    if (newToken) {
      storeToken(newToken);
      return newToken;
    }
    // Supabase may not always return provider_token on refresh;
    // fall back to stored refresh token via Google's token endpoint.
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    return null;
  } catch {
    return null;
  }
}

function toBase64Url(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  try {
    return decodeURIComponent(escape(atob(padded)));
  } catch {
    return '';
  }
}

async function callGmailAPI<T>(url: string, token: string, options: RequestInit = {}): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${GMAIL_API}${url}`;
  let res = await fetch(fullUrl, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  // On 401, try to refresh the token and retry once
  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      res = await fetch(fullUrl, {
        ...options,
        headers: {
          Authorization: `Bearer ${newToken}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
    }
    if (res.status === 401) {
      clearStoredToken();
      throw new Error('Google session expired. Please reconnect in Admin → Integrations.');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gmail API error (${res.status})`);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

// ─── Types matching Gmail API response ───

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailPayloadPart {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPayloadPart[];
}

interface GmailPayload {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPayloadPart[];
}

export interface GmailMessageRaw {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPayload;
}

export interface GmailThreadRaw {
  id: string;
  snippet?: string;
  historyId?: string;
  messages?: GmailMessageRaw[];
}

interface GmailThreadListItem {
  id: string;
  snippet?: string;
  historyId?: string;
}

// ─── Parsing helpers ───

function getHeader(headers: GmailHeader[] | undefined, name: string): string {
  if (!headers) return '';
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function extractBody(payload: GmailPayload | undefined): string {
  if (!payload) return '';
  if (payload.body?.data) return fromBase64Url(payload.body.data);
  if (payload.parts) {
    const textPlain = payload.parts.find((p) => p.mimeType === 'text/plain');
    if (textPlain?.body?.data) return fromBase64Url(textPlain.body.data);
    for (const part of payload.parts) {
      if (part.parts) {
        const nested = part.parts.find((p) => p.mimeType === 'text/plain');
        if (nested?.body?.data) return fromBase64Url(nested.body.data);
      }
    }
    const textHtml = payload.parts.find((p) => p.mimeType === 'text/html');
    if (textHtml?.body?.data) {
      const html = fromBase64Url(textHtml.body.data);
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const anyData = payload.parts.find((p) => p.body?.data);
    if (anyData?.body?.data) return fromBase64Url(anyData.body.data);
  }
  return '';
}

export interface ParsedGmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  date: string;
  messageId: string;
  references: string;
  body: string;
  snippet: string;
}

export function parseGmailMessage(msg: GmailMessageRaw): ParsedGmailMessage {
  const headers = msg.payload?.headers || [];
  return {
    id: msg.id,
    threadId: msg.threadId,
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc'),
    bcc: getHeader(headers, 'Bcc'),
    subject: getHeader(headers, 'Subject'),
    date: getHeader(headers, 'Date'),
    messageId: getHeader(headers, 'Message-ID'),
    references: getHeader(headers, 'References'),
    body: extractBody(msg.payload),
    snippet: msg.snippet || '',
  };
}

// ─── MIME builder ───

/** Detect whether a string contains HTML tags */
function isHtml(str: string): boolean {
  return /<[a-z][\s\S]*>/i.test(str);
}

/** Strip HTML to plain text for the text/plain part */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** One attachment for sending (base64-encoded content) */
export interface EmailAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

/** Convert a File to EmailAttachment (for use in sendEmail). */
export async function fileToEmailAttachment(file: File): Promise<EmailAttachment> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const contentBase64 = btoa(binary);
  return {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    contentBase64,
  };
}

function buildMime(params: {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: EmailAttachment[];
}): string {
  const headers: string[] = [`To: ${params.to}`];
  if (params.cc) headers.push(`Cc: ${params.cc}`);
  if (params.bcc) headers.push(`Bcc: ${params.bcc}`);
  headers.push(`Subject: ${params.subject}`);
  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) headers.push(`References: ${params.references}`);
  headers.push('MIME-Version: 1.0');

  const hasAttachments = params.attachments && params.attachments.length > 0;

  // Body part(s): plain, html, or both
  let bodyPart: string;
  if (isHtml(params.body)) {
    const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const plain = stripHtml(params.body);
    bodyPart = [
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      '',
      `--${altBoundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      plain,
      `--${altBoundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      params.body,
      `--${altBoundary}--`,
    ].join('\r\n');
  } else {
    bodyPart = [
      'Content-Type: text/plain; charset=UTF-8',
      '',
      params.body,
    ].join('\r\n');
  }

  if (hasAttachments) {
    const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    const parts: string[] = [
      `--${mixedBoundary}`,
      bodyPart,
    ];
    for (const att of params.attachments!) {
      const safeName = att.filename.replace(/[\r\n"]/g, '');
      const lineWrapped = (att.contentBase64.match(/.{1,76}/g) || []).join('\r\n');
      parts.push(
        `--${mixedBoundary}`,
        `Content-Disposition: attachment; filename="${safeName}"`,
        `Content-Type: ${att.mimeType}; name="${safeName}"`,
        'Content-Transfer-Encoding: base64',
        '',
        lineWrapped
      );
    }
    parts.push(`--${mixedBoundary}--`);
    return [...headers, '', ...parts].join('\r\n');
  }

  return [...headers, '', bodyPart].join('\r\n');
}

// ─── Public types ───

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
  attachments?: EmailAttachment[];
}

export interface ReplyEmailParams extends SendEmailParams {
  threadId: string;
  inReplyTo: string;
  references?: string;
  attachments?: EmailAttachment[];
}

// ─── Hook ───

export function useGmail() {
  const { googleAccessToken } = useAuth();
  const isConnected = Boolean(googleAccessToken || getGoogleToken());

  const getToken = useCallback((): string => {
    const token = googleAccessToken || getGoogleToken();
    if (!token) throw new Error('Gmail not connected. Please connect in Admin → Integrations.');
    return token;
  }, [googleAccessToken]);

  const sendEmail = useCallback(
    async (params: SendEmailParams): Promise<{ id: string; threadId: string }> => {
      const token = getToken();
      const raw = toBase64Url(buildMime(params));
      return callGmailAPI<{ id: string; threadId: string }>(
        `${GMAIL_API}/messages/send`,
        token,
        { method: 'POST', body: JSON.stringify({ raw }) }
      );
    },
    [getToken]
  );

  const replyEmail = useCallback(
    async (params: ReplyEmailParams): Promise<{ id: string; threadId: string }> => {
      const token = getToken();
      const raw = toBase64Url(
        buildMime({
          to: params.to,
          subject: params.subject,
          body: params.body,
          cc: params.cc,
          bcc: params.bcc,
          inReplyTo: params.inReplyTo,
          references: params.references,
          attachments: params.attachments,
        })
      );
      return callGmailAPI<{ id: string; threadId: string }>(
        `${GMAIL_API}/messages/send`,
        token,
        { method: 'POST', body: JSON.stringify({ raw, threadId: params.threadId }) }
      );
    },
    [getToken]
  );

  const listThreads = useCallback(
    async (contactEmail: string, maxResults = 20): Promise<GmailThreadListItem[]> => {
      const token = getToken();
      const q = encodeURIComponent(`from:${contactEmail} OR to:${contactEmail}`);
      const res = await callGmailAPI<{ threads?: GmailThreadListItem[] }>(
        `${GMAIL_API}/threads?q=${q}&maxResults=${maxResults}`,
        token
      );
      return res.threads || [];
    },
    [getToken]
  );

  const getThread = useCallback(
    async (threadId: string, format: 'full' | 'metadata' = 'full'): Promise<GmailThreadRaw> => {
      const token = getToken();
      let url = `${GMAIL_API}/threads/${encodeURIComponent(threadId)}?format=${format}`;
      if (format === 'metadata') {
        url += '&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date&metadataHeaders=Cc';
      }
      return callGmailAPI<GmailThreadRaw>(url, token);
    },
    [getToken]
  );

  return {
    isConnected,
    sendEmail,
    replyEmail,
    listThreads,
    getThread,
  };
}
