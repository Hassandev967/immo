
-- ============================================================
-- CORRECTIF : sync_recouvrement_on_paiement
-- L'ancienne version comptait le nombre d'enregistrements de
-- paiement (COUNT(*)), ce qui faisait traiter un paiement partiel
-- comme un mois soldé. La nouvelle version calcule le nombre de
-- mois dont le total encaissé est supérieur ou égal au loyer.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_recouvrement_on_paiement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_bail RECORD;
  v_mois_depuis_entree INT;
  v_mois_totalement_payes INT;
BEGIN
  SELECT * INTO v_bail FROM public.baux WHERE id = NEW.bail_id;
  IF v_bail IS NULL THEN RETURN NEW; END IF;

  -- Nombre de mois échus depuis l'entrée (inclut le mois courant)
  v_mois_depuis_entree := GREATEST(0,
    (date_part('year',  age(date_trunc('month', CURRENT_DATE), date_trunc('month', v_bail.date_entree))) * 12
   + date_part('month', age(date_trunc('month', CURRENT_DATE), date_trunc('month', v_bail.date_entree))))::int + 1);

  -- Nombre de mois dont le total encaissé couvre le loyer complet
  SELECT COUNT(*)
  INTO v_mois_totalement_payes
  FROM (
    SELECT mois_concerne, SUM(montant) AS total_mois
    FROM public.paiements
    WHERE bail_id = NEW.bail_id
    GROUP BY mois_concerne
    HAVING SUM(montant) >= v_bail.loyer_mensuel
  ) mois_soldes;

  -- Si tous les mois sont soldés et que le transfert juridique était proposé, l'annuler
  IF v_mois_totalement_payes >= v_mois_depuis_entree
     AND v_bail.transfert_juridique_propose = true
     AND v_bail.transfere_juridique_le IS NULL THEN
    UPDATE public.baux SET transfert_juridique_propose = false WHERE id = NEW.bail_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- INDEX DE PERFORMANCE
-- Optimise le calcul des impayés pour des portefeuilles larges
-- ============================================================

-- Recherche de tous les paiements d'un bail trié par mois (requête Recouvrement)
CREATE INDEX IF NOT EXISTS idx_paiements_bail_mois
  ON public.paiements (bail_id, mois_concerne);

-- Agrégation par bail et mois (somme des montants)
CREATE INDEX IF NOT EXISTS idx_paiements_montant
  ON public.paiements (bail_id, mois_concerne, montant);

-- Baux actifs sans transfert juridique (filtre principal de Recouvrement)
CREATE INDEX IF NOT EXISTS idx_baux_actif_non_transfere
  ON public.baux (statut, transfere_juridique_le)
  WHERE statut = 'actif' AND transfere_juridique_le IS NULL;

-- Audit logs : tri chronologique inverse (affichage du journal)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created
  ON public.audit_logs (created_at DESC);

-- Audit logs : recherche par table
CREATE INDEX IF NOT EXISTS idx_audit_logs_table
  ON public.audit_logs (table_name, created_at DESC);
