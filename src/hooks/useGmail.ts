import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

function getGoogleToken(): string | null {
  return localStorage.getItem('google_access_token');
}

function clearStoredToken() {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_ts');
}

/** Base64url encode for Gmail raw messages */
function toBase64Url(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Decode base64url (e.g. message body from Gmail API) */
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

async function callGmailAPI<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('http') ? path : `${GMAIL_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      clearStoredToken();
      throw new Error('Gmail session expired. Please reconnect in Settings.');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gmail API error (${res.status})`);
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

/** Build MIME string for a simple text email */
function buildMime(params: {
  to: string;
  subject: string;
  body: string;
  messageId?: string;
  references?: string;
}): string {
  const lines: string[] = [
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    'Content-Type: text/plain; charset=UTF-8',
    'MIME-Version: 1.0',
    '',
    params.body.replace(/\r?\n/g, '\r\n'),
  ];
  if (params.messageId) {
    lines.splice(2, 0, `In-Reply-To: ${params.messageId}`);
    if (params.references) lines.splice(3, 0, `References: ${params.references}`);
  }
  return lines.join('\r\n');
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
}

export interface ReplyEmailParams extends SendEmailParams {
  threadId: string;
  messageId: string;
  references?: string;
}

export interface GmailThread {
  id: string;
  snippet?: string;
  messages?: { id: string }[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: { mimeType?: string; body?: { data?: string }; headers?: { name: string; value: string }[] }[];
  };
}

function getHeader(headers: { name: string; value: string }[] | undefined, name: string): string {
  if (!headers) return '';
  const h = headers.find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h?.value ?? '';
}

function getMessageBody(payload: GmailMessage['payload']): string {
  if (!payload) return '';
  if (payload.body?.data) {
    return fromBase64Url(payload.body.data);
  }
  const textPart = payload.parts?.find(
    (p) => p.mimeType === 'text/plain' || (p.mimeType && p.mimeType.startsWith('text/'))
  );
  if (textPart?.body?.data) return fromBase64Url(textPart.body.data);
  const anyPart = payload.parts?.find((p) => p.body?.data);
  if (anyPart?.body?.data) return fromBase64Url(anyPart.body.data);
  return '';
}

export function useGmail() {
  const { googleAccessToken } = useAuth();

  const isConnected = Boolean(googleAccessToken || getGoogleToken());

  const getToken = useCallback((): string => {
    const token = googleAccessToken || getGoogleToken();
    if (!token) {
      throw new Error('Gmail not connected. Please connect in Settings.');
    }
    return token;
  }, [googleAccessToken]);

  const sendEmail = useCallback(
    async (params: SendEmailParams): Promise<{ id: string; threadId: string }> => {
      const token = getToken();
      const mime = buildMime({ to: params.to, subject: params.subject, body: params.body });
      const raw = toBase64Url(mime);
      const res = await callGmailAPI<{ id: string; threadId: string }>(
        `${GMAIL_API}/messages/send`,
        token,
        { method: 'POST', body: JSON.stringify({ raw }) }
      );
      return res;
    },
    [getToken]
  );

  const replyEmail = useCallback(
    async (params: ReplyEmailParams): Promise<{ id: string; threadId: string }> => {
      const token = getToken();
      const mime = buildMime({
        to: params.to,
        subject: params.subject,
        body: params.body,
        messageId: params.messageId,
        references: params.references,
      });
      const raw = toBase64Url(mime);
      const res = await callGmailAPI<{ id: string; threadId: string }>(
        `${GMAIL_API}/messages/send`,
        token,
        { method: 'POST', body: JSON.stringify({ raw, threadId: params.threadId }) }
      );
      return res;
    },
    [getToken]
  );

  const listThreadsForContact = useCallback(
    async (email: string, maxResults = 20): Promise<GmailThread[]> => {
      const token = getToken();
      const q = encodeURIComponent(`from:${email} OR to:${email}`);
      const res = await callGmailAPI<{ threads?: { id: string; snippet?: string }[] }>(
        `${GMAIL_API}/threads?q=${q}&maxResults=${maxResults}`,
        token
      );
      return (res.threads || []).map((t) => ({ id: t.id, snippet: t.snippet }));
    },
    [getToken]
  );

  const getThread = useCallback(
    async (threadId: string): Promise<GmailThread> => {
      const token = getToken();
      const res = await callGmailAPI<{ id: string; snippet?: string; messages?: { id: string }[] }>(
        `${GMAIL_API}/threads/${encodeURIComponent(threadId)}`,
        token
      );
      return { id: res.id, snippet: res.snippet, messages: res.messages };
    },
    [getToken]
  );

  const getMessage = useCallback(
    async (messageId: string): Promise<GmailMessage> => {
      const token = getToken();
      const res = await callGmailAPI<GmailMessage>(
        `${GMAIL_API}/messages/${encodeURIComponent(messageId)}?format=full`,
        token
      );
      return res;
    },
    [getToken]
  );

  /** Helpers to parse a Gmail message for display */
  const parseMessage = useCallback((msg: GmailMessage) => {
    const headers = msg.payload?.headers || [];
    return {
      from: getHeader(headers, 'From'),
      to: getHeader(headers, 'To'),
      subject: getHeader(headers, 'Subject'),
      date: getHeader(headers, 'Date'),
      messageId: getHeader(headers, 'Message-ID'),
      references: getHeader(headers, 'References'),
      body: getMessageBody(msg.payload),
    };
  }, []);

  return {
    isConnected,
    sendEmail,
    replyEmail,
    listThreadsForContact,
    getThread,
    getMessage,
    parseMessage,
  };
}
