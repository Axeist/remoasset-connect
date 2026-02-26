import { useCallback } from 'react';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityForSync {
  id: string;
  description?: string | null;
  attachments?: unknown;
  google_calendar_event_id?: string | null;
}

/**
 * Fetches Google Calendar event details for activities that have
 * google_calendar_event_id and updates the activity record with
 * meeting_meta + Meet/Calendar links so the activity log displays them.
 */
export function useSyncGoogleMeetingActivities() {
  const { getEvent, isConnected } = useGoogleCalendar();

  const syncActivities = useCallback(
    async (activities: ActivityForSync[], onComplete?: () => void) => {
      if (!isConnected || !activities.length) {
        onComplete?.();
        return;
      }

      const toSync = activities.filter(
        (a) => a.google_calendar_event_id && typeof a.google_calendar_event_id === 'string'
      );
      if (toSync.length === 0) {
        onComplete?.();
        return;
      }

      for (const a of toSync) {
        const eventId = a.google_calendar_event_id!;
        try {
          const ev = await getEvent(eventId);
          const meetLink =
            ev.hangoutLink ??
            ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
            null;
          const calendarLink = ev.htmlLink ?? null;
          const startTime = ev.start?.dateTime ?? ev.start?.date ?? null;
          const endTime = ev.end?.dateTime ?? ev.end?.date ?? null;
          const attendees = ev.attendees?.map((x) => x.email) ?? [];
          const meetingTitle = ev.summary?.trim() || 'Meeting';

          const meetingMeta = {
            type: 'meeting_meta' as const,
            meetingTitle,
            startTime,
            endTime,
            attendees,
            meetLink,
            calendarLink,
          };

          const calAttachments: { type: string; url: string; name: string }[] = [];
          if (calendarLink) {
            calAttachments.push({ type: 'url', url: calendarLink, name: 'Google Calendar Event' });
          }
          if (meetLink) {
            calAttachments.push({ type: 'url', url: meetLink, name: 'Google Meet Link' });
          }

          const existingAttachments = (a.attachments ?? []) as {
            type: string;
            url: string;
            name?: string;
          }[];
          const withoutMeta = existingAttachments.filter(
            (att) =>
              att.type !== 'meeting_meta' &&
              att.name !== 'Google Meet Link' &&
              att.name !== 'Google Calendar Event'
          );
          const mergedAttachments = [...withoutMeta, ...calAttachments, meetingMeta];

          let description = a.description ?? '';
          if (meetLink && description && !description.includes(meetLink)) {
            description = `${description}\n\nMeet link: ${meetLink}`;
          } else if (meetLink && !description) {
            description = `Meet link: ${meetLink}`;
          }

          await supabase
            .from('lead_activities')
            .update({
              attachments: mergedAttachments,
              ...(description ? { description } : {}),
            })
            .eq('id', a.id);
        } catch {
          // Event may be deleted or API error — skip this activity
        }
      }

      onComplete?.();
    },
    [getEvent, isConnected]
  );

  return { syncActivities, isCalendarConnected: isConnected };
}
