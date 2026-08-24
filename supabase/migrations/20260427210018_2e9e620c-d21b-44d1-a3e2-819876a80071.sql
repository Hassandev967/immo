-- Catégories de courrier
DO $$ BEGIN
  CREATE TYPE public.courrier_categorie AS ENUM (
    'mise_en_demeure','sommation_payer','resiliation_bail','commandement_quitter',
    'accuse_reception','relance_amiable','attestation_loyer','conge_proprietaire',
    'courrier_huissier','courrier_avocat','autre'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.courrier_statut AS ENUM ('brouillon','genere','envoye','recu','annule');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Modèles de courrier
CREATE TABLE IF NOT EXISTS public.modeles_courrier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom text NOT NULL,
  categorie public.courrier_categorie NOT NULL,
  objet text,
  contenu_html text NOT NULL,
  variables text[] NOT NULL DEFAULT '{}',
  actif boolean NOT NULL DEFAULT true,
  systeme boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.modeles_courrier ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read modeles_courrier" ON public.modeles_courrier FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage modeles_courrier" ON public.modeles_courrier FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'));

CREATE TRIGGER modeles_courrier_updated_at BEFORE UPDATE ON public.modeles_courrier
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Archive des courriers générés
CREATE SEQUENCE IF NOT EXISTS public.courrier_seq START 1;

CREATE TABLE IF NOT EXISTS public.courriers_juridiques (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL,
  modele_id uuid,
  categorie public.courrier_categorie NOT NULL,
  objet text NOT NULL,
  contenu_html text NOT NULL,
  bail_id uuid,
  locataire_id uuid,
  procedure_id uuid,
  destinataire_nom text,
  destinataire_adresse text,
  fichier_pdf_url text,
  fichier_docx_url text,
  statut public.courrier_statut NOT NULL DEFAULT 'genere',
  mode_envoi text,
  date_envoi date,
  date_reception date,
  reference_envoi text,
  notes text,
  cree_par uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courriers_bail ON public.courriers_juridiques(bail_id);
CREATE INDEX IF NOT EXISTS idx_courriers_loc ON public.courriers_juridiques(locataire_id);
CREATE INDEX IF NOT EXISTS idx_courriers_categorie ON public.courriers_juridiques(categorie);

ALTER TABLE public.courriers_juridiques ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read courriers" ON public.courriers_juridiques FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage courriers" ON public.courriers_juridiques FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique'));

CREATE TRIGGER courriers_juridiques_updated_at BEFORE UPDATE ON public.courriers_juridiques
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.gen_numero_courrier()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := 'CRJ-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.courrier_seq')::text,5,'0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER courriers_numero BEFORE INSERT ON public.courriers_juridiques
FOR EACH ROW EXECUTE FUNCTION public.gen_numero_courrier();

-- Bucket de stockage courriers (privé)
INSERT INTO storage.buckets (id, name, public) VALUES ('courriers','courriers', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth read courriers bucket" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'courriers');
CREATE POLICY "Juridique upload courriers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'courriers' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique')));
CREATE POLICY "Juridique update courriers" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'courriers' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique')));
CREATE POLICY "Juridique delete courriers" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'courriers' AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'direction') OR has_role(auth.uid(),'juridique')));

-- Modèles standards (pack étendu)
INSERT INTO public.modeles_courrier (nom, categorie, objet, contenu_html, variables, systeme) VALUES
('Mise en demeure de payer','mise_en_demeure',
 'MISE EN DEMEURE — Loyers impayés',
 '<p><strong>YapGi Immobilier</strong><br/>Abidjan, le {{date}}</p><p>{{destinataire_nom}}<br/>{{destinataire_adresse}}</p><p><strong>Objet :</strong> Mise en demeure de payer — bail {{bail_reference}}</p><p>Madame, Monsieur,</p><p>Nonobstant nos relances, vous demeurez débiteur d''une somme de <strong>{{montant_du}} FCFA</strong> au titre des loyers et charges du bien sis {{bien_adresse}}, soit {{nb_mois_retard}} mois de retard.</p><p>En conséquence, par la présente, nous vous mettons en demeure de régler cette somme dans un délai de <strong>{{delai_jours}} jours</strong> à compter de la réception de la présente.</p><p>À défaut, nous nous verrons contraints d''engager toute procédure utile à la sauvegarde des intérêts du bailleur, en ce compris la résiliation du bail et l''expulsion.</p><p>Veuillez agréer, Madame, Monsieur, l''expression de nos salutations distinguées.</p><p>Le Service Juridique<br/>YapGi Immobilier</p>',
 ARRAY['date','destinataire_nom','destinataire_adresse','bail_reference','montant_du','bien_adresse','nb_mois_retard','delai_jours'], true),

