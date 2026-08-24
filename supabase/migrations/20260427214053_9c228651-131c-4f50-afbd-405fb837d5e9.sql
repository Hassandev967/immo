
-- Type de personne sur locataires
ALTER TABLE public.locataires 
  ADD COLUMN IF NOT EXISTS type_personne text NOT NULL DEFAULT 'physique',
  ADD COLUMN IF NOT EXISTS raison_sociale text,
  ADD COLUMN IF NOT EXISTS rccm text,
  ADD COLUMN IF NOT EXISTS nif text;

-- Table pièces locataire (indépendante d'un bail)
CREATE TABLE IF NOT EXISTS public.pieces_locataire (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locataire_id uuid NOT NULL REFERENCES public.locataires(id) ON DELETE CASCADE,
  type_document text NOT NULL,
  libelle text NOT NULL,
  fichier_url text NOT NULL,
  date_emission date,
  date_expiration date,
  notes text,
  cree_par uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pieces_locataire_loc ON public.pieces_locataire(locataire_id);

ALTER TABLE public.pieces_locataire ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read pieces locataire" ON public.pieces_locataire
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage pieces locataire" ON public.pieces_locataire
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial') OR has_role(auth.uid(),'caisse') OR has_role(auth.uid(),'juridique'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'commercial') OR has_role(auth.uid(),'caisse') OR has_role(auth.uid(),'juridique'));

CREATE TRIGGER trg_pieces_locataire_updated
  BEFORE UPDATE ON public.pieces_locataire
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies pour bucket "documents" (privé) — dossier locataires/
DO $$ BEGIN
  CREATE POLICY "Auth read documents bucket" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth upload documents bucket" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth update documents bucket" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Auth delete documents bucket" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
