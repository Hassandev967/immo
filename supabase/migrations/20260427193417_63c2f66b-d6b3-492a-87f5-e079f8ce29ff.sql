
-- Fix search_path on triggers funcs
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.gen_numero_quittance()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero_quittance IS NULL OR NEW.numero_quittance = '' THEN
    NEW.numero_quittance := 'QT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quittance_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

-- Revoke public/anon EXECUTE on security definer functions
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
