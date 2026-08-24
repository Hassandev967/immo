-- Nettoyage défensif
DELETE FROM public.paiements WHERE bail_id NOT IN (SELECT id FROM public.baux);
DELETE FROM public.documents_locataire WHERE locataire_id NOT IN (SELECT id FROM public.locataires);
DELETE FROM public.documents_locataire WHERE bail_id NOT IN (SELECT id FROM public.baux);
DELETE FROM public.pieces_locataire WHERE locataire_id NOT IN (SELECT id FROM public.locataires);
DELETE FROM public.factures_entree WHERE bien_id NOT IN (SELECT id FROM public.biens);
UPDATE public.factures_entree SET bail_id = NULL WHERE bail_id IS NOT NULL AND bail_id NOT IN (SELECT id FROM public.baux);
DELETE FROM public.reversements WHERE proprietaire_id NOT IN (SELECT id FROM public.proprietaires);
DELETE FROM public.relances_envoyees WHERE bail_id NOT IN (SELECT id FROM public.baux);
DELETE FROM public.mises_en_demeure WHERE bail_id NOT IN (SELECT id FROM public.baux);
DELETE FROM public.frais_juridiques WHERE bail_id NOT IN (SELECT id FROM public.baux);
DELETE FROM public.procedures WHERE bail_id NOT IN (SELECT id FROM public.baux);
UPDATE public.courriers_recus SET bail_id = NULL WHERE bail_id IS NOT NULL AND bail_id NOT IN (SELECT id FROM public.baux);
UPDATE public.courriers_recus SET locataire_id = NULL WHERE locataire_id IS NOT NULL AND locataire_id NOT IN (SELECT id FROM public.locataires);
UPDATE public.courriers_juridiques SET bail_id = NULL WHERE bail_id IS NOT NULL AND bail_id NOT IN (SELECT id FROM public.baux);
UPDATE public.courriers_juridiques SET locataire_id = NULL WHERE locataire_id IS NOT NULL AND locataire_id NOT IN (SELECT id FROM public.locataires);
DELETE FROM public.candidatures WHERE bien_id NOT IN (SELECT id FROM public.biens) OR prospect_id NOT IN (SELECT id FROM public.prospects);
DELETE FROM public.visites WHERE bien_id NOT IN (SELECT id FROM public.biens) OR prospect_id NOT IN (SELECT id FROM public.prospects);

