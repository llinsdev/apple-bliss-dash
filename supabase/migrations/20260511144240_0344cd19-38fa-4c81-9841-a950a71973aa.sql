-- 1) Performance index
CREATE INDEX IF NOT EXISTS sales_seller_date_idx
  ON public.sales (seller_id, sale_date DESC);

-- 2) Seller ERP mapping
CREATE TABLE public.seller_erp_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  erp_source text NOT NULL DEFAULT 'bling',
  erp_seller_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (erp_source, erp_seller_id)
);

ALTER TABLE public.seller_erp_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "seller_erp_map_admin_all"
ON public.seller_erp_map FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "seller_erp_map_select_own"
ON public.seller_erp_map FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- 3) Ingest log
CREATE TABLE public.sales_ingest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  erp_source text NOT NULL DEFAULT 'bling',
  erp_order_id text NOT NULL,
  status text NOT NULL,
  error text,
  sale_id uuid,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (erp_source, erp_order_id)
);

ALTER TABLE public.sales_ingest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales_ingest_log_admin_all"
ON public.sales_ingest_log FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));