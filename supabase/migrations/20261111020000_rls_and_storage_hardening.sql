-- Enforce the role-permission matrix in the database (was UI-only) and tighten storage.
-- Default roles all hold clients.use / vendors.use / rfq.use, so normal users are unaffected;
-- the permission matrix in Admin now actually controls access.

CREATE OR REPLACE FUNCTION public.can_use(_perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_permission(auth.uid(), _perm) OR public.has_full_edit(auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.can_use(text) TO authenticated;

-- Helper: replace the permissive select/insert/update policies of a table.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('clients',                  'clients.use', ARRAY['Authenticated users can view clients','Authenticated users can insert clients','Authenticated users can update clients']),
      ('client_requests',          'clients.use', ARRAY['Authenticated users can view client requests','Authenticated users can insert client requests','Authenticated users can update client requests']),
      ('vendor_device_pricing',    'vendors.use', ARRAY['Authenticated users can view device pricing','Authenticated users can insert device pricing','Authenticated users can update device pricing']),
      ('warehouse_vendor_pricing', 'vendors.use', ARRAY['Authenticated users can view warehouse pricing','Authenticated users can insert warehouse pricing','Authenticated users can update warehouse pricing']),
      ('rfqs',                     'rfq.use',     ARRAY['Authenticated users can view rfqs','Authenticated users can insert rfqs','Authenticated users can update rfqs']),
      ('rfq_recipients',           'rfq.use',     ARRAY['Authenticated users can view rfq_recipients','Authenticated users can insert rfq_recipients','Authenticated users can update rfq_recipients']),
      ('rfq_bids',                 'rfq.use',     ARRAY['Authenticated users can view rfq_bids','Authenticated users can insert rfq_bids','Authenticated users can update rfq_bids'])
    ) AS t(tbl, perm, names)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.names[1], r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.names[2], r.tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.names[3], r.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_use(%L))', r.tbl || ' select by permission', r.tbl, r.perm);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_use(%L))', r.tbl || ' insert by permission', r.tbl, r.perm);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_use(%L)) WITH CHECK (public.can_use(%L))', r.tbl || ' update by permission', r.tbl, r.perm, r.perm);
  END LOOP;
END $$;

-- rfq_emails: view + insert by permission (no update policy existed)
DROP POLICY IF EXISTS "Authenticated users can view rfq_emails" ON public.rfq_emails;
DROP POLICY IF EXISTS "Authenticated users can insert rfq_emails" ON public.rfq_emails;
CREATE POLICY "rfq_emails select by permission" ON public.rfq_emails FOR SELECT TO authenticated USING (public.can_use('rfq.use'));
CREATE POLICY "rfq_emails insert by permission" ON public.rfq_emails FOR INSERT TO authenticated WITH CHECK (public.can_use('rfq.use'));

-- lead_activities: three overlapping INSERT policies made the owner check meaningless.
-- One rule: you may log an activity as yourself on a lead you can see.
DROP POLICY IF EXISTS "Authenticated users can insert lead activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Users can create activities" ON public.lead_activities;
DROP POLICY IF EXISTS "Users can insert lead activities for their leads" ON public.lead_activities;
CREATE POLICY "Users can log activities on visible leads" ON public.lead_activities
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_select_lead(lead_id));

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Lead documents live under "<lead_id>/...": scope access to leads the caller can see.
CREATE OR REPLACE FUNCTION public.can_access_lead_object(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_full_edit(auth.uid())
    OR CASE
         WHEN (storage.foldername(_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         THEN public.can_select_lead(((storage.foldername(_name))[1])::uuid)
         ELSE false
       END
$$;
GRANT EXECUTE ON FUNCTION public.can_access_lead_object(text) TO authenticated;

DROP POLICY IF EXISTS "Authenticated read lead documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own lead documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload lead documents" ON storage.objects;
CREATE POLICY "Read lead documents for visible leads" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'lead-documents' AND public.can_access_lead_object(name));
CREATE POLICY "Upload lead documents for visible leads" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lead-documents' AND public.can_access_lead_object(name));
CREATE POLICY "Delete lead documents for visible leads" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'lead-documents' AND public.can_access_lead_object(name));

-- Client request documents and RFQ quotations: require the matching permission.
DROP POLICY IF EXISTS "Authenticated upload client request documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read client request documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete client request documents" ON storage.objects;
CREATE POLICY "Client docs read by permission" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'client-request-documents' AND public.can_use('clients.use'));
CREATE POLICY "Client docs upload by permission" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-request-documents' AND public.can_use('clients.use'));
CREATE POLICY "Client docs delete by permission" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'client-request-documents' AND public.can_use('clients.use'));

DROP POLICY IF EXISTS "Authenticated users can view rfq quotation files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload rfq quotation files" ON storage.objects;
CREATE POLICY "RFQ files read by permission" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'rfq-quotations' AND public.can_use('rfq.use'));
CREATE POLICY "RFQ files upload by permission" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rfq-quotations' AND public.can_use('rfq.use'));

-- Call recordings: make the bucket private (playback goes through the cloudtalk-recording function).
UPDATE storage.buckets SET public = false WHERE id = 'call-recordings';
DROP POLICY IF EXISTS "Public read call recordings" ON storage.objects;
CREATE POLICY "Leadership reads call recordings" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'call-recordings' AND public.has_full_edit(auth.uid()));

-- Activity attachments: stop anonymous listing of the bucket. Existing public file URLs keep working
-- (public buckets serve objects by URL without a SELECT policy), but files can no longer be enumerated.
DROP POLICY IF EXISTS "Public read activity files" ON storage.objects;
