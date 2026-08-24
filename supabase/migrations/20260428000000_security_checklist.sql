
-- ============================================================
-- SÉCURITÉ : JOURNAL D'AUDIT, PROTECTION DONNÉES, TRANSFERT JURIDIQUE
-- Guide de vérification et de sécurité — Checklist opérationnelle
-- ============================================================

-- ============================================================
-- 1. TABLE D'AUDIT (journal non modifiable, INSERT-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  TEXT        NOT NULL,
  record_id   UUID,
  action      TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_fields TEXT[]   DEFAULT '{}',
  old_values  JSONB,
  new_values  JSONB,
  user_id     UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Lecture : admin et direction uniquement
CREATE POLICY "Admin/Direction read audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction'));

-- Insertion : via triggers (SECURITY DEFINER) ou par utilisateurs authentifiés
-- AUCUNE politique UPDATE ou DELETE → immuable par design

-- Fonction trigger d'audit générique
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old JSONB := NULL;
  v_new JSONB := NULL;
  v_changed TEXT[] := '{}';
  v_record_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_record_id := (v_old->>'id')::uuid;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
    SELECT array_agg(key ORDER BY key)
    INTO v_changed
    FROM jsonb_each(v_new) kv
    WHERE (v_new->kv.key) IS DISTINCT FROM (v_old->kv.key);
    v_changed := COALESCE(v_changed, '{}');
  END IF;

  INSERT INTO public.audit_logs (table_name, record_id, action, changed_fields, old_values, new_values, user_id)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, v_changed, v_old, v_new, auth.uid());

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_audit() FROM PUBLIC, anon, authenticated;

-- Audit sur les baux (loyer, transfert juridique)
DROP TRIGGER IF EXISTS trg_audit_baux ON public.baux;
CREATE TRIGGER trg_audit_baux
  AFTER INSERT OR UPDATE OR DELETE ON public.baux
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Audit sur les paiements
DROP TRIGGER IF EXISTS trg_audit_paiements ON public.paiements;
CREATE TRIGGER trg_audit_paiements
  AFTER INSERT OR DELETE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- Audit sur les modèles de courriers (traçabilité des modifications de modèles)
DROP TRIGGER IF EXISTS trg_audit_modeles_courrier ON public.modeles_courrier;
CREATE TRIGGER trg_audit_modeles_courrier
  AFTER INSERT OR UPDATE OR DELETE ON public.modeles_courrier
  FOR EACH ROW EXECUTE FUNCTION public.log_audit();

-- ============================================================
-- 2. PROTECTION DES DONNÉES PROPRIÉTAIRES
--    RIB et taux_honoraires invisibles pour les rôles non financiers
-- ============================================================

-- Seed field_permissions : masquer rib et taux_honoraires pour commercial / caisse / recouvrement / juridique
INSERT INTO public.field_permissions (role, module, field, visible, editable, required)
VALUES
  ('commercial',   'proprietaires', 'rib',              false, false, false),
  ('commercial',   'proprietaires', 'taux_honoraires',  false, false, false),
  ('caisse',       'proprietaires', 'rib',              false, false, false),
  ('caisse',       'proprietaires', 'taux_honoraires',  false, false, false),
  ('recouvrement', 'proprietaires', 'rib',              false, false, false),
  ('recouvrement', 'proprietaires', 'taux_honoraires',  false, false, false),
  ('juridique',    'proprietaires', 'rib',              false, false, false),
  ('juridique',    'proprietaires', 'taux_honoraires',  false, false, false)
ON CONFLICT (role, module, field) DO UPDATE
  SET visible = EXCLUDED.visible, editable = EXCLUDED.editable;

-- ============================================================
-- 3. PROTECTION DES MODÈLES SYSTÈME
--    Les modèles système (systeme=true) ne peuvent être modifiés
--    que par admin et direction. Le rôle juridique peut gérer
--    uniquement ses modèles personnalisés.
-- ============================================================

-- Supprimer l'ancienne politique trop permissive pour juridique sur les systèmes
DROP POLICY IF EXISTS "Manage modeles_courrier" ON public.modeles_courrier;

-- Admin et direction : gestion complète (y compris modèles système)
CREATE POLICY "Admin/Direction manage modeles_courrier" ON public.modeles_courrier
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'direction')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'direction')
  );

-- Juridique : peut créer/modifier/supprimer ses propres modèles (systeme=false uniquement)
CREATE POLICY "Juridique manage custom modeles_courrier" ON public.modeles_courrier
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'juridique') AND systeme = false
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'juridique') AND systeme = false
  );

-- ============================================================
-- 4. TRANSFERT IRRÉVERSIBLE AU JURIDIQUE
--    Fonction SECURITY DEFINER pour que le rôle recouvrement
--    puisse déclencher le transfert sans accès général aux baux.
-- ============================================================

CREATE OR REPLACE FUNCTION public.transferer_au_juridique(p_bail_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vérification des droits : admin, direction ou recouvrement
  IF NOT (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'direction') OR
    public.has_role(auth.uid(), 'recouvrement')
  ) THEN
    RAISE EXCEPTION 'Permission refusée : seuls admin, direction et recouvrement peuvent transférer un dossier au juridique';
  END IF;

  -- Transfert irréversible : on ne peut transférer que si pas encore transféré
  UPDATE public.baux
  SET
    transfere_juridique_le       = CURRENT_DATE,
    transfert_juridique_propose  = true
  WHERE
    id = p_bail_id
    AND statut = 'actif'
    AND transfere_juridique_le IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bail introuvable, déjà transféré, ou non actif';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transferer_au_juridique(UUID) TO authenticated;

-- ============================================================
-- 5. MODULE AUDIT_LOG dans role_permissions (lecture admin/direction)
-- ============================================================

INSERT INTO public.role_permissions (role, module, can_view, can_create, can_edit, can_delete)
VALUES
  ('admin',     'audit_log', true,  false, false, false),
  ('direction', 'audit_log', true,  false, false, false)
ON CONFLICT (role, module) DO NOTHING;
