-- New role labels. Must commit before they can be used (Postgres enum rule).
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'procurement_specialist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'csm';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'developer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
