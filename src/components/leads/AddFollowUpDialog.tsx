import { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { safeFormat } from '@/lib/date';
import { Loader2, CalendarDays } from 'lucide-react';

interface AddFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the lead picker is hidden and this ID is used directly */
  leadId?: string;
  onSuccess: () => void;
  leadCompanyName?: string;
  leadContactName?: string | null;
  leadEmail?: string | null;
  /** Provide when opening from the standalone Follow-ups page (no leadId) */
  leads?: { id: string; company_name: string }[];
}

export function AddFollowUpDialog({
  open,
  onOpenChange,
  leadId,
  onSuccess,
  leadCompanyName,
  leadContactName,
  leadEmail,
  leads,
}: AddFollowUpDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isConnected: isCalendarConnected, createEvent: createCalendarEvent } = useGoogleCalendar();
  const [scheduledAt, setScheduledAt] = useState('');
  const [reminderType, setReminderType] = useState<'one-time' | 'recurring'>('one-time');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(false);

  // Lead picker state — used only when no leadId is passed in
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [selectedLeadEmail, setSelectedLeadEmail] = useState<string | null>(null);
  const [selectedLeadContact, setSelectedLeadContact] = useState<string | null>(null);

  const effectiveLeadId = leadId ?? selectedLeadId;
  const effectiveCompanyName = leadId
    ? leadCompanyName
    : leads?.find((l) => l.id === selectedLeadId)?.company_name;
  const effectiveLeadEmail = leadId ? leadEmail : selectedLeadEmail;
  const effectiveContactName = leadId ? leadContactName : selectedLeadContact;

  // When lead picker selection changes, fetch email/contact from DB
  useEffect(() => {
    if (leadId || !selectedLeadId) { setSelectedLeadEmail(null); setSelectedLeadContact(null); return; }
    supabase.from('leads').select('email, contact_name').eq('id', selectedLeadId).single()
      .then(({ data }) => {
        setSelectedLeadEmail(data?.email ?? null);
        setSelectedLeadContact(data?.contact_name ?? null);
      });
  }, [selectedLeadId, leadId]);

  const resetForm = () => {
    setScheduledAt('');
    setReminderType('one-time');
    setNotes('');
    setAddToCalendar(false);
    setSelectedLeadId('');
    setSelectedLeadEmail(null);
    setSelectedLeadContact(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt || !user || !effectiveLeadId) return;
    setSubmitting(true);
    const scheduledDate = new Date(scheduledAt);

    const { data: followUpRow, error } = await supabase.from('follow_ups').insert({
      lead_id: effectiveLeadId,
      user_id: user.id,
      scheduled_at: scheduledDate.toISOString(),
      reminder_type: reminderType,
      notes: notes.trim() || null,
    }).select('id').single();

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      setSubmitting(false);
      return;
    }

    if (addToCalendar && isCalendarConnected) {
      try {
        const endDate = new Date(scheduledDate);
        endDate.setMinutes(endDate.getMinutes() + 30);
        const calEvent = await createCalendarEvent({
          title: `Follow-up: ${effectiveCompanyName || 'Lead'}${effectiveContactName ? ` — ${effectiveContactName}` : ''}`,
          description: notes.trim() || 'Scheduled follow-up',
          startDateTime: scheduledDate.toISOString(),
          endDateTime: endDate.toISOString(),
          attendees: effectiveLeadEmail?.trim() ? [effectiveLeadEmail.trim()] : [],
        });
        if (calEvent?.id && followUpRow?.id) {
          await supabase.from('follow_ups').update({ google_calendar_event_id: calEvent.id }).eq('id', followUpRow.id);
        }
      } catch (calError: unknown) {
        const message = calError instanceof Error ? calError.message : 'Unknown error';
        toast({ variant: 'destructive', title: 'Calendar sync failed', description: message });
      }
    }

    // Log activity
    await supabase.from('lead_activities').insert({
      lead_id: effectiveLeadId,
      user_id: user.id,
      activity_type: 'note',
      description: `Follow-up scheduled for ${safeFormat(scheduledDate.toISOString(), 'PPp')}${notes.trim() ? `: ${notes.trim()}` : ''}`,
    });

    // In-app notification for the owner
    await supabase.from('notifications').insert({
      user_id: user.id,
      title: 'Follow-up scheduled',
      message: `Follow-up for ${effectiveCompanyName ?? 'a lead'} on ${safeFormat(scheduledDate.toISOString(), 'PPp')}${notes.trim() ? ` — ${notes.trim()}` : ''}.`,
      type: 'info',
      metadata: { leadId: effectiveLeadId, followUpId: followUpRow?.id ?? null },
    });

    // Slack notification (non-blocking)
    supabase.functions.invoke('slack-notify', {
      body: {
        event: 'followup_created',
        payload: {
          company_name: effectiveCompanyName ?? 'Unknown Lead',
          scheduled_at: scheduledDate.toISOString(),
          notes: notes.trim() || null,
          assigned_to: user.email ?? 'Unknown',
          lead_id: effectiveLeadId,
        },
      },
    }).catch(() => {});

    setSubmitting(false);
    toast({ title: addToCalendar ? 'Follow-up scheduled & added to calendar' : 'Follow-up scheduled' });
    resetForm();
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Schedule follow-up</DialogTitle>
          <DialogDescription>Set a date and time to follow up with a lead.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lead selector — only shown when no leadId is provided */}
          {!leadId && leads && leads.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="followup-lead">Lead</Label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger id="followup-lead">
                  <SelectValue placeholder="Select a lead…" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="followup-datetime">Date & time</Label>
            <Input
              id="followup-datetime"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="followup-type">Type</Label>
            <select
              id="followup-type"
              value={reminderType}
              onChange={(e) => setReminderType(e.target.value as 'one-time' | 'recurring')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="one-time">One-time</option>
              <option value="recurring">Recurring</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="followup-notes">Notes (optional)</Label>
            <Input
              id="followup-notes"
              type="text"
              placeholder="e.g. Discuss pricing, Send proposal…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10"
            />
          </div>
          {isCalendarConnected && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Checkbox
                id="followup-calendar"
                checked={addToCalendar}
                onCheckedChange={(checked) => setAddToCalendar(checked === true)}
              />
              <label htmlFor="followup-calendar" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                <CalendarDays className="h-4 w-4 text-primary" />
                Add to Google Calendar
                {effectiveLeadEmail?.trim() ? ' & send invite' : ''}
              </label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!scheduledAt || submitting || (!leadId && !selectedLeadId)}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
