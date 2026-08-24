
-- 1. Numero de gestion proprietaires
CREATE SEQUENCE IF NOT EXISTS public.gestion_seq START 1;
ALTER TABLE public.proprietaires ADD COLUMN IF NOT EXISTS numero_gestion text UNIQUE;

CREATE OR REPLACE FUNCTION public.gen_numero_gestion()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.numero_gestion IS NULL OR NEW.numero_gestion = '' THEN
    NEW.numero_gestion := 'GES-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.gestion_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_gen_numero_gestion ON public.proprietaires;
CREATE TRIGGER trg_gen_numero_gestion
BEFORE INSERT ON public.proprietaires
FOR EACH ROW EXECUTE FUNCTION public.gen_numero_gestion();

UPDATE public.proprietaires
SET numero_gestion = 'GES-' || to_char(created_at,'YYYY') || '-' || lpad(nextval('public.gestion_seq')::text, 4, '0')
WHERE numero_gestion IS NULL;

-- 2. Baux
ALTER TABLE public.baux
  ADD COLUMN IF NOT EXISTS jour_tolerance integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS jour_penalite integer NOT NULL DEFAULT 11,
  ADD COLUMN IF NOT EXISTS taux_penalite_journalier numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS penalite_base text NOT NULL DEFAULT 'loyer' CHECK (penalite_base IN ('loyer','fixe')),
  ADD COLUMN IF NOT EXISTS etat_lieux_fait boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS etat_lieux_date date,
  ADD COLUMN IF NOT EXISTS cles_remises_le date,
  ADD COLUMN IF NOT EXISTS transfere_juridique_le date,
  ADD COLUMN IF NOT EXISTS transfert_juridique_propose boolean NOT NULL DEFAULT false;

-- 3. Candidatures
ALTER TYPE candidature_statut ADD VALUE IF NOT EXISTS 'validee_responsable';

ALTER TABLE public.candidatures
  ADD COLUMN IF NOT EXISTS validee_par uuid,
  ADD COLUMN IF NOT EXISTS validee_le timestamptz;

-- 4. Modes de paiement (enum réel = mode_paiement)
ALTER TYPE mode_paiement ADD VALUE IF NOT EXISTS 'mobile_money_om';
ALTER TYPE mode_paiement ADD VALUE IF NOT EXISTS 'mobile_money_moov';
ALTER TYPE mode_paiement ADD VALUE IF NOT EXISTS 'versement_bancaire';

-- 5. Courriers reçus
DO $$ BEGIN
  CREATE TYPE courrier_recu_categorie AS ENUM ('preavis_depart','reclamation','demande_travaux','demande_information','contestation','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE courrier_recu_statut AS ENUM ('recu','en_traitement','reponse_envoyee','clos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.courriers_recus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bail_id uuid,
  locataire_id uuid,
  categorie courrier_recu_categorie NOT NULL,
  objet text NOT NULL,
  contenu text,
  date_reception date NOT NULL DEFAULT CURRENT_DATE,
  date_effet date,
  fichier_url text,
  statut courrier_recu_statut NOT NULL DEFAULT 'recu',
  affecte_a uuid,
  reponse_courrier_id uuid,
  notes text,
  cree_par uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.courriers_recus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read courriers recus" ON public.courriers_recus;
CREATE POLICY "Read courriers recus" ON public.courriers_recus
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Manage courriers recus" ON public.courriers_recus;
CREATE POLICY "Manage courriers recus" ON public.courriers_recus
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'));

DROP TRIGGER IF EXISTS trg_courriers_recus_updated ON public.courriers_recus;
CREATE TRIGGER trg_courriers_recus_updated
BEFORE UPDATE ON public.courriers_recus
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Vue calcul retards
CREATE OR REPLACE VIEW public.v_loyers_retard AS
WITH paiements_par_mois AS (
  SELECT bail_id, date_trunc('month', mois_concerne)::date AS mois, SUM(montant) AS paye
  FROM public.paiements GROUP BY bail_id, date_trunc('month', mois_concerne)
)
SELECT
  b.id AS bail_id, b.reference, b.locataire_id, b.bien_id, b.loyer_mensuel,
  b.jour_echeance, b.jour_tolerance, b.jour_penalite, b.taux_penalite_journalier, b.penalite_base,
  b.transfere_juridique_le, b.transfert_juridique_propose,
  GREATEST(0, (
    SELECT COUNT(*) FROM generate_series(
      date_trunc('month', b.date_entree)::date,
      date_trunc('month', CURRENT_DATE)::date,
      interval '1 month'
    ) m(mois)
    WHERE COALESCE((SELECT paye FROM paiements_par_mois p WHERE p.bail_id = b.id AND p.mois = m.mois::date), 0) < b.loyer_mensuel
      AND (m.mois::date + (b.jour_echeance - 1) * interval '1 day')::date <= CURRENT_DATE
  )) AS mois_retard,
  GREATEST(0,
    EXTRACT(DAY FROM CURRENT_DATE - (date_trunc('month', CURRENT_DATE)::date + (b.jour_penalite - 1) * interval '1 day'))::int
  ) AS jours_penalite_mois_courant
FROM public.baux b
WHERE b.statut = 'actif';
