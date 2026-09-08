export type CookieConsent = {
  necessary: true;
  preferences: boolean;
  analytics: boolean;
  decidedAt: string;
};

export const CONSENT_COOKIE = 'connect_consent';
export const LAST_PATH_COOKIE = 'connect_last_path';
export const ANALYTICS_COOKIE = 'connect_analytics';
export const SIDEBAR_COOKIE_NAME = 'sidebar:state';

export const CONSENT_CHANGED_EVENT = 'connect:consent-changed';
export const OPEN_CONSENT_EVENT = 'connect:open-cookie-banner';

const CONSENT_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const PREF_MAX_AGE = 60 * 60 * 24 * 180; // 180 days
const ANALYTICS_MAX_AGE = 60 * 60 * 24 * 30;

const ALLOWED_PATH_PREFIXES = [
  '/dashboard',
  '/leads',
  '/vendors',
  '/clients',
  '/csm',
  '/rfq',
  '/inbox',
  '/pipeline',
  '/admin',
  '/settings',
  '/reports',
  '/help',
  '/tasks',
  '/follow-ups',
  '/notifications',
  '/mrp-lookup',
  '/developer',
  '/vendor-agent',
];

function readRawCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie.split('; ').find((row) => row.startsWith(prefix));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return match.slice(prefix.length);
  }
}

export function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

export function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0; SameSite=Lax`;
}

export function getConsent(): CookieConsent | null {
  const raw = readRawCookie(CONSENT_COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (typeof parsed.preferences !== 'boolean' || typeof parsed.analytics !== 'boolean') return null;
    return {
      necessary: true,
      preferences: parsed.preferences,
      analytics: parsed.analytics,
      decidedAt: typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function hasDecidedConsent(): boolean {
  return getConsent() !== null;
}

export function hasPreferencesConsent(): boolean {
  return getConsent()?.preferences === true;
}

export function hasAnalyticsConsent(): boolean {
  return getConsent()?.analytics === true;
}

function stripOptionalCookies(consent: CookieConsent) {
  if (!consent.preferences) {
    deleteCookie(LAST_PATH_COOKIE);
    deleteCookie(SIDEBAR_COOKIE_NAME);
    try {
      localStorage.removeItem('sidebar.groups');
      localStorage.removeItem('theme');
    } catch {
      /* ignore */
    }
  }
  if (!consent.analytics) {
    deleteCookie(ANALYTICS_COOKIE);
  }
}

export function saveConsent(partial: { preferences: boolean; analytics: boolean }): CookieConsent {
  const consent: CookieConsent = {
    necessary: true,
    preferences: partial.preferences,
    analytics: partial.analytics,
    decidedAt: new Date().toISOString(),
  };
  setCookie(CONSENT_COOKIE, JSON.stringify(consent), CONSENT_MAX_AGE);
  stripOptionalCookies(consent);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: consent }));
    recordPageVisit(window.location.pathname);
  }
  return consent;
}

export function acceptAllCookies(): CookieConsent {
  return saveConsent({ preferences: true, analytics: true });
}

export function rejectOptionalCookies(): CookieConsent {
  return saveConsent({ preferences: false, analytics: false });
}

export function openCookiePreferences() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_CONSENT_EVENT));
}

function isRememberablePath(pathname: string): boolean {
  if (pathname.startsWith('/rfq/respond')) return false;
  return ALLOWED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function recordPageVisit(pathname: string) {
  if (!isRememberablePath(pathname)) return;

  if (hasPreferencesConsent()) {
    setCookie(LAST_PATH_COOKIE, pathname, PREF_MAX_AGE);
  }

  if (hasAnalyticsConsent()) {
    let visits = 1;
    const existing = readRawCookie(ANALYTICS_COOKIE);
    if (existing) {
      try {
        const parsed = JSON.parse(existing) as { visits?: number };
        if (typeof parsed.visits === 'number' && Number.isFinite(parsed.visits)) {
          visits = parsed.visits + 1;
        }
      } catch {
        visits = 1;
      }
    }
    setCookie(
      ANALYTICS_COOKIE,
      JSON.stringify({
        lastPath: pathname,
        visits,
        lastSeenAt: new Date().toISOString(),
      }),
      ANALYTICS_MAX_AGE,
    );
  }
}

export function getPostLoginPath(): string {
  if (!hasPreferencesConsent()) return '/dashboard';
  const remembered = readRawCookie(LAST_PATH_COOKIE);
  if (remembered && isRememberablePath(remembered)) return remembered;
  return '/dashboard';
}
