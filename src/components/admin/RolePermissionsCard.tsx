import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  APP_ROLES,
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  SUPER_ADMIN_LOCKED_PERMISSIONS,
  type AppRole,
  type Permission,
} from '@/lib/permissions';

type PermRow = { role: AppRole; permission: Permission; enabled: boolean };

export function RolePermissionsCard() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PermRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from('role_permissions').select('role, permission, enabled');
    if (error) {
      toast({ variant: 'destructive', title: 'Could not load permissions', description: error.message });
      return;
    }
    setRows((data ?? []) as PermRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const enabled = (role: AppRole, permission: Permission) =>
    rows.find((r) => r.role === role && r.permission === permission)?.enabled ?? false;

  const toggle = async (role: AppRole, permission: Permission, next: boolean) => {
    if (role === 'super_admin' && SUPER_ADMIN_LOCKED_PERMISSIONS.includes(permission) && !next) {
      toast({ variant: 'destructive', title: 'Super Admin must keep this permission' });
      return;
    }
    setSaving(`${role}:${permission}`);
    const { error } = await supabase
      .from('role_permissions')
      .update({ enabled: next })
      .eq('role', role)
      .eq('permission', permission);
    setSaving(null);
    if (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.role === role && r.permission === permission ? { ...r, enabled: next } : r)),
    );
  };

  const displayRoles = APP_ROLES;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role permissions</CardTitle>
        <CardDescription>
          Toggle what each role can do. Super Admin cannot turn off delete-user or this editor.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left font-medium py-2 pr-3">Permission</th>
              {displayRoles.map((role) => (
                <th key={role} className="text-center font-medium py-2 px-2 whitespace-nowrap">{ROLE_LABELS[role]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((permission) => (
              <tr key={permission} className="border-t">
                <td className="py-2 pr-3">
                  <Label className="font-normal">{PERMISSION_LABELS[permission]}</Label>
                  <p className="text-[11px] text-muted-foreground font-mono">{permission}</p>
                </td>
                {displayRoles.map((role) => {
                  const locked = role === 'super_admin' && SUPER_ADMIN_LOCKED_PERMISSIONS.includes(permission);
                  return (
                    <td key={role} className="text-center px-2">
                      <Switch
                        checked={enabled(role, permission)}
                        disabled={saving === `${role}:${permission}` || locked}
                        onCheckedChange={(v) => void toggle(role, permission, v)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
