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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { safeFormat } from '@/lib/date';
import { Loader2 } from 'lucide-react';

interface AddFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  onSuccess: () => void;
}

export function AddFollowUpDialog({
  open,
  onOpenChange,
  leadId,
  onSuccess,
}: AddFollowUpDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scheduledAt, setScheduledAt] = useState('');
  const [reminderType, setReminderType] = useState<'one-time' | 'recurring'>('one-time');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setScheduledAt('');
    setReminderType('one-time');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledAt || !user) return;
    setSubmitting(true);
    const scheduledDate = new Date(scheduledAt);
    const { error } = await supabase.from('follow_ups').insert({
      lead_id: leadId,
      user_id: user.id,
      scheduled_at: scheduledDate.toISOString(),
      reminder_type: reminderType,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      user_id: user.id,
      activity_type: 'note',
      description: `Follow-up scheduled for ${safeFormat(scheduledDate.toISOString(), 'PPp')}${notes.trim() ? `: ${notes.trim()}` : ''}`,
    });
    toast({ title: 'Follow-up scheduled' });
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
