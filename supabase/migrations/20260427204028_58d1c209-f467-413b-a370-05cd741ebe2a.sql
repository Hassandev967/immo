-- Colonnes additionnelles bail
ALTER TABLE public.baux
  ADD COLUMN IF NOT EXISTS date_renouvellement_prevue date,
  ADD COLUMN IF NOT EXISTS assurance_date_expiration date,
  ADD COLUMN IF NOT EXISTS assurance_compagnie text,
  ADD COLUMN IF NOT EXISTS assurance_police text,
  ADD COLUMN IF NOT EXISTS garant_piece_expiration date,
  ADD COLUMN IF NOT EXISTS caution_montant_initial numeric,
  ADD COLUMN IF NOT EXISTS caution_montant_restant numeric,
  ADD COLUMN IF NOT EXISTS notes_renouvellement text;

-- Colonnes additionnelles locataire
ALTER TABLE public.locataires
  ADD COLUMN IF NOT EXISTS piece_date_expiration date,
  ADD COLUMN IF NOT EXISTS garant_prenom text,
  ADD COLUMN IF NOT EXISTS garant_email text,
  ADD COLUMN IF NOT EXISTS garant_piece_numero text,
  ADD COLUMN IF NOT EXISTS garant_employeur text;

-- Type de document
DO $$ BEGIN
  CREATE TYPE public.document_type AS ENUM ('bail','piece_identite','assurance','garant','caution','autre');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.document_statut AS ENUM ('valide','expirant','expire','manquant');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table documents
CREATE TABLE IF NOT EXISTS public.documents_locataire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bail_id uuid NOT NULL,
  locataire_id uuid NOT NULL,
  type public.document_type NOT NULL,
  libelle text NOT NULL,
  date_emission date,
  date_expiration date,
  fichier_url text,
  statut public.document_statut NOT NULL DEFAULT 'valide',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_bail ON public.documents_locataire(bail_id);
CREATE INDEX IF NOT EXISTS idx_docs_loc ON public.documents_locataire(locataire_id);
CREATE INDEX IF NOT EXISTS idx_docs_expiration ON public.documents_locataire(date_expiration);

ALTER TABLE public.documents_locataire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read documents" ON public.documents_locataire FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage documents" ON public.documents_locataire FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial') OR has_role(auth.uid(),'juridique'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial') OR has_role(auth.uid(),'juridique'));

CREATE TRIGGER documents_locataire_updated_at BEFORE UPDATE ON public.documents_locataire
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vue de classification des locataires (basée sur baux actifs)
CREATE OR REPLACE VIEW public.v_locataires_classification AS
WITH paiements_par_bail AS (
  SELECT bail_id, COALESCE(SUM(montant),0) AS total_paye, COUNT(*) AS nb_paiements
  FROM public.paiements
  GROUP BY bail_id
),
mois_dus AS (
  SELECT
    b.id AS bail_id,
    GREATEST(0, (DATE_PART('year', age(date_trunc('month', CURRENT_DATE), date_trunc('month', b.date_entree))) * 12
      + DATE_PART('month', age(date_trunc('month', CURRENT_DATE), date_trunc('month', b.date_entree))) + 1)::int) AS nb_mois_ecoules
  FROM public.baux b
)
SELECT
  b.id AS bail_id,
  b.reference AS bail_reference,
  b.statut AS bail_statut,
  b.date_entree,
  b.date_fin,
  b.loyer_mensuel,
  b.date_renouvellement_prevue,
  b.assurance_date_expiration,
  b.garant_piece_expiration,
  b.caution_montant_initial,
  b.caution_montant_restant,
  l.id AS locataire_id,
  l.nom AS locataire_nom,
  l.prenom AS locataire_prenom,
  l.telephone,
  l.email,
  l.piece_date_expiration,
  bi.reference AS bien_reference,
  bi.adresse AS bien_adresse,
  bi.commune AS bien_commune,
  COALESCE(p.total_paye,0) AS total_paye,
  m.nb_mois_ecoules,
  (m.nb_mois_ecoules * b.loyer_mensuel) AS total_du_theorique,
  GREATEST(0, (m.nb_mois_ecoules * b.loyer_mensuel) - COALESCE(p.total_paye,0)) AS solde_du,
  CASE
    WHEN COALESCE(p.total_paye,0) >= (m.nb_mois_ecoules * b.loyer_mensuel) THEN 'a_jour'
    WHEN ((m.nb_mois_ecoules * b.loyer_mensuel) - COALESCE(p.total_paye,0)) <= b.loyer_mensuel THEN 'leger_retard'
    ELSE 'en_retard'
  END AS statut_paiement,
  CASE
    WHEN b.date_fin IS NULL THEN 'sans_terme'
    WHEN b.date_fin < CURRENT_DATE THEN 'expire'
    WHEN b.date_fin <= CURRENT_DATE + INTERVAL '60 days' THEN 'a_renouveler'
    ELSE 'ok'
  END AS statut_bail,
  (
    (l.piece_date_expiration IS NOT NULL AND l.piece_date_expiration <= CURRENT_DATE + INTERVAL '60 days')
    OR (b.assurance_date_expiration IS NOT NULL AND b.assurance_date_expiration <= CURRENT_DATE + INTERVAL '60 days')
    OR (b.garant_piece_expiration IS NOT NULL AND b.garant_piece_expiration <= CURRENT_DATE + INTERVAL '60 days')
    OR (b.caution_montant_initial IS NOT NULL AND b.caution_montant_restant IS NOT NULL AND b.caution_montant_restant < b.caution_montant_initial)
  ) AS pieces_a_renouveler
FROM public.baux b
JOIN public.locataires l ON l.id = b.locataire_id
JOIN public.biens bi ON bi.id = b.bien_id
LEFT JOIN paiements_par_bail p ON p.bail_id = b.id
LEFT JOIN mois_dus m ON m.bail_id = b.id
WHERE b.statut = 'actif';

GRANT SELECT ON public.v_locataires_classification TO authenticated;

-- Bucket documents (privé)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents','documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth read documents bucket" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Auth upload documents bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Auth update documents bucket" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Auth delete documents bucket" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');