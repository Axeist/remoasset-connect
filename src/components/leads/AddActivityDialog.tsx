import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { EmailTagInput } from '@/components/ui/email-tag-input';
import { RichTextEditor, htmlToPlainText } from '@/components/ui/rich-text-editor';
import { useEmailSignatures } from '@/hooks/useEmailSignatures';
import { EmailSignaturesDialog } from '@/components/leads/EmailSignaturesDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getActivityScorePoints } from '@/lib/leadScore';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useGmail, fileToEmailAttachment } from '@/hooks/useGmail';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Plus, Trash2, Link as LinkIcon, Paperclip, Mail, MessageCircle, ShieldCheck, Linkedin, CalendarDays } from 'lucide-react';

export type ActivityType = 'call' | 'email' | 'meeting' | 'note' | 'whatsapp' | 'nda' | 'linkedin';

export type NdaSubActivity = 'nda_sent' | 'nda_received';

export interface ActivityAttachment {
  type: 'url' | 'file';
  url: string;
  name?: string;
}

const ACTIVITY_TYPES: { value: ActivityType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'nda', label: 'NDA' },
  { value: 'note', label: 'Note' },
];

const URL_REGEX = /^https?:\/\/.+/i;
const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 10;

/** Format datetime-local value for display in meeting description */
function formatMeetingDateTime(value: string): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

/** Build stored description for a meeting: event name, time, attendees, then optional notes */
function buildMeetingDescription(
  meetingTitle: string,
  meetingStart: string,
  meetingEnd: string,
  attendees: string[],
  notes: string
): string {
  const defaultTitle = 'Meeting';
  const title = meetingTitle.trim() || defaultTitle;
  const lines: string[] = [`Event: ${title}`];
  if (meetingStart && meetingEnd) {
    lines.push(`When: ${formatMeetingDateTime(meetingStart)} – ${formatMeetingDateTime(meetingEnd)}`);
  }
  if (attendees.length > 0) {
    lines.push(`Attendees: ${attendees.join(', ')}`);
  }
  const block = lines.join('\n');
  const notesTrim = notes.trim();
  return notesTrim ? `${block}\n\nNotes: ${notesTrim}` : block;
}

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  currentLeadScore: number;
  onSuccess: () => void;
  /** Lead email for mailto draft when activity type is email */
  leadEmail?: string | null;
  leadContactName?: string | null;
  leadCompanyName?: string;
  /** Lead phone for WhatsApp quick-open */
  leadPhone?: string | null;
  /** Current status name of the lead for auto-status logic */
  leadStatusName?: string | null;
}

function CcBccFieldsCompact({ cc, onCcChange, bcc, onBccChange }: {
  cc: string; onCcChange: (v: string) => void; bcc: string; onBccChange: (v: string) => void;
}) {
  const [showCc, setShowCc] = useState(!!cc);
  const [showBcc, setShowBcc] = useState(!!bcc);
  return (
    <div className="space-y-1.5">
      {!showCc && !showBcc && (
        <div className="flex gap-2 text-xs">
          <button type="button" className="text-primary hover:underline" onClick={() => setShowCc(true)}>Cc</button>
          <button type="button" className="text-primary hover:underline" onClick={() => setShowBcc(true)}>Bcc</button>
        </div>
      )}
      {showCc && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-7 shrink-0">Cc</span>
          <EmailTagInput value={cc} onChange={onCcChange} placeholder="Add Cc recipients" className="flex-1" />
          {!showBcc && <button type="button" className="text-xs text-primary hover:underline shrink-0" onClick={() => setShowBcc(true)}>Bcc</button>}
        </div>
      )}
      {showBcc && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-7 shrink-0">Bcc</span>
          <EmailTagInput value={bcc} onChange={onBccChange} placeholder="Add Bcc recipients" className="flex-1" />
          {!showCc && <button type="button" className="text-xs text-primary hover:underline shrink-0" onClick={() => setShowCc(true)}>Cc</button>}
        </div>
      )}
    </div>
  );
}

