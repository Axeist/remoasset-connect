import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface CalendarEventInput {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  attendees?: string[];
  timeZone?: string;
}

export interface CalendarEventResult {
  id: string;
  htmlLink: string;
  hangoutLink?: string;
  status: string;
  summary: string;
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string; label?: string }[];
  };
}

/** Full event from GET /events/{id} — includes start, end, attendees */
export interface CalendarEventFull {
  id: string;
  summary?: string;
  description?: string;
  htmlLink?: string;
  hangoutLink?: string;
  status: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email: string }[];
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string; label?: string }[];
  };
}

function getGoogleToken(): string | null {
  return localStorage.getItem('google_access_token');
}

function clearStoredToken() {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_ts');
}

function storeToken(token: string) {
  localStorage.setItem('google_access_token', token);
  localStorage.setItem('google_token_ts', String(Date.now()));
}

async function tryRefreshToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return null;
    const newToken = data.session.provider_token;
    if (newToken) {
      storeToken(newToken);
      return newToken;
    }
    return null;
  } catch {
    return null;
  }
}

async function callGoogleAPI<T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  let res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    const newToken = await tryRefreshToken();
    if (newToken) {
      res = await fetch(url, {
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
    throw new Error(
      err?.error?.message || `Google Calendar API error (${res.status})`
    );
  }

  if (res.status === 204) return {} as T;
  return res.json();
}

export function useGoogleCalendar() {
  const { googleAccessToken } = useAuth();

  const isConnected = Boolean(googleAccessToken || getGoogleToken());

  const getToken = useCallback((): string => {
    const token = googleAccessToken || getGoogleToken();
    if (!token) {
      throw new Error('Google Calendar not connected. Please connect in Settings.');
    }
    return token;
  }, [googleAccessToken]);

  const createEvent = useCallback(
    async (event: CalendarEventInput): Promise<CalendarEventResult> => {
      const token = getToken();
      const tz = event.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

      const body = {
        summary: event.title,
        description: event.description || '',
        start: { dateTime: event.startDateTime, timeZone: tz },
        end: { dateTime: event.endDateTime, timeZone: tz },
        attendees: event.attendees?.filter(Boolean).map((email) => ({ email })) || [],
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 30 },
            { method: 'popup', minutes: 10 },
          ],
        },
      };

      return callGoogleAPI<CalendarEventResult>(
        `${CALENDAR_API}/calendars/primary/events?sendUpdates=all&conferenceDataVersion=1`,
        token,
        { method: 'POST', body: JSON.stringify(body) }
      );
    },
    [getToken]
  );

  const deleteEvent = useCallback(
    async (eventId: string): Promise<void> => {
      const token = getToken();

      await callGoogleAPI<Record<string, never>>(
        `${CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
        token,
        { method: 'DELETE' }
      );
    },
    [getToken]
  );

  const listEvents = useCallback(
    async (timeMin: string, timeMax: string) => {
      const token = getToken();

      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      });

      return callGoogleAPI<{ items: CalendarEventResult[] }>(
        `${CALENDAR_API}/calendars/primary/events?${params}`,
        token
      );
    },
    [getToken]
  );

  const getEvent = useCallback(
    async (eventId: string): Promise<CalendarEventFull> => {
      const token = getToken();
      return callGoogleAPI<CalendarEventFull>(
        `${CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}`,
        token
      );
    },
    [getToken]
  );

  return { isConnected, createEvent, deleteEvent, listEvents, getEvent };
}
