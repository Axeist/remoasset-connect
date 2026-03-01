import { Video, CalendarDays, Clock, Users, ExternalLink, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { safeFormat } from '@/lib/date';

export interface MeetingMeta {
  type: 'meeting_meta';
  meetingTitle: string;
  startTime: string;
  endTime: string;
  attendees: string[];
  meetLink: string | null;
  calendarLink: string | null;
}

interface MeetingActivityCardProps {
  description: string;
  attachments: { type: string; url: string; name?: string }[];
  createdAt: string;
}

/** Extract meeting metadata from attachments for display in activity log */
export function extractMeetingMeta(attachments: { type: string; url: string; name?: string }[]): MeetingMeta | null {
  const meta = attachments.find((a) => a.type === 'meeting_meta');
  if (meta) return meta as unknown as MeetingMeta;
  return null;
}

function extractMeetLink(attachments: { type: string; url: string; name?: string }[]): string | null {
  const meetAtt = attachments.find((a) => a.name === 'Google Meet Link');
  return meetAtt?.url || null;
}

function extractCalendarLink(attachments: { type: string; url: string; name?: string }[]): string | null {
  const calAtt = attachments.find((a) => a.name === 'Google Calendar Event');
  return calAtt?.url || null;
}

function cleanDescription(description: string): string {
  return description.replace(/\n\nMeet link: https?:\/\/\S+/g, '').trim();
}

export function MeetingActivityCard({ description, attachments, createdAt }: MeetingActivityCardProps) {
  const [copied, setCopied] = useState(false);

  const meta = extractMeetingMeta(attachments);
  const meetLink = meta?.meetLink || extractMeetLink(attachments);
  const calendarLink = meta?.calendarLink || extractCalendarLink(attachments);
  const cleanDesc = cleanDescription(description);

  const meetingTitle = meta?.meetingTitle || null;
  const startTime = meta?.startTime || null;
  const endTime = meta?.endTime || null;
  const attendees = meta?.attendees || [];

  const handleCopyLink = async () => {
    if (!meetLink) return;
    await navigator.clipboard.writeText(meetLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isPast = startTime ? new Date(startTime) < new Date() : new Date(createdAt) < new Date();
  const isUpcoming = startTime ? new Date(startTime) > new Date() : false;

  return (
    <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 via-white to-primary/5 dark:from-primary/10 dark:via-card dark:to-primary/5 dark:border-primary/20 overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 dark:bg-primary/20 border-b border-primary/20 dark:border-primary/20">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-primary dark:bg-primary">
          <Video className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-primary dark:text-primary-foreground uppercase tracking-wider">
          Scheduled Meeting
        </span>
        {isUpcoming && (
          <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] font-semibold border-0 px-1.5 py-0">
            Upcoming
          </Badge>
        )}
        {isPast && !isUpcoming && (
          <Badge className="ml-auto bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 text-[10px] font-semibold border-0 px-1.5 py-0">
            Completed
          </Badge>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {/* Meeting title */}
        {meetingTitle && (
          <h4 className="text-sm font-semibold text-foreground leading-tight">
            {meetingTitle}
          </h4>
        )}

        {/* Time info */}
        {startTime && endTime && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>
              {safeFormat(startTime, 'EEE, MMM d · h:mm a')}
              {' – '}
              {safeFormat(endTime, 'h:mm a')}
            </span>
          </div>
        )}

        {/* Description (user notes) */}
        {cleanDesc && (
          <p className="text-xs text-muted-foreground leading-relaxed">{cleanDesc}</p>
        )}

        {/* Attendees */}
        {attendees.length > 0 && (
          <div className="flex items-start gap-2">
            <Users className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {attendees.map((email, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full bg-primary/10 dark:bg-primary/20 px-2 py-0.5 text-[11px] text-primary dark:text-primary ring-1 ring-primary/20 dark:ring-primary/30"
                >
                  {email}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Google Meet button */}
        {meetLink && (
          <div className="flex items-center gap-2 pt-1">
            <a
              href={meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#00897B] hover:bg-[#00796B] text-white text-xs font-medium px-3 py-1.5 shadow-sm transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C6.486 0 2 3.586 2 8c0 2.908 1.898 5.516 5 6.934V22l5.34-4.005C17.697 17.852 22 13.32 22 8c0-4.414-4.486-8-10-8zm4.5 11.005l-2.5-1.5v3L9 15V9l5 2.5v-3l2.5 1.505v1z" />
              </svg>
              Join with Google Meet
            </a>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={handleCopyLink}
            >
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          </div>
        )}

        {/* Calendar link */}
        {calendarLink && (
          <a
            href={calendarLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] text-primary dark:text-primary hover:underline"
          >
            <CalendarDays className="h-3 w-3" />
            View in Google Calendar
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        )}
      </div>
    </div>
  );
}

/** Compact version for side panels and small spaces */
export function MeetingActivityCardCompact({ description, attachments, createdAt }: MeetingActivityCardProps) {
  const meta = extractMeetingMeta(attachments);
  const meetLink = meta?.meetLink || extractMeetLink(attachments);
  const calendarLink = meta?.calendarLink || extractCalendarLink(attachments);
  const cleanDesc = cleanDescription(description);

  const meetingTitle = meta?.meetingTitle || null;
  const startTime = meta?.startTime || null;
  const endTime = meta?.endTime || null;
  const attendees = meta?.attendees || [];

  const isPast = startTime ? new Date(startTime) < new Date() : new Date(createdAt) < new Date();
  const isUpcoming = startTime ? new Date(startTime) > new Date() : false;

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 dark:bg-primary/10 dark:border-primary/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 dark:bg-primary/20 border-b border-primary/20 dark:border-primary/20">
        <Video className="h-3 w-3 text-primary dark:text-primary" />
        <span className="text-[10px] font-semibold text-primary dark:text-primary uppercase tracking-wider">
          Meeting
        </span>
        {isUpcoming && (
          <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[9px] font-medium border-0 px-1 py-0">
            Upcoming
          </Badge>
        )}
        {isPast && !isUpcoming && (
          <Badge className="ml-auto bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 text-[9px] font-medium border-0 px-1 py-0">
            Done
          </Badge>
        )}
      </div>
      <div className="px-2 py-1.5 space-y-1">
        {meetingTitle && (
          <p className="text-xs font-medium text-foreground truncate">{meetingTitle}</p>
        )}
        {startTime && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 text-primary" />
            {safeFormat(startTime, 'MMM d, h:mm a')}
            {endTime && ` – ${safeFormat(endTime, 'h:mm a')}`}
          </p>
        )}
        {cleanDesc && !meetingTitle && (
          <p className="text-[11px] text-muted-foreground truncate">{cleanDesc}</p>
        )}
        {attendees.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {attendees.length} attendee{attendees.length !== 1 ? 's' : ''}
          </p>
        )}
        <div className="flex items-center gap-2 pt-0.5">
          {meetLink && (
            <a
              href={meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded bg-[#00897B] hover:bg-[#00796B] text-white text-[10px] font-medium px-2 py-0.5 transition-colors"
            >
              <Video className="h-2.5 w-2.5" />
              Join Meet
            </a>
          )}
          {calendarLink && (
            <a
              href={calendarLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-primary dark:text-primary hover:underline"
            >
              <CalendarDays className="h-2.5 w-2.5" />
              Calendar
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Check if an activity has meeting data (calendar event was created) */
export function hasMeetingData(attachments: { type: string; url: string; name?: string }[]): boolean {
  return attachments.some(
    (a) => a.type === 'meeting_meta' || a.name === 'Google Meet Link' || a.name === 'Google Calendar Event'
  );
}