export function AddActivityDialog({
  open,
  onOpenChange,
  leadId,
  currentLeadScore: _currentLeadScore, // score is now updated by DB trigger; kept for API compat
  onSuccess,
  leadEmail,
  leadContactName,
  leadCompanyName,
  leadPhone,
  leadStatusName,
}: AddActivityDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isConnected: isCalendarConnected, createEvent: createCalendarEvent } = useGoogleCalendar();
  const { signatures, add: addSig, update: updateSig, remove: removeSig, refresh: refreshSigs } = useEmailSignatures(user?.id);
  const [signaturesDialogOpen, setSignaturesDialogOpen] = useState(false);
  const { isConnected: isGmailConnected, sendEmail } = useGmail();
  const [type, setType] = useState<ActivityType>('call');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailBcc, setEmailBcc] = useState('');
  const [ndaSubActivity, setNdaSubActivity] = useState<NdaSubActivity>('nda_sent');
  const [ndaFile, setNdaFile] = useState<File | null>(null);
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState('');
  const [linkedinMessage, setLinkedinMessage] = useState('');
  const [description, setDescription] = useState('');
  const [urls, setUrls] = useState<string[]>(['']);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [sendEmailViaGmail, setSendEmailViaGmail] = useState(true);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStart, setMeetingStart] = useState('');
  const [meetingEnd, setMeetingEnd] = useState('');
  const [meetingAttendees, setMeetingAttendees] = useState<string[]>([]);
  const [attendeeInput, setAttendeeInput] = useState('');

  const addUrlRow = () => setUrls((u) => [...u, '']);
  const removeUrlRow = (i: number) => setUrls((u) => u.filter((_, idx) => idx !== i));
  const setUrlAt = (i: number, v: string) =>
    setUrls((u) => {
      const next = [...u];
      next[i] = v;
      return next;
    });

  const validUrls = urls.map((u) => u.trim()).filter((u) => u && URL_REGEX.test(u));
  const hasInvalidUrl = urls.some((u) => u.trim() && !URL_REGEX.test(u.trim()));

  const canDraftEmail = type === 'email' && leadEmail?.trim();
  const gmailComposeUrl = canDraftEmail
    ? (() => {
        const params = new URLSearchParams({
          view: 'cm',
          fs: '1',
          to: leadEmail!.trim(),
          su: leadCompanyName ? `Re: ${leadCompanyName}` : 'Follow-up',
          body: leadContactName?.trim() ? `Hi ${leadContactName.trim()},\n\n` : '',
        });
        return `https://mail.google.com/mail/?${params.toString()}`;
      })()
    : null;

  const whatsappUrl = leadPhone?.trim()
    ? `https://wa.me/${leadPhone.trim().replace(/[^0-9]/g, '')}`
    : null;

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const allowed = selected.filter((f) => f.size <= MAX_FILE_SIZE_MB * 1024 * 1024);
    if (allowed.length < selected.length) {
      toast({ variant: 'destructive', title: 'Some files skipped', description: `Max ${MAX_FILE_SIZE_MB}MB per file.` });
    }
    setFiles((prev) => [...prev, ...allowed].slice(0, MAX_FILES));
    e.target.value = '';
  };

  const removeFile = (index: number) => setFiles((f) => f.filter((_, i) => i !== index));

  const resetForm = () => {
    setType('call');
    setNdaSubActivity('nda_sent');
    setNdaFile(null);
    setLinkedinProfileUrl('');
    setLinkedinMessage('');
    setDescription('');
    setEmailSubject('');
    setEmailCc('');
    setEmailBcc('');
    setUrls(['']);
    setFiles([]);
    setAddToCalendar(false);
    setSendEmailViaGmail(true);
    setMeetingTitle('');
    setMeetingStart('');
    setMeetingEnd('');
    setMeetingAttendees([]);
    setAttendeeInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isNda = type === 'nda';
    const isLinkedin = type === 'linkedin';

    const isMeeting = type === 'meeting';
    const isEmail = type === 'email';
    const isEmailViaGmail = isEmail && isGmailConnected && leadEmail?.trim() && sendEmailViaGmail;
    let effectiveDescription: string;
    if (isNda) {
      effectiveDescription = `${ndaSubActivity === 'nda_sent' ? 'NDA Sent' : 'NDA Received'}${description.trim() ? ': ' + description.trim() : ''}`;
    } else if (isLinkedin) {
      const parts: string[] = [];
      if (linkedinProfileUrl.trim()) parts.push(`Profile: ${linkedinProfileUrl.trim()}`);
      if (linkedinMessage.trim()) parts.push(`Message: ${linkedinMessage.trim()}`);
      if (description.trim()) parts.push(description.trim());
      effectiveDescription = parts.length > 0 ? parts.join(' | ') : 'LinkedIn outreach';
    } else if (isEmail) {
      const subj = emailSubject.trim() || '(No subject)';
      const plainBody = htmlToPlainText(description);
      const bodyPreview = plainBody.slice(0, 200);
      effectiveDescription = bodyPreview
        ? `Email to lead: ${subj}\n\n${bodyPreview}${plainBody.length > 200 ? '…' : ''}`
        : `Email to lead: ${subj}`;
    } else if (isMeeting) {
      const defaultTitle = `Meeting: ${leadCompanyName || 'Lead'}${leadContactName ? ` — ${leadContactName}` : ''}`;
      const title = meetingTitle.trim() || defaultTitle;
      const allAttendees = [...meetingAttendees];
      if (leadEmail?.trim() && !allAttendees.includes(leadEmail.trim())) {
        allAttendees.unshift(leadEmail.trim());
      }
      effectiveDescription = buildMeetingDescription(
        title,
        meetingStart,
        meetingEnd,
        allAttendees,
        description.trim()
      );
    } else {
      effectiveDescription = description.trim();
    }

    if (isMeeting) {
      if (!meetingStart?.trim() || !meetingEnd?.trim()) {
        toast({ variant: 'destructive', title: 'Start and end time required', description: 'Please set the meeting start and end time.' });
        return;
      }
    } else if (isEmail) {
      if (!emailSubject.trim()) {
        toast({ variant: 'destructive', title: 'Subject required', description: 'Please enter an email subject.' });
        return;
      }
      if (!htmlToPlainText(description)) {
        toast({ variant: 'destructive', title: 'Message required', description: 'Please enter the email body.' });
        return;
      }
    } else if (!isNda && !isLinkedin && !description.trim()) {
      toast({ variant: 'destructive', title: 'Description required' });
      return;
    }
    if (isLinkedin && !linkedinProfileUrl.trim()) {
      toast({ variant: 'destructive', title: 'LinkedIn profile URL required' });
      return;
    }
    if (isNda && ndaSubActivity === 'nda_received' && !ndaFile) {
      toast({ variant: 'destructive', title: 'Signed NDA required', description: 'Please upload the signed NDA document.' });
      return;
    }
    if (hasInvalidUrl) {
      toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter valid URLs (e.g. https://...).' });
      return;
    }
    if (!user) return;
    setSubmitting(true);

    // When sending via Gmail, send first then log activity with thread reference
    let gmailResult: { id: string; threadId: string } | null = null;
    if (isEmailViaGmail) {
      try {
        const emailAttachments = files.length > 0
          ? await Promise.all(files.map((f) => fileToEmailAttachment(f)))
          : undefined;
        gmailResult = await sendEmail({
          to: leadEmail!.trim(),
          subject: emailSubject.trim(),
          body: description,
          cc: emailCc.trim() || undefined,
          bcc: emailBcc.trim() || undefined,
          attachments: emailAttachments,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send email';
        toast({ variant: 'destructive', title: 'Email failed', description: message });
        setSubmitting(false);
        return;
      }
    }

    const attachments: ActivityAttachment[] = [];

    // Store Gmail thread reference so we can link back to the thread
    if (gmailResult) {
      attachments.push({
        type: 'url',
        url: `https://mail.google.com/mail/u/0/#inbox/${gmailResult.threadId}`,
        name: 'View in Gmail',
      });
    }

    // Upload NDA file to lead-documents storage and create a lead_documents row
    if (isNda && ndaFile) {
      const ext = ndaFile.name.split('.').pop() ?? '';
      const docPath = `${leadId}/${crypto.randomUUID()}.${ext}`;
      const { error: ndaUploadError } = await supabase.storage
        .from('lead-documents')
        .upload(docPath, ndaFile, { upsert: false });
      if (ndaUploadError) {
        toast({ variant: 'destructive', title: 'NDA upload failed', description: ndaUploadError.message });
        setSubmitting(false);
        return;
      }
      // Save to lead_documents so it appears in the Documents tab
      const { error: docInsertError } = await supabase.from('lead_documents').insert({
        lead_id: leadId,
        document_type: 'nda',
        custom_name: ndaSubActivity === 'nda_sent' ? 'NDA Sent' : 'NDA Received (Signed)',
        file_path: docPath,
        file_name: ndaFile.name,
        file_size: ndaFile.size,
        uploaded_by: user.id,
      });
      if (docInsertError) {
        toast({ variant: 'destructive', title: 'Error saving document', description: docInsertError.message });
        setSubmitting(false);
        return;
      }
      // Also attach to the activity record
      const { data: signedUrlData } = await supabase.storage
        .from('lead-documents')
        .createSignedUrl(docPath, 60 * 60 * 24 * 365);
      if (signedUrlData?.signedUrl) {
        attachments.push({ type: 'file', url: signedUrlData.signedUrl, name: ndaFile.name });
      }
    }

    // Upload regular activity files
    for (const file of files) {
      const path = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { data, error } = await supabase.storage.from('activity-files').upload(path, file, { upsert: false });
      if (error) {
        toast({ variant: 'destructive', title: 'Upload failed', description: error.message });
        setSubmitting(false);
        return;
      }
      const { data: urlData } = supabase.storage.from('activity-files').getPublicUrl(data.path);
      attachments.push({ type: 'file', url: urlData.publicUrl, name: file.name });
    }

    validUrls.forEach((url) => attachments.push({ type: 'url', url }));

    // Attach LinkedIn profile URL if present
    if (isLinkedin && linkedinProfileUrl.trim()) {
      attachments.push({ type: 'url', url: linkedinProfileUrl.trim(), name: 'LinkedIn Profile' });
    }

    const { data: activityRow, error } = await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: type,
      description: effectiveDescription,
      attachments: attachments.length ? attachments : [],
    }).select('id').single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setSubmitting(false);
      return;
    }

    if (type === 'meeting' && addToCalendar && meetingStart && meetingEnd && isCalendarConnected) {
      try {
        const defaultTitle = `Meeting: ${leadCompanyName || 'Lead'}${leadContactName ? ` — ${leadContactName}` : ''}`;
        const resolvedTitle = meetingTitle.trim() || defaultTitle;
        const allAttendees = [...meetingAttendees];
        if (leadEmail?.trim() && !allAttendees.includes(leadEmail.trim())) {
          allAttendees.unshift(leadEmail.trim());
        }

        const calEvent = await createCalendarEvent({
          title: resolvedTitle,
          description: effectiveDescription,
          startDateTime: new Date(meetingStart).toISOString(),
          endDateTime: new Date(meetingEnd).toISOString(),
          attendees: allAttendees,
        });

        if (calEvent?.id && activityRow?.id) {
          const meetLink = calEvent.hangoutLink
            || calEvent.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri
            || null;

          const calAttachments: { type: string; url: string; name: string }[] = [];
          if (calEvent.htmlLink) {
            calAttachments.push({ type: 'url', url: calEvent.htmlLink, name: 'Google Calendar Event' });
          }
          if (meetLink) {
            calAttachments.push({ type: 'url', url: meetLink, name: 'Google Meet Link' });
          }

          const meetingMeta = {
            type: 'meeting_meta' as const,
            meetingTitle: resolvedTitle,
            startTime: new Date(meetingStart).toISOString(),
            endTime: new Date(meetingEnd).toISOString(),
            attendees: allAttendees,
            meetLink,
            calendarLink: calEvent.htmlLink || null,
          };

          const existingAttachments = attachments.length ? attachments : [];
          const mergedAttachments = [...existingAttachments, ...calAttachments, meetingMeta];

          await supabase
            .from('lead_activities')
            .update({
              google_calendar_event_id: calEvent.id,
              attachments: mergedAttachments,
              description: meetLink
                ? `${effectiveDescription}\n\nMeet link: ${meetLink}`
                : effectiveDescription,
            })
            .eq('id', activityRow.id);
        }
      } catch (calError: unknown) {
        const message = calError instanceof Error ? calError.message : 'Unknown error';
        toast({ variant: 'destructive', title: 'Calendar sync failed', description: message });
      }
    }

    // Auto-move lead to "Closed Won" when NDA Received with document
    const WON_PATTERNS = ['won', 'closed won', 'closed-won'];
    const isAlreadyWon = WON_PATTERNS.includes(leadStatusName?.toLowerCase() ?? '');
    if (isNda && ndaSubActivity === 'nda_received' && ndaFile && !isAlreadyWon) {
      const { data: wonStatuses } = await supabase
        .from('lead_statuses')
        .select('id, name')
        .ilike('name', '%won%')
        .limit(1);
      const wonStatus = wonStatuses?.[0];

      if (wonStatus) {
        await supabase.from('leads').update({ status_id: wonStatus.id }).eq('id', leadId);
        await supabase.from('lead_activities').insert({
          lead_id: leadId,
          user_id: user.id,
          activity_type: 'note',
          description: `Lead automatically moved to "${wonStatus.name}" — signed NDA received`,
        });
      }
    }

    const points = getActivityScorePoints(type, effectiveDescription);

    resetForm();
    setSubmitting(false);
    onOpenChange(false);

    const ndaAutoWon = isNda && ndaSubActivity === 'nda_received' && ndaFile && !isAlreadyWon;
    toast({
      title: ndaAutoWon
        ? 'NDA Received — Lead marked as Closed Won!'
        : isEmailViaGmail
          ? 'Email sent & activity logged'
          : 'Activity added',
      description: ndaAutoWon
        ? 'Lead status changed to Closed Won automatically.'
        : isEmailViaGmail
          ? `Sent to ${leadEmail}`
          : (points > 0 ? `Lead score +${points}` : undefined),
    });
    onSuccess();
  };

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add activity</DialogTitle>
          <DialogDescription>
            Log a call, email, meeting, NDA, or note. Add links and attach files.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {type === 'email' && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                To: <span className="font-medium text-foreground">{leadEmail || '—'}</span>
              </p>
              {canDraftEmail && isGmailConnected && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 pb-1">
                    <Checkbox
                      id="send-via-gmail"
                      checked={sendEmailViaGmail}
                      onCheckedChange={(checked) => setSendEmailViaGmail(checked === true)}
                    />
                    <label htmlFor="send-via-gmail" className="text-sm font-medium cursor-pointer">
                      Send via Gmail
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sendEmailViaGmail
                      ? 'Click "Add activity" below to send this email via Gmail and log it to the lead.'
                      : 'Unchecked: the email will only be logged as an activity (not sent).'}
                  </p>
                  <div className="space-y-1">
                    <Label className="text-xs">Subject</Label>
                    <Input
                      type="text"
                      placeholder={leadCompanyName ? `Re: ${leadCompanyName}` : 'Subject'}
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <CcBccFieldsCompact cc={emailCc} onCcChange={setEmailCc} bcc={emailBcc} onBccChange={setEmailBcc} />
                </div>
              )}
              {canDraftEmail && !isGmailConnected && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => window.open(gmailComposeUrl!, '_blank')}
                >
                  <Mail className="h-4 w-4" />
                  Compose email
                </Button>
              )}
              {!canDraftEmail && (
                <p className="text-sm text-muted-foreground">
                  Add the lead&apos;s email in the lead details to send from here or open Gmail.
                </p>
              )}
            </div>
          )}

          {type === 'whatsapp' && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
              {whatsappUrl ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Phone: <span className="font-medium text-foreground">{leadPhone}</span>
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2 border-green-500/40 text-green-700 hover:bg-green-50"
                    onClick={() => window.open(whatsappUrl, '_blank')}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Open WhatsApp chat
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add the lead&apos;s phone number in the lead details to quickly open WhatsApp from here.
                </p>
              )}
            </div>
          )}

          {type === 'meeting' && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
                Meeting details are saved in the activity and shown in the log. Add notes below if needed.
              </p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Event name</Label>
                  <Input
                    type="text"
                    placeholder={`Meeting: ${leadCompanyName || 'Lead'}${leadContactName ? ` — ${leadContactName}` : ''}`}
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Start *</Label>
                    <Input
                      type="datetime-local"
                      value={meetingStart}
                      onChange={(e) => {
                        setMeetingStart(e.target.value);
                        if (!meetingEnd && e.target.value) {
                          const end = new Date(e.target.value);
                          end.setMinutes(end.getMinutes() + 30);
                          const pad = (n: number) => String(n).padStart(2, '0');
                          setMeetingEnd(`${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`);
                        }
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">End *</Label>
                    <Input
                      type="datetime-local"
                      value={meetingEnd}
                      onChange={(e) => setMeetingEnd(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Attendees</Label>
                  {leadEmail?.trim() && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs font-normal gap-1 py-0.5">
                        <Mail className="h-3 w-3" />
                        {leadEmail} (lead)
                      </Badge>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {meetingAttendees.map((email, i) => (
                      <Badge key={i} variant="outline" className="text-xs gap-1 pr-1 py-0.5">
                        {email}
                        <button
                          type="button"
                          className="ml-0.5 hover:bg-muted rounded p-0.5"
                          onClick={() => setMeetingAttendees((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="Add attendee email..."
                      value={attendeeInput}
                      onChange={(e) => setAttendeeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const email = attendeeInput.trim();
                          if (email && email.includes('@') && !meetingAttendees.includes(email)) {
                            setMeetingAttendees((prev) => [...prev, email]);
                            setAttendeeInput('');
                          }
                        }
                      }}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5"
                      onClick={() => {
                        const email = attendeeInput.trim();
                        if (email && email.includes('@') && !meetingAttendees.includes(email)) {
                          setMeetingAttendees((prev) => [...prev, email]);
                          setAttendeeInput('');
                        }
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {isCalendarConnected && addToCalendar && (
                    <p className="text-xs text-muted-foreground">
                      Press Enter or click + to add. All attendees receive a Google Calendar invite.
                    </p>
                  )}
                </div>
              </div>
              {isCalendarConnected && (
                <div className="flex items-center gap-2 pt-1 border-t border-blue-200/50 dark:border-blue-800/30">
                  <Checkbox
                    id="add-to-calendar"
                    checked={addToCalendar}
                    onCheckedChange={(checked) => setAddToCalendar(checked === true)}
                  />
                  <label htmlFor="add-to-calendar" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    Add to Google Calendar & send invite
                  </label>
                </div>
              )}
            </div>
          )}

          {type === 'linkedin' && (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-sky-700">
                <Linkedin className="h-4 w-4" />
                LinkedIn Outreach
              </div>

              <div className="space-y-2">
                <Label className="text-sm">LinkedIn profile URL *</Label>
                <Input
                  type="url"
                  placeholder="https://linkedin.com/in/..."
                  value={linkedinProfileUrl}
                  onChange={(e) => setLinkedinProfileUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Message sent</Label>
                <Textarea
                  value={linkedinMessage}
                  onChange={(e) => setLinkedinMessage(e.target.value)}
                  placeholder="Paste or describe the LinkedIn message you sent..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {linkedinProfileUrl.trim() && /^https?:\/\/.+/i.test(linkedinProfileUrl.trim()) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 border-sky-500/40 text-sky-700 hover:bg-sky-50"
                  onClick={() => window.open(linkedinProfileUrl.trim(), '_blank')}
                >
                  <Linkedin className="h-4 w-4" />
                  Open LinkedIn profile
                </Button>
              )}
            </div>
          )}

          {type === 'nda' && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                <ShieldCheck className="h-4 w-4" />
                NDA Activity
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Sub-activity *</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={ndaSubActivity === 'nda_sent' ? 'default' : 'outline'}
                    className={ndaSubActivity === 'nda_sent' ? 'gap-1.5' : 'gap-1.5 text-muted-foreground'}
                    onClick={() => { setNdaSubActivity('nda_sent'); setNdaFile(null); }}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    NDA Sent
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={ndaSubActivity === 'nda_received' ? 'default' : 'outline'}
                    className={ndaSubActivity === 'nda_received' ? 'gap-1.5' : 'gap-1.5 text-muted-foreground'}
                    onClick={() => setNdaSubActivity('nda_received')}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    NDA Received
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ndaSubActivity === 'nda_sent'
                    ? 'NDA has been sent to the lead for signing.'
                    : 'Signed NDA has been received back from the lead. Deal can be closed.'}
                </p>
              </div>

              {ndaSubActivity === 'nda_received' && (
                <div className="space-y-2">
                  <Label className="text-sm">Upload signed NDA *</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setNdaFile(e.target.files?.[0] ?? null)}
                    className="h-10 file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground"
                  />
                  {ndaFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[240px]">{ndaFile.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setNdaFile(null)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This file will also appear in the lead&apos;s Documents section. PDF, DOC, or DOCX.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="desc">
              {type === 'nda' || type === 'linkedin'
                ? 'Additional notes (optional)'
                : type === 'meeting'
                  ? 'Notes (optional)'
                  : type === 'email' && isGmailConnected && leadEmail?.trim()
                    ? 'Message *'
                    : 'Description *'}
            </Label>
            {type === 'email' && isGmailConnected && leadEmail?.trim() ? (
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Write your email message..."
                minHeight="180px"
                signatures={signatures}
                onManageSignatures={() => setSignaturesDialogOpen(true)}
              />
            ) : (
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  type === 'linkedin'
                    ? 'Any additional context about this outreach...'
                    : type === 'meeting'
                      ? 'e.g. Agenda, follow-up items, key takeaways...'
                      : 'e.g. Had a call with customer willing to proceed...'
                }
                rows={3}
                className="resize-none"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <LinkIcon className="h-4 w-4" />
              Links (email threads, docs, etc.)
            </Label>
            {urls.map((url, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => setUrlAt(i, e.target.value)}
                  className="flex-1"
                />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeUrlRow(i)} disabled={urls.length <= 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addUrlRow} className="gap-1">
              <Plus className="h-4 w-4" />
              Add URL
            </Button>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Paperclip className="h-4 w-4" />
              Attach files
            </Label>
            <div className="flex flex-wrap gap-2">
            <Input
              type="file"
              multiple
              onChange={onFileChange}
              className="max-w-[200px]"
            />
            {files.length > 0 && (
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-1">
                    <span className="truncate max-w-[180px]">{f.name}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeFile(i)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            </div>
            <p className="text-xs text-muted-foreground">Up to {MAX_FILES} files, {MAX_FILE_SIZE_MB}MB each. All file types allowed.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                submitting || (
                  type === 'nda' ? (ndaSubActivity === 'nda_received' && !ndaFile) :
                  type === 'linkedin' ? !linkedinProfileUrl.trim() :
                  !description.trim()
                )
              }
              className="gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {type === 'nda' ? `Log ${ndaSubActivity === 'nda_sent' ? 'NDA Sent' : 'NDA Received'}` :
               type === 'linkedin' ? 'Log LinkedIn Outreach' :
               'Add activity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <EmailSignaturesDialog
      open={signaturesDialogOpen}
      onOpenChange={setSignaturesDialogOpen}
      signatures={signatures}
      onAdd={(name, content) => addSig(name, content)}
      onUpdate={updateSig}
      onRemove={removeSig}
      onRefresh={refreshSigs}
    />
    </>
  );
}
