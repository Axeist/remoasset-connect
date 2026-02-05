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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

type BulkAction = 'status' | 'owner';

interface BulkActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: BulkAction;
  leadIds: string[];
  onSuccess: () => void;
}

export function BulkActionsDialog({
  open,
  onOpenChange,
  action,
  leadIds,
  onSuccess,
}: BulkActionsDialogProps) {
  const [statuses, setStatuses] = useState<{ id: string; name: string; color: string }[]>([]);
  const [owners, setOwners] = useState<{ id: string; full_name: string | null }[]>([]);
  const [selectedStatusId, setSelectedStatusId] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [sRes, rolesRes] = await Promise.all([
        supabase.from('lead_statuses').select('id, name, color').order('sort_order'),
        supabase.from('user_roles').select('user_id'),
      ]);
      if (sRes.data) setStatuses(sRes.data);
      if (rolesRes.data?.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', rolesRes.data.map((r) => r.user_id));
        setOwners((profiles ?? []).map(p => ({ id: p.user_id, full_name: p.full_name })));
      }
    })();
  }, [open]);

  const handleSubmit = async () => {
    if (action === 'status' && !selectedStatusId) {
      toast({ variant: 'destructive', title: 'Select a status' });
      return;
    }
    if (action === 'owner' && !selectedOwnerId) {
      toast({ variant: 'destructive', title: 'Select an owner' });
      return;
    }
    setSubmitting(true);
    const payload = action === 'status'
      ? { status_id: selectedStatusId }
      : { owner_id: selectedOwnerId };
    const { error } = await supabase
      .from('leads')
      .update(payload)
      .in('id', leadIds);
    if (error) {
      setSubmitting(false);
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    if (action === 'owner' && selectedOwnerId) {
      const { data: leadsData } = await supabase.from('leads').select('company_name').in('id', leadIds);
      const { data: userData } = await supabase.auth.getUser();
      const newOwnerName = owners.find(o => o.id === selectedOwnerId)?.full_name || 'Unknown';
      
      // Send notification
      await supabase.from('notifications').insert({
        user_id: selectedOwnerId,
        title: 'Leads assigned to you',
        message: leadIds.length === 1
          ? `${(leadsData?.[0] as { company_name: string } | undefined)?.company_name ?? 'A lead'} has been assigned to you.`
          : `${leadIds.length} leads have been assigned to you.`,
        type: 'lead',
      });
      
      // Log activity for each lead
      if (userData.user) {
        const activities = leadIds.map(leadId => ({
          lead_id: leadId,
          user_id: userData.user.id,
          activity_type: 'note',
          description: `Lead reassigned to ${newOwnerName} via bulk action`,
        }));
        await supabase.from('lead_activities').insert(activities);
      }
    }
    setSubmitting(false);
    toast({ title: 'Updated', description: `${leadIds.length} lead(s) updated.` });
    onOpenChange(false);
    onSuccess();
  };

  const title = action === 'status' ? 'Update status' : 'Assign owner';
  const description = action === 'status'
    ? `Set status for ${leadIds.length} selected lead(s).`
    : `Assign owner for ${leadIds.length} selected lead(s).`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {action === 'status' && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {action === 'owner' && (
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name || o.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              (action === 'status' && !selectedStatusId) ||
              (action === 'owner' && !selectedOwnerId)
            }
            className="gradient-primary"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
