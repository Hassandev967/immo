-- Audit logs table (immutable trace)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL,
  changed_fields TEXT[],
  old_values JSONB,
  new_values JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Direction read audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction'));

CREATE POLICY "System insert audit logs"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (true);

-- No update / delete policies => immutable

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON public.audit_logs(table_name);

-- RPC: transfer a lease to juridique
CREATE OR REPLACE FUNCTION public.transferer_au_juridique(p_bail_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'direction')
       OR public.has_role(auth.uid(), 'recouvrement')
       OR public.has_role(auth.uid(), 'juridique')) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  UPDATE public.baux
     SET transfert_juridique_propose = true,
         transfere_juridique_le = COALESCE(transfere_juridique_le, CURRENT_DATE)
   WHERE id = p_bail_id;

  INSERT INTO public.audit_logs(table_name, record_id, action, changed_fields, user_id)
  VALUES ('baux', p_bail_id, 'UPDATE', ARRAY['transfere_juridique_le','transfert_juridique_propose'], auth.uid());
END;
$$;