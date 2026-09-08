-- Role permissions catalog, helpers, data migration, RLS, and user-delete FK fixes.

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (role, permission)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp
      ON rp.role = ur.role
     AND rp.permission = _permission
     AND rp.enabled = true
    WHERE ur.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_full_edit(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission(_user_id, 'app.full_edit')
$$;

CREATE OR REPLACE FUNCTION public.is_closed_won_status(_status_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lead_statuses s
    WHERE s.id = _status_id
      AND (
        lower(trim(s.name)) IN ('won', 'closed', 'closed won', 'closed-won')
        OR lower(trim(s.name)) LIKE 'closed won%'
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_select_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = _lead_id
      AND (
        public.has_permission(auth.uid(), 'leads.all')
        OR l.owner_id = auth.uid()
        OR (
          public.has_permission(auth.uid(), 'leads.closed_won_all')
          AND public.is_closed_won_status(l.status_id)
        )
      )
  )
$$;

DROP POLICY IF EXISTS "Authenticated users can read role permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users can read role permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admins can configure role permissions" ON public.role_permissions;
CREATE POLICY "Super admins can configure role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'roles.configure'))
  WITH CHECK (public.has_permission(auth.uid(), 'roles.configure'));

INSERT INTO public.role_permissions (role, permission, enabled)
SELECT r.role, p.permission, (p.permission = ANY (r.perms))
FROM (
  VALUES
    ('procurement_specialist'::public.app_role, ARRAY[
      'leads.own','vendors.use','rfq.use','clients.use','pipeline.own'
    ]),
    ('csm'::public.app_role, ARRAY[
      'leads.closed_won_all','vendors.use','rfq.use','clients.use','csm.workspace','coverage.view'
    ]),
    ('developer'::public.app_role, ARRAY[
      'leads.own','vendors.use','rfq.use','clients.use','pipeline.own','developer.tools'
    ]),
    ('admin'::public.app_role, ARRAY[
      'app.full_edit','leads.own','leads.all','leads.closed_won_all',
      'vendors.use','rfq.use','clients.use','pipeline.own','pipeline.team',
      'users.invite','users.edit_role','developer.tools','admin.panel',
      'integrations.manage','csm.workspace','coverage.view'
    ]),
    ('super_admin'::public.app_role, ARRAY[
      'app.full_edit','leads.own','leads.all','leads.closed_won_all',
      'vendors.use','rfq.use','clients.use','pipeline.own','pipeline.team',
      'users.invite','users.edit_role','users.delete','roles.configure',
      'developer.tools','admin.panel','integrations.manage','csm.workspace','coverage.view'
    ]),
    ('employee'::public.app_role, ARRAY[
      'leads.own','vendors.use','rfq.use','clients.use','pipeline.own'
    ])
) AS r(role, perms)
CROSS JOIN (
  VALUES
    ('app.full_edit'),
    ('leads.own'),
    ('leads.all'),
    ('leads.closed_won_all'),
    ('vendors.use'),
    ('rfq.use'),
    ('clients.use'),
    ('pipeline.own'),
    ('pipeline.team'),
    ('users.invite'),
    ('users.edit_role'),
    ('users.delete'),
    ('roles.configure'),
    ('developer.tools'),
    ('admin.panel'),
    ('integrations.manage'),
    ('csm.workspace'),
    ('coverage.view')
) AS p(permission)
ON CONFLICT (role, permission) DO NOTHING;

UPDATE public.user_roles SET role = 'procurement_specialist' WHERE role = 'employee';

UPDATE public.user_roles ur
SET role = 'super_admin'
FROM auth.users au
WHERE ur.user_id = au.id
  AND lower(au.email) = 'ranjith@remoasset.com';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'procurement_specialist');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Prevent non-super-admins from assigning or demoting Super Admin
CREATE OR REPLACE FUNCTION public.protect_super_admin_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.has_permission(auth.uid(), 'roles.configure') THEN
      RAISE EXCEPTION 'Only Super Admin can change a Super Admin role';
    END IF;
  END IF;
  IF NEW.role = 'super_admin' AND (TG_OP = 'INSERT' OR OLD.role IS DISTINCT FROM NEW.role) THEN
    IF NOT public.has_permission(auth.uid(), 'roles.configure') THEN
      RAISE EXCEPTION 'Only Super Admin can assign the Super Admin role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_super_admin_assignment ON public.user_roles;
CREATE TRIGGER protect_super_admin_assignment
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_assignment();

-- Leads visibility
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Employees can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can view permitted leads" ON public.leads;
CREATE POLICY "Users can view permitted leads" ON public.leads
  FOR SELECT TO authenticated
  USING (
    public.has_permission(auth.uid(), 'leads.all')
    OR owner_id = auth.uid()
    OR (
      public.has_permission(auth.uid(), 'leads.closed_won_all')
      AND public.is_closed_won_status(status_id)
    )
  );

DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
CREATE POLICY "Users can update their own leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_full_edit(auth.uid()))
  WITH CHECK (
    public.has_full_edit(auth.uid())
    OR owner_id = auth.uid()
    OR public.user_is_lead_owner(id)
  );

DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
CREATE POLICY "Admins can delete leads" ON public.leads
  FOR DELETE USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can view all lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Users can view activities for their leads" ON public.lead_activities;
DROP POLICY IF EXISTS "Users can view permitted lead activities" ON public.lead_activities;
CREATE POLICY "Users can view permitted lead activities" ON public.lead_activities
  FOR SELECT TO authenticated
  USING (public.can_select_lead(lead_id));

DROP POLICY IF EXISTS "Authenticated users can view all lead documents" ON public.lead_documents;
DROP POLICY IF EXISTS "Users can view lead documents for their leads" ON public.lead_documents;
DROP POLICY IF EXISTS "Users can view permitted lead documents" ON public.lead_documents;
CREATE POLICY "Users can view permitted lead documents" ON public.lead_documents
  FOR SELECT TO authenticated
  USING (public.can_select_lead(lead_id));

DROP POLICY IF EXISTS "Admins can delete lead activities" ON public.lead_activities;
CREATE POLICY "Admins can delete lead activities" ON public.lead_activities
  FOR DELETE USING (public.has_full_edit(auth.uid()));

-- Replace remaining has_role(..., admin) policies
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users with edit_role can manage roles" ON public.user_roles;
CREATE POLICY "Users with edit_role can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_permission(auth.uid(), 'users.edit_role')
  )
  WITH CHECK (public.has_permission(auth.uid(), 'users.edit_role'));

