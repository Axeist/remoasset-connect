export const APP_ROLES = [
  'procurement_specialist',
  'csm',
  'developer',
  'admin',
  'super_admin',
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  procurement_specialist: 'Procurement Specialist',
  csm: 'CSM',
  developer: 'Developer',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

export const PERMISSIONS = [
  'app.full_edit',
  'leads.own',
  'leads.all',
  'leads.closed_won_all',
  'vendors.use',
  'rfq.use',
  'clients.use',
  'pipeline.own',
  'pipeline.team',
  'users.invite',
  'users.edit_role',
  'users.delete',
  'roles.configure',
  'developer.tools',
  'admin.panel',
  'integrations.manage',
  'csm.workspace',
  'coverage.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  'app.full_edit': 'Edit the whole app',
  'leads.own': 'Own leads',
  'leads.all': 'All leads',
  'leads.closed_won_all': 'All closed-won vendors',
  'vendors.use': 'Vendors',
  'rfq.use': 'RFQ',
  'clients.use': 'Clients',
  'pipeline.own': 'Own pipeline',
  'pipeline.team': 'Team pipeline',
  'users.invite': 'Invite users',
  'users.edit_role': 'Change user roles',
  'users.delete': 'Delete users',
  'roles.configure': 'Configure role permissions',
  'developer.tools': 'Developer tools',
  'admin.panel': 'Admin panel',
  'integrations.manage': 'Integrations',
  'csm.workspace': 'CSM workspace',
  'coverage.view': 'Country coverage',
};

export const SUPER_ADMIN_LOCKED_PERMISSIONS: Permission[] = ['users.delete', 'roles.configure'];

export function isAppRole(value: string | null | undefined): value is AppRole {
  return !!value && (APP_ROLES as readonly string[]).includes(value);
}

export function normalizeRole(value: string | null | undefined): AppRole | null {
  if (!value) return null;
  if (value === 'employee') return 'procurement_specialist';
  if (isAppRole(value)) return value;
  return null;
}

export function roleLabel(value: string | null | undefined): string {
  const role = normalizeRole(value);
  if (role) return ROLE_LABELS[role];
  if (value) return value.replace(/_/g, ' ');
  return 'User';
}

export function assignableRoles(callerIsSuperAdmin: boolean): AppRole[] {
  if (callerIsSuperAdmin) return [...APP_ROLES];
  return APP_ROLES.filter((r) => r !== 'super_admin');
}
