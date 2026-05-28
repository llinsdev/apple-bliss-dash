
-- Cap commission_percentage to a sane range to prevent self-assigned inflated rates
ALTER TABLE public.sales
  ADD CONSTRAINT sales_commission_percentage_range
  CHECK (commission_percentage >= 0 AND commission_percentage <= 20);

-- Belt-and-suspenders: explicit restrictive policy preventing non-admins from inserting into user_roles
CREATE POLICY user_roles_insert_admin_only
  ON public.user_roles
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