('Sommation de payer','sommation_payer',
 'SOMMATION DE PAYER',
 '<p><strong>YapGi Immobilier</strong><br/>Abidjan, le {{date}}</p><p>À : {{destinataire_nom}}<br/>{{destinataire_adresse}}</p><p><strong>SOMMATION DE PAYER</strong></p><p>Vous êtes sommé(e) de payer la somme de <strong>{{montant_du}} FCFA</strong> représentant les loyers et charges échus du bien sis {{bien_adresse}}, dans un délai de <strong>{{delai_jours}} jours</strong>.</p><p>À défaut de paiement dans ce délai, il sera procédé à la résiliation du bail et à toute mesure d''exécution forcée prévue par la loi.</p><p>Fait à Abidjan, le {{date}}.</p>',
 ARRAY['date','destinataire_nom','destinataire_adresse','montant_du','bien_adresse','delai_jours'], true),

('Résiliation de bail','resiliation_bail',
 'RÉSILIATION DU BAIL',
 '<p><strong>YapGi Immobilier</strong><br/>Abidjan, le {{date}}</p><p>{{destinataire_nom}}<br/>{{destinataire_adresse}}</p><p><strong>Objet :</strong> Résiliation du bail {{bail_reference}}</p><p>Madame, Monsieur,</p><p>Faisant suite à la mise en demeure restée sans effet, et conformément aux dispositions du contrat de bail signé le {{date_entree}}, nous vous notifions par la présente la <strong>résiliation du bail</strong> portant sur le bien sis {{bien_adresse}}.</p><p>Vous êtes invité(e) à libérer les lieux et à restituer les clés au plus tard le {{date_liberation}}.</p><p>Les sommes dues à ce jour, soit {{montant_du}} FCFA, restent exigibles.</p><p>Le Service Juridique<br/>YapGi Immobilier</p>',
 ARRAY['date','destinataire_nom','destinataire_adresse','bail_reference','date_entree','bien_adresse','date_liberation','montant_du'], true),

('Commandement de quitter les lieux','commandement_quitter',
 'COMMANDEMENT DE QUITTER LES LIEUX',
 '<p><strong>COMMANDEMENT DE QUITTER LES LIEUX</strong></p><p>À : {{destinataire_nom}}<br/>{{destinataire_adresse}}</p><p>En vertu de la résiliation du bail notifiée le {{date_resiliation}}, il vous est commandé de quitter les lieux situés {{bien_adresse}} dans un délai de <strong>{{delai_jours}} jours</strong> à compter de la signification du présent commandement.</p><p>À défaut, il sera procédé à votre expulsion par toutes voies de droit.</p><p>Fait à Abidjan, le {{date}}.</p>',
 ARRAY['date','destinataire_nom','destinataire_adresse','date_resiliation','bien_adresse','delai_jours'], true),

('Accusé de réception','accuse_reception',
 'Accusé de réception',
 '<p><strong>YapGi Immobilier</strong><br/>Abidjan, le {{date}}</p><p>{{destinataire_nom}}</p><p>Nous accusons réception de votre courrier daté du {{date_reference}} relatif à {{objet_reference}}.</p><p>Votre dossier est en cours d''examen. Une réponse vous sera adressée dans les meilleurs délais.</p><p>Cordialement,<br/>Le Service Juridique</p>',
 ARRAY['date','destinataire_nom','date_reference','objet_reference'], true),

('Relance amiable','relance_amiable',
 'Relance amiable — règlement de loyer',
 '<p><strong>YapGi Immobilier</strong><br/>Abidjan, le {{date}}</p><p>{{destinataire_nom}}</p><p>Madame, Monsieur,</p><p>Sauf erreur de notre part, le loyer du mois de {{mois_concerne}} d''un montant de <strong>{{montant_du}} FCFA</strong> ne nous est pas parvenu.</p><p>Nous vous remercions de bien vouloir régulariser votre situation sous huitaine afin d''éviter toute procédure complémentaire.</p><p>Si ce règlement a été effectué entre-temps, veuillez ne pas tenir compte de ce courrier.</p><p>Bien cordialement,<br/>Le Service Juridique</p>',
 ARRAY['date','destinataire_nom','mois_concerne','montant_du'], true),

