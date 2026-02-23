import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Key, Ban, Trash2, Eye, EyeOff, ShieldAlert, ShieldCheck, UserX } from 'lucide-react';

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string | null;
  role: string;
  isBanned?: boolean;
  onSuccess: () => void;
}

async function callManageUser(action: string, targetUserId: string, extras?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('manage-user', {
    body: { action, target_user_id: targetUserId, ...extras },
  });

  if (error) throw new Error(error.message || 'Request failed');
  if (data?.error) throw new Error(data.error);
  return data;
}

export function UserManagementDialog({
  open,
  onOpenChange,
  userId,
  fullName,
  role,
  isBanned,
  onSuccess,
}: UserManagementDialogProps) {
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [togglingBan, setTogglingBan] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  const displayName = fullName || 'User';

  const handleResetPassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      toast({ variant: 'destructive', title: 'Password must be at least 6 characters' });
      return;
    }
    setResettingPassword(true);
    try {
      await callManageUser('reset_password', userId, { new_password: newPassword });
      toast({ title: 'Password updated', description: `Password for ${displayName} has been changed.` });
      setNewPassword('');
      setShowPassword(false);
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Failed' });
    }
    setResettingPassword(false);
  };

  const handleToggleBan = async () => {
    setTogglingBan(true);
    try {
      await callManageUser('toggle_ban', userId, { ban: !isBanned });
      toast({
        title: isBanned ? 'User unrestricted' : 'User restricted',
        description: isBanned
          ? `${displayName} can now sign in again.`
          : `${displayName} has been restricted and cannot sign in.`,
      });
      onSuccess();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Failed' });
    }
    setTogglingBan(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await callManageUser('delete_user', userId);
      toast({ title: 'User deleted', description: `${displayName} has been removed from the system.` });
      setDeleteConfirmOpen(false);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Failed' });
    }
    setDeleting(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Manage User
              {isBanned && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Restricted</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {displayName} &middot; <span className="capitalize">{role}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Reset Password */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Key className="h-4 w-4 text-muted-foreground" />
                Change Password
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New password (min 6 chars)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={resettingPassword || !newPassword.trim()}
                  className="shrink-0"
                >
                  {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This immediately changes the user&apos;s password. They&apos;ll need to use the new password on their next login.
              </p>
            </div>

            <Separator />

            {/* Restrict / Unrestrict */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {isBanned ? (
                  <ShieldCheck className="h-4 w-4 text-green-600" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                )}
                Access Control
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  {isBanned
                    ? 'This user is currently restricted and cannot sign in.'
                    : 'Restrict this user to prevent them from signing in.'}
                </p>
                <Button
                  variant={isBanned ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleToggleBan}
                  disabled={togglingBan}
                  className={`shrink-0 gap-1.5 ${!isBanned ? 'border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-600 dark:text-orange-400 dark:hover:bg-orange-500/10' : ''}`}
                >
                  {togglingBan ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isBanned ? (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Unrestrict
                    </>
                  ) : (
                    <>
                      <Ban className="h-4 w-4" />
                      Restrict
                    </>
                  )}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Delete */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <UserX className="h-4 w-4" />
                Danger Zone
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Permanently remove this user and all their data. This cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="shrink-0 gap-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{displayName}</strong> from the system including their profile, role, and auth account. Any leads owned by this user will become unassigned. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
