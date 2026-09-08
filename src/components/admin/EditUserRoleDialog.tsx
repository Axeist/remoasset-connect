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
import { RoleSelectFields } from '@/components/admin/RoleSelectFields';
import type { AppRole } from '@/lib/permissions';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface EditUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRoleId: string;
  userId: string;
  currentRole: string;
  fullName: string | null;
  onSuccess: () => void;
}

export function EditUserRoleDialog({
  open,
  onOpenChange,
  userRoleId,
  userId,
  currentRole,
  fullName,
  onSuccess,
}: EditUserRoleDialogProps) {
  const [role, setRole] = useState(currentRole);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setRole(currentRole);
  }, [currentRole, open]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const { error } = await supabase
      .from('user_roles')
          .update({ role: role as AppRole })
      .eq('id', userRoleId);
    setSubmitting(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
      return;
    }
    toast({ title: 'Role updated' });
    onOpenChange(false);
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user role</DialogTitle>
          <DialogDescription>{fullName || 'User'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <RoleSelectFields value={role} onChange={setRole} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gradient-primary">
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
