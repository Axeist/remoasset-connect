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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail } from 'lucide-react';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function InviteUserDialog({ open, onOpenChange, onSuccess }: InviteUserDialogProps) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleClose = (open: boolean) => {
    if (!open) {
      setEmail('');
      setFullName('');
      setRole('employee');
    }
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ variant: 'destructive', title: 'Email required' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email: email.trim(), role, full_name: fullName.trim() || null },
      });

      if (error) {
        let description = error.message || 'Unknown error';
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) description = body.error;
        } catch { /* ignore */ }
        toast({ variant: 'destructive', title: 'Failed to send invite', description });
        setSubmitting(false);
        return;
      }

      const label = fullName.trim() ? `${fullName.trim()} (${email.trim()})` : email.trim();
      toast({ title: 'Invite sent!', description: `An invitation email has been sent to ${label}.` });
      onSuccess();
      handleClose(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to send invite',
      });
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Invite user
          </DialogTitle>
          <DialogDescription>
            Send an invitation email with a sign-up link. Choose their role before sending.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-name">Full name</Label>
            <Input
              id="invite-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address *</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'employee')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">
                  <div className="flex flex-col items-start">
                    <span>Employee</span>
                    <span className="text-xs text-muted-foreground">Can view and manage leads</span>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex flex-col items-start">
                    <span>Admin</span>
                    <span className="text-xs text-muted-foreground">Full access including admin panel</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary gap-2" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
