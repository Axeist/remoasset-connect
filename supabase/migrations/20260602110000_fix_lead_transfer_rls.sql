-- Lead transfer updates owner_id to another user. The existing UPDATE policy only
-- allowed rows where owner_id = auth.uid(), which fails the WITH CHECK on transfer
-- ("new row violates row-level security policy for table leads").

CREATE OR REPLACE FUNCTION public.user_is_lead_owner(p_lead_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads
    WHERE id = p_lead_id
      AND owner_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;

CREATE POLICY "Users can update their own leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR owner_id = auth.uid()
    OR public.user_is_lead_owner(id)
  );
