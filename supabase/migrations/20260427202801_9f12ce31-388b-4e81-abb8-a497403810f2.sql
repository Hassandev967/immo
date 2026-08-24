-- ============================================================
-- MODELES DE RELANCE
-- ============================================================
CREATE TYPE public.canal_relance AS ENUM ('sms','whatsapp','email');

CREATE TABLE public.modeles_relance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  canal canal_relance NOT NULL,
  jour_declenchement integer NOT NULL DEFAULT 5,
  sujet text,
  contenu text NOT NULL,
  actif boolean NOT NULL DEFAULT true,
  ordre integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_modeles_relance_updated BEFORE UPDATE ON public.modeles_relance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.modeles_relance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read modeles" ON public.modeles_relance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage modeles" ON public.modeles_relance FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction'));

-- Modèles par défaut
INSERT INTO public.modeles_relance (nom, canal, jour_declenchement, contenu, ordre) VALUES
('Rappel amical (J+5)', 'whatsapp', 5,
 'Bonjour {{nom}}, nous nous permettons de vous rappeler que votre loyer du mois de {{mois}} d''un montant de {{montant}} FCFA pour le bien {{bien}} reste en attente de règlement. Merci de bien vouloir régulariser votre situation. Cordialement, ImmoCI.',
 1),
('Relance ferme (J+15)', 'sms', 15,
 'M./Mme {{nom}}, votre loyer de {{mois}} ({{montant}} FCFA) demeure impayé malgré notre rappel. Merci de procéder au règlement sous 7 jours. ImmoCI.',
 2),
('Pré-mise en demeure (J+30)', 'whatsapp', 30,
 'Bonjour {{nom}}, malgré nos relances, votre loyer du mois de {{mois}} ({{montant}} FCFA) reste impayé. Sans règlement sous 5 jours, nous serons contraints d''engager une procédure de mise en demeure formelle. ImmoCI.',
 3);

-- ============================================================
-- HISTORIQUE DES RELANCES
-- ============================================================
CREATE TYPE public.relance_statut AS ENUM ('preparee','envoyee','echec','lue');

CREATE TABLE public.relances_envoyees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bail_id uuid NOT NULL REFERENCES public.baux(id) ON DELETE CASCADE,
  modele_id uuid REFERENCES public.modeles_relance(id) ON DELETE SET NULL,
  canal canal_relance NOT NULL,
  destinataire text NOT NULL,
  contenu_envoye text NOT NULL,
  statut relance_statut NOT NULL DEFAULT 'preparee',
  envoye_par uuid,
  reference_externe text,
  erreur text,
  date_envoi timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.relances_envoyees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read relances" ON public.relances_envoyees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert relances" ON public.relances_envoyees FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction')
    OR has_role(auth.uid(),'recouvrement') OR has_role(auth.uid(),'caisse')
  );
CREATE POLICY "Update own relances" ON public.relances_envoyees FOR UPDATE TO authenticated
  USING (envoye_par = auth.uid() OR has_role(auth.uid(),'admin'));

-- ============================================================
-- ACCES ADMIN AUX PROFILS (pour page gestion roles)
-- ============================================================
-- Les politiques 'Admins see all profiles' et 'Admins manage roles' existent déjà
-- On ajoute une vue list utilisateurs pour les admins

CREATE OR REPLACE VIEW public.v_users_admin AS
SELECT
  p.id, p.nom, p.prenom, p.telephone, p.created_at,
  COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
GROUP BY p.id;

-- La vue hérite des RLS des tables sous-jacentes (profiles, user_roles)
-- Les admins voient tous les profils et tous les roles → la vue fonctionne pour eux