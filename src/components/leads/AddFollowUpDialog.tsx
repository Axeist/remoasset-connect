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
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { safeFormat } from '@/lib/date';
import { Loader2, CalendarDays } from 'lucide-react';

interface AddFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onSuccess: () => void;
  leadCompanyName?: string;
  leadContactName?: string | null;
  leadEmail?: string | null;
}

export function AddFollowUpDialog({
  open,
  onOpenChange,
  leadId,
  onSuccess,
  leadCompanyName,
  leadContactName,
  leadEmail,
}: AddFollowUpDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isConnected: isCalendarConnected, createEvent: createCalendarEvent } = useGoogleCalendar();
  const [scheduledAt, setScheduledAt] = useState('');
  const [reminderType, setReminderType] = useState<'one-time' | 'recurring'>('one-time');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addToCalendar, setAddToCalendar] = useState(false);

  const resetForm = () => {
    setScheduledAt('');
    setReminderType('one-time');
    setNotes('');
    setAddToCalendar(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt || !user) return;
    setSubmitting(true);
    const scheduledDate = new Date(scheduledAt);
    const { data: followUpRow, error } = await supabase.from('follow_ups').insert({
      lead_id: leadId,
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
          title: `Follow-up: ${leadCompanyName || 'Lead'}${leadContactName ? ` — ${leadContactName}` : ''}`,
          description: notes.trim() || `Scheduled follow-up`,
          startDateTime: scheduledDate.toISOString(),
          endDateTime: endDate.toISOString(),
          attendees: leadEmail?.trim() ? [leadEmail.trim()] : [],
        });

        if (calEvent?.id && followUpRow?.id) {
          await supabase
            .from('follow_ups')
            .update({ google_calendar_event_id: calEvent.id })
            .eq('id', followUpRow.id);
        }
      } catch (calError: unknown) {
        const message = calError instanceof Error ? calError.message : 'Unknown error';
        toast({ variant: 'destructive', title: 'Calendar sync failed', description: message });
      }
    }

    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'note',
      description: `Follow-up scheduled for ${safeFormat(scheduledDate.toISOString(), 'PPp')}${notes.trim() ? `: ${notes.trim()}` : ''}`,
    });
    setSubmitting(false);
    toast({ title: addToCalendar ? 'Follow-up scheduled & added to calendar' : 'Follow-up scheduled' });
    resetForm();
    onSuccess();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule follow-up</DialogTitle>
          <DialogDescription>Set a date and time to follow up with this lead.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-10"
            />
          </div>
          {isCalendarConnected && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-50/50 p-3">
              <Checkbox
                id="followup-calendar"
                checked={addToCalendar}
                onCheckedChange={(checked) => setAddToCalendar(checked === true)}
              />
              <label htmlFor="followup-calendar" className="text-sm font-medium flex items-center gap-1.5 cursor-pointer">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                Add to Google Calendar
                {leadEmail?.trim() ? ' & send invite' : ''}
              </label>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!scheduledAt || submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
