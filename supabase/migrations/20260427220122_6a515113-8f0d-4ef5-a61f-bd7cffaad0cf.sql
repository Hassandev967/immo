-- Vues en SECURITY INVOKER (respectent RLS de l'utilisateur connecté)
ALTER VIEW public.v_locataire_360 SET (security_invoker = on);
ALTER VIEW public.v_proprietaire_360 SET (security_invoker = on);

-- Retirer EXECUTE public sur les fonctions trigger (elles s'exécutent quand même via le trigger)
REVOKE EXECUTE ON FUNCTION public.sync_bien_statut_from_bail() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_recouvrement_on_paiement() FROM PUBLIC, anon, authenticated;