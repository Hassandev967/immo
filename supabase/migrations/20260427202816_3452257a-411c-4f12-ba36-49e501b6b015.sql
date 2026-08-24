DROP VIEW IF EXISTS public.v_users_admin;

CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE (
  id uuid,
  nom text,
  prenom text,
  telephone text,
  created_at timestamptz,
  roles text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    p.id, p.nom, p.prenom, p.telephone, p.created_at,
    COALESCE(array_agg(ur.role::text) FILTER (WHERE ur.role IS NOT NULL), '{}'::text[]) AS roles
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  GROUP BY p.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_users_with_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_users_with_roles() TO authenticated;