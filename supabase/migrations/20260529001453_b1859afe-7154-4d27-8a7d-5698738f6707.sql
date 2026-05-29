-- Fix 1: Remove sales from realtime publication to prevent cross-seller subscription leaks
ALTER PUBLICATION supabase_realtime DROP TABLE public.sales;

-- Fix 2: Restrict sales UPDATE to admins only (prevents sellers from editing
-- their own sales to inflate commission_percentage, sale_value, etc.)
DROP POLICY IF EXISTS sales_update_own_or_admin ON public.sales;

CREATE POLICY sales_update_admin_only
ON public.sales
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));