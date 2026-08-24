
-- Séquences
CREATE SEQUENCE IF NOT EXISTS public.bien_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.bail_seq START 1;
CREATE SEQUENCE IF NOT EXISTS public.locataire_seq START 1;

-- Colonne référence locataires
ALTER TABLE public.locataires ADD COLUMN IF NOT EXISTS reference text;

-- Fonctions
CREATE OR REPLACE FUNCTION public.gen_reference_bien()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'BIEN-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.bien_seq')::text,4,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.gen_reference_bail()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'BAIL-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.bail_seq')::text,4,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.gen_reference_locataire()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'LOC-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.locataire_seq')::text,4,'0');
  END IF;
  RETURN NEW;
END $$;

-- Triggers
DROP TRIGGER IF EXISTS trg_gen_reference_bien ON public.biens;
CREATE TRIGGER trg_gen_reference_bien BEFORE INSERT ON public.biens
  FOR EACH ROW EXECUTE FUNCTION public.gen_reference_bien();

DROP TRIGGER IF EXISTS trg_gen_reference_bail ON public.baux;
CREATE TRIGGER trg_gen_reference_bail BEFORE INSERT ON public.baux
  FOR EACH ROW EXECUTE FUNCTION public.gen_reference_bail();

DROP TRIGGER IF EXISTS trg_gen_reference_locataire ON public.locataires;
CREATE TRIGGER trg_gen_reference_locataire BEFORE INSERT ON public.locataires
  FOR EACH ROW EXECUTE FUNCTION public.gen_reference_locataire();

-- Rendre nullable
ALTER TABLE public.biens ALTER COLUMN reference DROP NOT NULL;
ALTER TABLE public.baux ALTER COLUMN reference DROP NOT NULL;

-- Backfill des locataires existants
UPDATE public.locataires SET reference = 'LOC-' || to_char(created_at,'YYYY') || '-' || lpad(nextval('public.locataire_seq')::text,4,'0')
WHERE reference IS NULL OR reference = '';

-- Aligner les séquences sur l'existant
SELECT setval('public.bien_seq', GREATEST((SELECT count(*) FROM public.biens), 1));
SELECT setval('public.bail_seq', GREATEST((SELECT count(*) FROM public.baux), 1));
