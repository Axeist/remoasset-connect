import DOMPurify from 'dompurify';

/** Sanitize untrusted HTML (emails, AI output) before rendering it. */
export function sanitizeHtml(html: string | null | undefined): string {
  return DOMPurify.sanitize(html ?? '', {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  });
}

/** Escape text so it can be placed inside HTML safely. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}
