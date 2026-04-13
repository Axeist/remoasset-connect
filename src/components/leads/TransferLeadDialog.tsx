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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRightLeft } from 'lucide-react';

interface TransferLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadCompanyName: string;
  currentOwnerId: string | null;
  currentOwnerName: string | null;
  onSuccess: () => void;
}

export function TransferLeadDialog({
  open,
  onOpenChange,
  leadId,
  leadCompanyName,
  currentOwnerId,
  currentOwnerName,
  onSuccess,
}: TransferLeadDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<{ id: string; full_name: string | null }[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTargetUserId('');
    setNotes('');
    (async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id');
      if (!roles?.length) return;
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', roles.map((r) => r.user_id));
      const list = (profiles ?? [])
        .map((p) => ({ id: p.user_id, full_name: p.full_name }))
        .filter((p) => p.id !== currentOwnerId);
      setEmployees(list);
    })();
  }, [open, currentOwnerId]);

  const handleTransfer = async () => {
    if (!targetUserId || !user) return;
    setSubmitting(true);

    try {
      const targetEmployee = employees.find((e) => e.id === targetUserId);
      const toName = targetEmployee?.full_name ?? 'Unknown';
      const fromName = currentOwnerName ?? 'Unassigned';

      // 1. Log the activity FIRST (while current user is still the owner)
      const { error: activityErr } = await supabase.from('lead_activities').insert({
        lead_id: leadId,
        user_id: user.id,
        activity_type: 'transfer',
        description: `Lead transferred from ${fromName} to ${toName}${notes ? ` — ${notes}` : ''}`,
      });
      if (activityErr) throw activityErr;

      // 2. Insert the transfer audit log
      const { error: transferErr } = await supabase.from('lead_transfers').insert({
        lead_id: leadId,
        from_user_id: currentOwnerId,
        to_user_id: targetUserId,
        transferred_by: user.id,
        notes: notes || null,
      });
      if (transferErr) throw transferErr;

      // 3. Update lead ownership
      const { error: updateErr } = await supabase
        .from('leads')
        .update({ owner_id: targetUserId })
        .eq('id', leadId);
      if (updateErr) throw updateErr;

      // 4. Notify the new owner
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        title: 'Lead transferred to you',
        message: `${leadCompanyName} has been transferred to you by ${currentOwnerName ?? 'a team member'}.`,
        type: 'lead',
      });

      // 5. Slack notification (non-blocking)
      supabase.functions.invoke('slack-notify', {
        body: {
          event: 'lead_assigned',
          payload: {
            company_name: leadCompanyName,
            assigned_to: toName,
            assigned_by: user.email ?? 'Unknown',
            lead_id: leadId,
          },
        },
      }).catch(() => {});

      toast({ title: 'Lead transferred', description: `${leadCompanyName} transferred to ${toName}.` });
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Transfer failed',
        description: (err as Error)?.message ?? 'Could not transfer the lead.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Transfer Lead
          </DialogTitle>
          <DialogDescription>
            Transfer <strong>{leadCompanyName}</strong> to another team member. This action will be logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current owner</label>
            <p className="text-sm text-muted-foreground">{currentOwnerName ?? 'Unassigned'}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Transfer to</label>
            <Select value={targetUserId} onValueChange={setTargetUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name || e.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for transfer..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleTransfer} disabled={!targetUserId || submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