-- Foreign Keys
DO $$ BEGIN ALTER TABLE public.biens ADD CONSTRAINT biens_proprietaire_fk FOREIGN KEY (proprietaire_id) REFERENCES public.proprietaires(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.baux ADD CONSTRAINT baux_bien_fk FOREIGN KEY (bien_id) REFERENCES public.biens(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.baux ADD CONSTRAINT baux_locataire_fk FOREIGN KEY (locataire_id) REFERENCES public.locataires(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.paiements ADD CONSTRAINT paiements_bail_fk FOREIGN KEY (bail_id) REFERENCES public.baux(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.documents_locataire ADD CONSTRAINT documents_locataire_fk FOREIGN KEY (locataire_id) REFERENCES public.locataires(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.documents_locataire ADD CONSTRAINT documents_bail_fk FOREIGN KEY (bail_id) REFERENCES public.baux(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.pieces_locataire ADD CONSTRAINT pieces_locataire_fk FOREIGN KEY (locataire_id) REFERENCES public.locataires(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.reversements ADD CONSTRAINT reversements_proprietaire_fk FOREIGN KEY (proprietaire_id) REFERENCES public.proprietaires(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.relances_envoyees ADD CONSTRAINT relances_bail_fk FOREIGN KEY (bail_id) REFERENCES public.baux(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.mises_en_demeure ADD CONSTRAINT med_bail_fk FOREIGN KEY (bail_id) REFERENCES public.baux(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.frais_juridiques ADD CONSTRAINT frais_bail_fk FOREIGN KEY (bail_id) REFERENCES public.baux(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.procedures ADD CONSTRAINT procedures_bail_fk FOREIGN KEY (bail_id) REFERENCES public.baux(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.courriers_recus ADD CONSTRAINT courriers_recus_bail_fk FOREIGN KEY (bail_id) REFERENCES public.baux(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.courriers_recus ADD CONSTRAINT courriers_recus_locataire_fk FOREIGN KEY (locataire_id) REFERENCES public.locataires(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.courriers_juridiques ADD CONSTRAINT courriers_jur_bail_fk FOREIGN KEY (bail_id) REFERENCES public.baux(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.courriers_juridiques ADD CONSTRAINT courriers_jur_locataire_fk FOREIGN KEY (locataire_id) REFERENCES public.locataires(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.candidatures ADD CONSTRAINT candidatures_bien_fk FOREIGN KEY (bien_id) REFERENCES public.biens(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.candidatures ADD CONSTRAINT candidatures_prospect_fk FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.visites ADD CONSTRAINT visites_bien_fk FOREIGN KEY (bien_id) REFERENCES public.biens(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.visites ADD CONSTRAINT visites_prospect_fk FOREIGN KEY (prospect_id) REFERENCES public.prospects(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.factures_entree ADD CONSTRAINT factures_bien_fk FOREIGN KEY (bien_id) REFERENCES public.biens(id) ON DELETE RESTRICT; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.factures_entree ADD CONSTRAINT factures_bail_fk FOREIGN KEY (bail_id) REFERENCES public.baux(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_biens_proprietaire ON public.biens(proprietaire_id);
CREATE INDEX IF NOT EXISTS idx_baux_bien ON public.baux(bien_id);
CREATE INDEX IF NOT EXISTS idx_baux_locataire ON public.baux(locataire_id);
CREATE INDEX IF NOT EXISTS idx_paiements_bail ON public.paiements(bail_id);
CREATE INDEX IF NOT EXISTS idx_paiements_mois ON public.paiements(mois_concerne);
CREATE INDEX IF NOT EXISTS idx_pieces_locataire ON public.pieces_locataire(locataire_id);
CREATE INDEX IF NOT EXISTS idx_reversements_prop ON public.reversements(proprietaire_id);
CREATE INDEX IF NOT EXISTS idx_relances_bail ON public.relances_envoyees(bail_id);

-- Sync bien statut depuis bail (utilise valeurs enum réelles : vacant/occupe/travaux)
CREATE OR REPLACE FUNCTION public.sync_bien_statut_from_bail()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.statut::text = 'actif' THEN
      UPDATE public.biens SET statut = 'occupe'::bien_statut WHERE id = NEW.bien_id AND statut <> 'travaux'::bien_statut;
    ELSIF NEW.statut::text IN ('termine','resilie','expire') THEN
      IF NOT EXISTS (SELECT 1 FROM public.baux WHERE bien_id = NEW.bien_id AND statut::text='actif' AND id <> NEW.id) THEN
        UPDATE public.biens SET statut = 'vacant'::bien_statut WHERE id = NEW.bien_id AND statut <> 'travaux'::bien_statut;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_bien_statut ON public.baux;
CREATE TRIGGER trg_sync_bien_statut
AFTER INSERT OR UPDATE OF statut ON public.baux
FOR EACH ROW EXECUTE FUNCTION public.sync_bien_statut_from_bail();

-- Sync recouvrement après encaissement
CREATE OR REPLACE FUNCTION public.sync_recouvrement_on_paiement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_bail RECORD;
  v_mois_dus INT;
  v_mois_payes INT;
BEGIN
  SELECT * INTO v_bail FROM public.baux WHERE id = NEW.bail_id;
  IF v_bail IS NULL THEN RETURN NEW; END IF;

  v_mois_dus := GREATEST(0,
    (date_part('year', age(date_trunc('month', CURRENT_DATE), date_trunc('month', v_bail.date_entree))) * 12
   + date_part('month', age(date_trunc('month', CURRENT_DATE), date_trunc('month', v_bail.date_entree))))::int + 1);

  SELECT COUNT(*) INTO v_mois_payes FROM public.paiements WHERE bail_id = NEW.bail_id;

  IF v_mois_payes >= v_mois_dus AND v_bail.transfert_juridique_propose = true AND v_bail.transfere_juridique_le IS NULL THEN
    UPDATE public.baux SET transfert_juridique_propose = false WHERE id = NEW.bail_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_recouvrement ON public.paiements;
CREATE TRIGGER trg_sync_recouvrement
AFTER INSERT ON public.paiements
FOR EACH ROW EXECUTE FUNCTION public.sync_recouvrement_on_paiement();

-- Backfill statuts biens
UPDATE public.biens b SET statut = 'occupe'::bien_statut
  WHERE statut <> 'travaux'::bien_statut
    AND EXISTS (SELECT 1 FROM public.baux WHERE bien_id = b.id AND statut::text = 'actif');
UPDATE public.biens b SET statut = 'vacant'::bien_statut
  WHERE statut = 'occupe'::bien_statut
    AND NOT EXISTS (SELECT 1 FROM public.baux WHERE bien_id = b.id AND statut::text = 'actif');

-- Vues 360°
CREATE OR REPLACE VIEW public.v_locataire_360 AS
SELECT
  l.id AS locataire_id,
  l.reference, l.nom, l.prenom, l.raison_sociale, l.type_personne, l.telephone, l.email,
  COUNT(DISTINCT b.id) AS nb_baux,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut::text='actif') AS nb_baux_actifs,
  COALESCE(SUM(b.loyer_mensuel) FILTER (WHERE b.statut::text='actif'), 0) AS loyer_total_mensuel,
  COALESCE((SELECT SUM(p.montant) FROM public.paiements p JOIN public.baux b2 ON b2.id=p.bail_id WHERE b2.locataire_id=l.id), 0) AS total_paye
FROM public.locataires l
LEFT JOIN public.baux b ON b.locataire_id = l.id
GROUP BY l.id;

CREATE OR REPLACE VIEW public.v_proprietaire_360 AS
SELECT
  pr.id AS proprietaire_id,
  pr.numero_gestion, pr.nom, pr.type_personne, pr.telephone, pr.email, pr.taux_honoraires,
  COUNT(DISTINCT bi.id) AS nb_biens,
  COUNT(DISTINCT bi.id) FILTER (WHERE bi.statut = 'occupe'::bien_statut) AS nb_biens_loues,
  COUNT(DISTINCT b.id) FILTER (WHERE b.statut::text='actif') AS nb_baux_actifs,
  COALESCE(SUM(b.loyer_mensuel) FILTER (WHERE b.statut::text='actif'), 0) AS revenu_mensuel_brut,
  COALESCE((SELECT SUM(r.net_a_reverser) FROM public.reversements r WHERE r.proprietaire_id = pr.id), 0) AS total_reverse
FROM public.proprietaires pr
LEFT JOIN public.biens bi ON bi.proprietaire_id = pr.id
LEFT JOIN public.baux b ON b.bien_id = bi.id
GROUP BY pr.id;