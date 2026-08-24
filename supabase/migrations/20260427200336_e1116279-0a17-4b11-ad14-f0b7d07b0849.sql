-- ============================================================
-- MODULE COMMERCIAL
-- ============================================================
CREATE TYPE public.prospect_statut AS ENUM (
  'nouveau','contacte','visite_planifiee','visite_effectuee',
  'candidature','accepte','refuse','perdu'
);

CREATE TYPE public.visite_statut AS ENUM ('planifiee','effectuee','annulee','no_show');

CREATE TYPE public.candidature_statut AS ENUM ('en_etude','acceptee','refusee','convertie');

CREATE TYPE public.facture_entree_statut AS ENUM ('brouillon','emise','payee','annulee');

CREATE TABLE public.prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  prenom text,
  telephone text,
  email text,
  budget_max numeric,
  type_recherche text,
  commune_recherche text,
  statut prospect_statut NOT NULL DEFAULT 'nouveau',
  source text,
  notes text,
  assigne_a uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.visites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  bien_id uuid NOT NULL REFERENCES public.biens(id) ON DELETE CASCADE,
  date_visite timestamptz NOT NULL,
  statut visite_statut NOT NULL DEFAULT 'planifiee',
  commentaire text,
  agent_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.candidatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  bien_id uuid NOT NULL REFERENCES public.biens(id) ON DELETE CASCADE,
  revenus_mensuels numeric,
  employeur text,
  garant_nom text,
  garant_telephone text,
  pieces_jointes jsonb NOT NULL DEFAULT '[]'::jsonb,
  statut candidature_statut NOT NULL DEFAULT 'en_etude',
  decision_motif text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.facture_entree_seq START 1;

CREATE TABLE public.factures_entree (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  candidature_id uuid REFERENCES public.candidatures(id) ON DELETE SET NULL,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  bien_id uuid NOT NULL REFERENCES public.biens(id),
  loyer_mensuel numeric NOT NULL,
  caution numeric NOT NULL DEFAULT 0,
  avance_loyer numeric NOT NULL DEFAULT 0,
  commission_agence numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL,
  statut facture_entree_statut NOT NULL DEFAULT 'brouillon',
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  date_paiement date,
  bail_id uuid REFERENCES public.baux(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facture_caution_max CHECK (caution <= loyer_mensuel * 2),
  CONSTRAINT facture_avance_max CHECK (avance_loyer <= loyer_mensuel * 2),
  CONSTRAINT facture_commission_max CHECK (commission_agence <= loyer_mensuel)
);

CREATE OR REPLACE FUNCTION public.gen_numero_facture_entree()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'FE-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.facture_entree_seq')::text,6,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_facture_entree_numero
  BEFORE INSERT ON public.factures_entree
  FOR EACH ROW EXECUTE FUNCTION public.gen_numero_facture_entree();

CREATE TRIGGER trg_prospects_updated BEFORE UPDATE ON public.prospects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_visites_updated BEFORE UPDATE ON public.visites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_candidatures_updated BEFORE UPDATE ON public.candidatures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_factures_entree_updated BEFORE UPDATE ON public.factures_entree FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- MODULE PROPRIETAIRES (reddition + reversements)
-- ============================================================
CREATE TYPE public.reversement_statut AS ENUM ('a_payer','paye','annule');

CREATE TABLE public.reversements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietaire_id uuid NOT NULL REFERENCES public.proprietaires(id) ON DELETE CASCADE,
  mois_concerne date NOT NULL,
  total_encaisse numeric NOT NULL DEFAULT 0,
  honoraires numeric NOT NULL DEFAULT 0,
  charges_deduites numeric NOT NULL DEFAULT 0,
  net_a_reverser numeric NOT NULL DEFAULT 0,
  statut reversement_statut NOT NULL DEFAULT 'a_payer',
  date_paiement date,
  mode_paiement text,
  reference_externe text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proprietaire_id, mois_concerne)
);

