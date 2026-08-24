
-- ============ ENUM RÔLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'direction', 'commercial', 'caisse', 'recouvrement', 'juridique');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT,
  prenom TEXT,
  telephone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ has_role (security definer) ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ Trigger profil auto à l'inscription ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nom, prenom)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', '')
  );
  -- Premier utilisateur = admin, sinon rôle par défaut "caisse"
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'caisse');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ updated_at trigger générique ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ DOMAINE MÉTIER ============
CREATE TYPE public.bien_statut AS ENUM ('vacant', 'occupe', 'travaux');
CREATE TYPE public.bail_statut AS ENUM ('actif', 'resilie', 'expire');
CREATE TYPE public.mode_paiement AS ENUM ('especes', 'wave', 'orange_money', 'mtn_money', 'virement', 'cheque');

CREATE TABLE public.proprietaires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type_personne TEXT NOT NULL DEFAULT 'physique', -- physique / morale
  telephone TEXT,
  email TEXT,
  adresse TEXT,
  rib TEXT,
  taux_honoraires NUMERIC(5,2) NOT NULL DEFAULT 10.00, -- % honoraires de gestion
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.proprietaires ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER proprietaires_updated BEFORE UPDATE ON public.proprietaires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.biens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- studio, appartement, villa...
  pieces INTEGER,
  commune TEXT,
  quartier TEXT,
  adresse TEXT,
  loyer_mensuel NUMERIC(12,2) NOT NULL,
  charges NUMERIC(12,2) NOT NULL DEFAULT 0,
  statut bien_statut NOT NULL DEFAULT 'vacant',
  proprietaire_id UUID NOT NULL REFERENCES public.proprietaires(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.biens ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER biens_updated BEFORE UPDATE ON public.biens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.locataires (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  prenom TEXT,
  telephone TEXT,
  email TEXT,
  piece_identite TEXT,
  numero_piece TEXT,
  employeur TEXT,
  revenus_mensuels NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locataires ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER locataires_updated BEFORE UPDATE ON public.locataires
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.baux (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  bien_id UUID NOT NULL REFERENCES public.biens(id) ON DELETE RESTRICT,
  locataire_id UUID NOT NULL REFERENCES public.locataires(id) ON DELETE RESTRICT,
  date_entree DATE NOT NULL,
  date_fin DATE,
  loyer_mensuel NUMERIC(12,2) NOT NULL,
  caution NUMERIC(12,2) NOT NULL,
  avance_loyer NUMERIC(12,2) NOT NULL DEFAULT 0,
  jour_echeance INTEGER NOT NULL DEFAULT 5, -- date limite paiement (1-28)
  statut bail_statut NOT NULL DEFAULT 'actif',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (jour_echeance BETWEEN 1 AND 28),
  CHECK (caution <= loyer_mensuel * 2), -- Loi 2018-575 art.22 max 2 mois
  CHECK (avance_loyer <= loyer_mensuel * 2)
);
ALTER TABLE public.baux ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER baux_updated BEFORE UPDATE ON public.baux
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.paiements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bail_id UUID NOT NULL REFERENCES public.baux(id) ON DELETE RESTRICT,
  montant NUMERIC(12,2) NOT NULL,
  mois_concerne DATE NOT NULL, -- 1er du mois concerné (ex: 2026-04-01)
  date_paiement DATE NOT NULL DEFAULT CURRENT_DATE,
  mode mode_paiement NOT NULL,
  reference_externe TEXT, -- réf. transaction Wave/OM/etc.
  numero_quittance TEXT NOT NULL UNIQUE,
  encaisse_par UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

-- Génération auto numéro de quittance
CREATE SEQUENCE IF NOT EXISTS public.quittance_seq START 1;
CREATE OR REPLACE FUNCTION public.gen_numero_quittance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.numero_quittance IS NULL OR NEW.numero_quittance = '' THEN
    NEW.numero_quittance := 'QT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quittance_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER paiements_quittance BEFORE INSERT ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.gen_numero_quittance();

-- ============ POLICIES ============

-- profiles
CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins see all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins see all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- proprietaires : lecture pour tous les agents, écriture admin/direction
CREATE POLICY "Authenticated read proprietaires" ON public.proprietaires
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Direction manage proprietaires" ON public.proprietaires
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction'));

-- biens : lecture pour tous, écriture admin/direction/commercial
CREATE POLICY "Authenticated read biens" ON public.biens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage biens" ON public.biens
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction') OR public.has_role(auth.uid(), 'commercial'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction') OR public.has_role(auth.uid(), 'commercial'));

-- locataires : lecture pour tous, écriture commercial/caisse/admin
CREATE POLICY "Authenticated read locataires" ON public.locataires
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage locataires" ON public.locataires
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'commercial') OR public.has_role(auth.uid(), 'caisse'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'commercial') OR public.has_role(auth.uid(), 'caisse'));

-- baux : lecture pour tous, écriture caisse/admin/direction
CREATE POLICY "Authenticated read baux" ON public.baux
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage baux" ON public.baux
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction') OR public.has_role(auth.uid(), 'caisse'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'direction') OR public.has_role(auth.uid(), 'caisse'));

-- paiements : lecture pour tous, création par caisse/admin
CREATE POLICY "Authenticated read paiements" ON public.paiements
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Caisse insert paiements" ON public.paiements
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'caisse') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update/delete paiements" ON public.paiements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
