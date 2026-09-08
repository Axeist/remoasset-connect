import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import type { Permission } from '@/lib/permissions';

export function RequirePermission({
  permission,
  anyOf,
  children,
}: {
  permission?: Permission;
  anyOf?: Permission[];
  children: ReactNode;
}) {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const allowed = permission ? can(permission) : (anyOf ?? []).some((p) => can(p));
  if (!allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
