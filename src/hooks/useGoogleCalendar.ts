import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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

export function useGoogleCalendar() {
  const { googleAccessToken } = useAuth();

  const isConnected = Boolean(googleAccessToken);

  const createEvent = useCallback(
    async (event: CalendarEventInput): Promise<CalendarEventResult> => {
      if (!googleAccessToken) {
        throw new Error('Google Calendar not connected. Please connect in Settings.');
      }

      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'create_event',
          accessToken: googleAccessToken,
          eventData: {
            ...event,
            timeZone: event.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data as CalendarEventResult;
    },
    [googleAccessToken]
  );

  const deleteEvent = useCallback(
    async (eventId: string): Promise<void> => {
      if (!googleAccessToken) {
        throw new Error('Google Calendar not connected. Please connect in Settings.');
      }

      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'delete_event',
          accessToken: googleAccessToken,
          eventData: { eventId },
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    [googleAccessToken]
  );

  const listEvents = useCallback(
    async (timeMin: string, timeMax: string) => {
      if (!googleAccessToken) {
        throw new Error('Google Calendar not connected. Please connect in Settings.');
      }

      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'list_events',
          accessToken: googleAccessToken,
          eventData: { timeMin, timeMax },
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      return data;
    },
    [googleAccessToken]
  );

  return { isConnected, createEvent, deleteEvent, listEvents };
}
