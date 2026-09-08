import { ReactNode } from 'react';
import { RequirePermission } from '@/components/RequirePermission';

export function AdminRoute({ children }: { children: ReactNode }) {
  return <RequirePermission permission="admin.panel">{children}</RequirePermission>;
}