CREATE TRIGGER trg_reversements_updated BEFORE UPDATE ON public.reversements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- MODULE JURIDIQUE
-- ============================================================
CREATE TYPE public.med_statut AS ENUM ('brouillon','envoyee','recue','sans_reponse','regularisee','escaladee');
CREATE TYPE public.procedure_type AS ENUM ('commandement','assignation','jugement','expulsion','autre');
CREATE TYPE public.procedure_statut AS ENUM ('en_cours','suspendue','close_favorable','close_defavorable');
CREATE TYPE public.frais_type AS ENUM ('huissier','avocat','greffe','autre');

CREATE SEQUENCE IF NOT EXISTS public.med_seq START 1;

CREATE TABLE public.mises_en_demeure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  bail_id uuid NOT NULL REFERENCES public.baux(id) ON DELETE CASCADE,
  date_emission date NOT NULL DEFAULT CURRENT_DATE,
  montant_du numeric NOT NULL,
  nb_mois_retard integer NOT NULL,
  delai_jours integer NOT NULL DEFAULT 15,
  statut med_statut NOT NULL DEFAULT 'brouillon',
  date_envoi date,
  mode_envoi text,
  date_reponse date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.gen_numero_med()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'MED-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.med_seq')::text,5,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_med_numero BEFORE INSERT ON public.mises_en_demeure FOR EACH ROW EXECUTE FUNCTION public.gen_numero_med();
CREATE TRIGGER trg_med_updated BEFORE UPDATE ON public.mises_en_demeure FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.procedures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bail_id uuid NOT NULL REFERENCES public.baux(id) ON DELETE CASCADE,
  med_id uuid REFERENCES public.mises_en_demeure(id) ON DELETE SET NULL,
  type procedure_type NOT NULL,
  statut procedure_statut NOT NULL DEFAULT 'en_cours',
  date_debut date NOT NULL DEFAULT CURRENT_DATE,
  date_audience date,
  date_cloture date,
  juridiction text,
  reference_dossier text,
  avocat text,
  huissier text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_procedures_updated BEFORE UPDATE ON public.procedures FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.frais_juridiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid REFERENCES public.procedures(id) ON DELETE CASCADE,
  bail_id uuid NOT NULL REFERENCES public.baux(id) ON DELETE CASCADE,
  type frais_type NOT NULL,
  libelle text NOT NULL,
  montant numeric NOT NULL,
  date_frais date NOT NULL DEFAULT CURRENT_DATE,
  imputable_locataire boolean NOT NULL DEFAULT true,
  paye boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_frais_updated BEFORE UPDATE ON public.frais_juridiques FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factures_entree ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reversements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mises_en_demeure ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frais_juridiques ENABLE ROW LEVEL SECURITY;

-- Commercial : commercial + admin + direction
CREATE POLICY "Read prospects" ON public.prospects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage prospects" ON public.prospects FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial'));

CREATE POLICY "Read visites" ON public.visites FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage visites" ON public.visites FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial'));

CREATE POLICY "Read candidatures" ON public.candidatures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage candidatures" ON public.candidatures FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial'));

CREATE POLICY "Read factures_entree" ON public.factures_entree FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage factures_entree" ON public.factures_entree FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial') OR has_role(auth.uid(),'caisse'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial') OR has_role(auth.uid(),'caisse'));

-- Reversements : admin + direction
CREATE POLICY "Read reversements" ON public.reversements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage reversements" ON public.reversements FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction'));

-- Juridique : juridique + admin + direction
CREATE POLICY "Read med" ON public.mises_en_demeure FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage med" ON public.mises_en_demeure FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique') OR has_role(auth.uid(),'recouvrement'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique') OR has_role(auth.uid(),'recouvrement'));

CREATE POLICY "Read procedures" ON public.procedures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage procedures" ON public.procedures FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'));

CREATE POLICY "Read frais" ON public.frais_juridiques FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage frais" ON public.frais_juridiques FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'));