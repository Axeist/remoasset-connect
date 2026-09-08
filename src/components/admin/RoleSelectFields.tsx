import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assignableRoles, ROLE_LABELS, type AppRole } from '@/lib/permissions';
import { useAuth } from '@/contexts/AuthContext';

export function RoleSelectFields({
  value,
  onChange,
}: {
  value: string;
  onChange: (role: AppRole) => void;
}) {
  const { isSuperAdmin } = useAuth();
  const roles = assignableRoles(isSuperAdmin);

  return (
    <div className="space-y-2">
      <Label>Role</Label>
      <Select value={value} onValueChange={(v) => onChange(v as AppRole)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {roles.map((role) => (
            <SelectItem key={role} value={role}>
              {ROLE_LABELS[role]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
