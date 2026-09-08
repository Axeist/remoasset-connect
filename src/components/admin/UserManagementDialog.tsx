import { useState, useEffect } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Key, Ban, Trash2, Eye, EyeOff, ShieldAlert, ShieldCheck, UserX, User } from 'lucide-react';

interface UserManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string | null;
  email?: string | null;
  role: string;
  isBanned?: boolean;
  onSuccess: () => void;
}

async function callManageUser(action: string, targetUserId: string, extras?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  const body = { action, target_user_id: targetUserId, ...extras, ...(session?.access_token ? { __auth_token: session.access_token } : {}) };
  const headers = session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
  const { data, error } = await supabase.functions.invoke('manage-user', { body, headers });

  if (error) {
    let message = error.message || 'Request failed';
    try {
      const parsed = await (error as { context?: Response }).context?.json?.();
      if (parsed?.error) message = parsed.error;
    } catch { /* gateway message */ }
    if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
      message = String((data as { error: string }).error);
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function UserManagementDialog({
  open,
  onOpenChange,
  userId,
  fullName,
  email,
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editName, setEditName] = useState(fullName ?? '');
  const [editDesignation, setEditDesignation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState(email ?? '');
  const { toast } = useToast();
  const { user, isSuperAdmin } = useAuth();
  const [leadCount, setLeadCount] = useState<number | null>(null);

  const displayName = editName.trim() || fullName || 'User';

  useEffect(() => {
    if (!open) return;
    setEditName(fullName ?? '');
    setEditEmail(email ?? '');
    setProfileLoading(true);
    supabase
      .from('profiles')
      .select('full_name, designation, phone')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setEditName(data.full_name ?? '');
          setEditDesignation(data.designation ?? '');
          setEditPhone(data.phone ?? '');
        }
        setProfileLoading(false);
      });
  }, [open, userId, fullName, email]);

  useEffect(() => {
    if (!deleteConfirmOpen) return;
    supabase.from('leads').select('id', { count: 'exact', head: true }).eq('owner_id', userId)
      .then(({ count }) => setLeadCount(count ?? 0));
  }, [deleteConfirmOpen, userId]);

  const handleSaveProfile = async () => {
    const name = editName.trim();
    if (!name) {
      toast({ variant: 'destructive', title: 'Name is required' });
      return;
    }
    setSavingProfile(true);
    try {
      await callManageUser('update_profile', userId, {
        full_name: name,
        designation: editDesignation.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
      });
      toast({ title: 'Profile updated', description: `Saved changes for ${name}.` });
      onSuccess();
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : 'Failed' });
    }
    setSavingProfile(false);
  };

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

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setDeleting(true);
    try {
      const result = await callManageUser('delete_user', userId, { transfer_to_user_id: user.id });
      const moved = result?.transferred_leads ?? leadCount ?? 0;
      toast({
        title: 'User deleted',
        description: `${displayName} has been removed. ${moved} lead${moved === 1 ? '' : 's'} transferred to you.`,
      });
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Manage User
              {isBanned && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Restricted</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {displayName} &middot; <span className="capitalize">{role.replace(/_/g, ' ')}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4 text-muted-foreground" />
                Profile
              </div>
              {profileLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading profile…
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="manage-name">Full name</Label>
                    <Input
                      id="manage-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manage-email">Email</Label>
                    <Input
                      id="manage-email"
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="jane@remoasset.in"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="manage-designation">Designation</Label>
                      <Input
                        id="manage-designation"
                        value={editDesignation}
                        onChange={(e) => setEditDesignation(e.target.value)}
                        placeholder="Sales Manager"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="manage-phone">Phone</Label>
                      <Input
                        id="manage-phone"
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+1 234 567 8900"
                      />
                    </div>
                  </div>
                  <Button size="sm" onClick={handleSaveProfile} disabled={savingProfile} className="gap-1.5">
                    {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save profile
                  </Button>
                </div>
              )}
            </div>

            <Separator />

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

            {isSuperAdmin && (
            <>
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
            </>
            )}
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
            <AlertDialogTitle>Delete user and transfer leads?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{displayName}</strong> including their profile, role, and auth account.
              {leadCount == null
                ? ' Counting their leads…'
                : leadCount === 0
                  ? ' They have no owned leads.'
                  : ` ${leadCount} lead${leadCount === 1 ? '' : 's'} will be transferred to you as Super Admin.`}
              {' '}This cannot be undone.
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