('Attestation de loyer','attestation_loyer',
 'Attestation de loyer',
 '<p><strong>YapGi Immobilier</strong><br/>Abidjan, le {{date}}</p><p><strong>ATTESTATION DE LOYER</strong></p><p>Nous, soussignés YapGi Immobilier, attestons par la présente que :</p><p><strong>{{destinataire_nom}}</strong><br/>est locataire du bien sis {{bien_adresse}} depuis le {{date_entree}}, en vertu du bail référencé {{bail_reference}}.</p><p>Le loyer mensuel s''élève à <strong>{{loyer_mensuel}} FCFA</strong> et est acquitté régulièrement à ce jour.</p><p>Cette attestation est délivrée à l''intéressé(e) pour servir et valoir ce que de droit.</p><p>Le Gérant<br/>YapGi Immobilier</p>',
 ARRAY['date','destinataire_nom','bien_adresse','date_entree','bail_reference','loyer_mensuel'], true),

('Congé donné par le propriétaire','conge_proprietaire',
 'CONGÉ — Notification de fin de bail',
 '<p><strong>YapGi Immobilier</strong> — pour le compte de {{proprietaire_nom}}<br/>Abidjan, le {{date}}</p><p>{{destinataire_nom}}<br/>{{destinataire_adresse}}</p><p><strong>Objet :</strong> Congé — bail {{bail_reference}}</p><p>Madame, Monsieur,</p><p>Conformément au contrat de bail vous liant au propriétaire, nous vous notifions par la présente le <strong>congé du bail</strong> portant sur le bien sis {{bien_adresse}}, à effet du <strong>{{date_fin}}</strong>.</p><p>Motif : {{motif_conge}}.</p><p>Vous voudrez bien prendre vos dispositions pour libérer les lieux à la date indiquée et procéder à l''état des lieux de sortie.</p><p>Bien cordialement,<br/>Le Service Juridique</p>',
 ARRAY['date','proprietaire_nom','destinataire_nom','destinataire_adresse','bail_reference','bien_adresse','date_fin','motif_conge'], true),

('Saisine d''huissier','courrier_huissier',
 'Mandat — recouvrement et signification',
 '<p><strong>YapGi Immobilier</strong><br/>Abidjan, le {{date}}</p><p>Maître {{huissier_nom}}<br/>Étude d''huissier</p><p><strong>Objet :</strong> Mandat de recouvrement et signification — dossier {{bail_reference}}</p><p>Maître,</p><p>Nous vous donnons mandat d''entreprendre, à l''encontre de <strong>{{destinataire_nom}}</strong>, locataire du bien sis {{bien_adresse}}, toute mesure utile au recouvrement de la somme de <strong>{{montant_du}} FCFA</strong> et, le cas échéant, à la signification du commandement de quitter les lieux.</p><p>Vous trouverez ci-joint la copie du bail et la mise en demeure restée infructueuse.</p><p>Nous vous prions d''agréer, Maître, l''expression de nos salutations distinguées.</p><p>Le Service Juridique<br/>YapGi Immobilier</p>',
 ARRAY['date','huissier_nom','bail_reference','destinataire_nom','bien_adresse','montant_du'], true),

('Saisine d''avocat','courrier_avocat',
 'Saisine — procédure contentieuse',
 '<p><strong>YapGi Immobilier</strong><br/>Abidjan, le {{date}}</p><p>Maître {{avocat_nom}}<br/>Cabinet d''avocats</p><p><strong>Objet :</strong> Saisine — dossier {{bail_reference}}</p><p>Maître,</p><p>Par la présente, nous sollicitons votre intervention dans le dossier de notre locataire <strong>{{destinataire_nom}}</strong>, débiteur d''une somme de <strong>{{montant_du}} FCFA</strong> au titre du bail portant sur le bien sis {{bien_adresse}}.</p><p>Nous vous remercions d''engager toute procédure utile (résiliation judiciaire, expulsion, recouvrement) pour la sauvegarde des intérêts du bailleur.</p><p>Pièces jointes : copie du bail, mise en demeure, état des sommes dues.</p><p>Bien cordialement,<br/>Le Service Juridique</p>',
 ARRAY['date','avocat_nom','bail_reference','destinataire_nom','montant_du','bien_adresse'], true)
ON CONFLICT DO NOTHING;