DROP POLICY IF EXISTS "Admins can manage statuses" ON public.lead_statuses;
CREATE POLICY "Admins can manage statuses" ON public.lead_statuses
  FOR ALL USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage countries" ON public.countries;
CREATE POLICY "Admins can manage countries" ON public.countries
  FOR ALL USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
CREATE POLICY "Users can view their own tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (assignee_id = auth.uid() OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "Users can update their own tasks" ON public.tasks
  FOR UPDATE USING (assignee_id = auth.uid() OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
CREATE POLICY "Users can delete their own tasks" ON public.tasks
  FOR DELETE USING (assignee_id = auth.uid() OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can view their own follow_ups" ON public.follow_ups;
CREATE POLICY "Users can view their own follow_ups" ON public.follow_ups
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete warehouse pricing" ON public.warehouse_vendor_pricing;
CREATE POLICY "Admins can delete warehouse pricing" ON public.warehouse_vendor_pricing
  FOR DELETE USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage vendor_discovery_log" ON public.vendor_discovery_log;
CREATE POLICY "Admins can manage vendor_discovery_log" ON public.vendor_discovery_log
  FOR ALL USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage vendor_discovery_jobs" ON public.vendor_discovery_jobs;
CREATE POLICY "Admins can manage vendor_discovery_jobs" ON public.vendor_discovery_jobs
  FOR ALL USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all transfers" ON public.lead_transfers;
CREATE POLICY "Admins can view all transfers" ON public.lead_transfers
  FOR SELECT TO authenticated
  USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage cloudtalk settings" ON public.cloudtalk_settings;
CREATE POLICY "Admins can manage cloudtalk settings" ON public.cloudtalk_settings
  FOR ALL USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all profiles for CloudTalk mapping" ON public.profiles;
CREATE POLICY "Admins can update all profiles for CloudTalk mapping" ON public.profiles
  FOR UPDATE USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can view ai_token_usage" ON public.ai_token_usage;
CREATE POLICY "Admins can view ai_token_usage" ON public.ai_token_usage
  FOR SELECT USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;
CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete rfqs" ON public.rfqs;
CREATE POLICY "Admins can delete rfqs" ON public.rfqs
  FOR DELETE USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete rfq_recipients" ON public.rfq_recipients;
CREATE POLICY "Admins can delete rfq_recipients" ON public.rfq_recipients
  FOR DELETE USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete rfq_bids" ON public.rfq_bids;
CREATE POLICY "Admins can delete rfq_bids" ON public.rfq_bids
  FOR DELETE USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete rfq_emails" ON public.rfq_emails;
CREATE POLICY "Admins can delete rfq_emails" ON public.rfq_emails
  FOR DELETE USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage targets" ON public.productivity_targets;
CREATE POLICY "Admins can manage targets" ON public.productivity_targets
  FOR ALL USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete device pricing" ON public.vendor_device_pricing;
CREATE POLICY "Admins can delete device pricing" ON public.vendor_device_pricing
  FOR DELETE USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
CREATE POLICY "Admins can delete clients" ON public.clients
  FOR DELETE USING (public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete client requests" ON public.client_requests;
CREATE POLICY "Admins can delete client requests" ON public.client_requests
  FOR DELETE USING (public.has_full_edit(auth.uid()));

-- User delete FK fixes
ALTER TABLE public.lead_documents
  ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.lead_documents
  DROP CONSTRAINT IF EXISTS lead_documents_uploaded_by_fkey;
ALTER TABLE public.lead_documents
  ADD CONSTRAINT lead_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.lead_transfers
  ALTER COLUMN to_user_id DROP NOT NULL;
ALTER TABLE public.lead_transfers
  ALTER COLUMN transferred_by DROP NOT NULL;

ALTER TABLE public.productivity_targets
  DROP CONSTRAINT IF EXISTS productivity_targets_updated_by_fkey;
ALTER TABLE public.productivity_targets
  ADD CONSTRAINT productivity_targets_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "Users can create follow_ups" ON public.follow_ups;
CREATE POLICY "Users can create follow_ups" ON public.follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own follow_ups" ON public.follow_ups;
CREATE POLICY "Users can delete their own follow_ups" ON public.follow_ups
  FOR DELETE USING (user_id = auth.uid() OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can update their own follow_ups" ON public.follow_ups;
CREATE POLICY "Users can update their own follow_ups" ON public.follow_ups
  FOR UPDATE USING (user_id = auth.uid() OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can manage own price lookup history" ON public.mrp_lookup_history;
CREATE POLICY "Users can manage own price lookup history"
  ON public.mrp_lookup_history FOR ALL
  USING (auth.uid() = user_id OR public.has_full_edit(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can manage own chat sessions" ON public.agent_chat_sessions;
CREATE POLICY "Users can manage own chat sessions"
  ON public.agent_chat_sessions FOR ALL
  USING (auth.uid() = user_id OR public.has_full_edit(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can insert lead documents for their leads" ON public.lead_documents;
CREATE POLICY "Users can insert lead documents for their leads"
  ON public.lead_documents FOR INSERT TO authenticated
  WITH CHECK (public.can_select_lead(lead_id) AND (uploaded_by = auth.uid() OR public.has_full_edit(auth.uid())));

DROP POLICY IF EXISTS "Users can delete own lead documents" ON public.lead_documents;
CREATE POLICY "Users can delete own lead documents"
  ON public.lead_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() OR public.has_full_edit(auth.uid()));

DROP POLICY IF EXISTS "Users can insert lead activities for their leads" ON public.lead_activities;
CREATE POLICY "Users can insert lead activities for their leads"
  ON public.lead_activities FOR INSERT TO authenticated
  WITH CHECK (
    public.has_full_edit(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.leads
      WHERE leads.id = lead_activities.lead_id
        AND leads.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view own dial intents" ON public.cloudtalk_dial_intents;
CREATE POLICY "Users can view own dial intents"
  ON public.cloudtalk_dial_intents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_full_edit(auth.uid()));

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_full_edit(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_closed_won_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_select_lead(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Service role uploads call recordings" ON storage.objects;
CREATE POLICY "Service role uploads call recordings"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'call-recordings' AND public.has_full_edit(auth.uid()));

