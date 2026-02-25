import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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

function getGoogleToken(): string | null {
  return localStorage.getItem('google_access_token');
}

function clearStoredToken() {
  localStorage.removeItem('google_access_token');
  localStorage.removeItem('google_token_ts');
}

async function callGoogleAPI<T>(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
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
      throw new Error('Google Calendar session expired. Please reconnect in Settings.');
    }
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

  return { isConnected, createEvent, deleteEvent, listEvents };
}
