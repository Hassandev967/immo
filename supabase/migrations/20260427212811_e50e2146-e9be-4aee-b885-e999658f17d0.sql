
ALTER TABLE public.courriers_recus
  ADD COLUMN IF NOT EXISTS redige_par uuid,
  ADD COLUMN IF NOT EXISTS redaction_html text,
  ADD COLUMN IF NOT EXISTS valide_par uuid,
  ADD COLUMN IF NOT EXISTS valide_le timestamptz,
  ADD COLUMN IF NOT EXISTS modele_reponse_id uuid;

-- Catégorie "réponse au locataire" pour les courriers générés
DO $$ BEGIN
  ALTER TYPE courrier_categorie ADD VALUE IF NOT EXISTS 'reponse_locataire';
EXCEPTION WHEN others THEN NULL; END $$;
