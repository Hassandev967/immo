import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type AppRole = "admin" | "direction" | "commercial" | "caisse" | "recouvrement" | "juridique";
export type Action = "view" | "create" | "edit" | "delete";

export type AppModule =
  | "dashboard" | "caisse" | "recouvrement" | "suivi_locataires" | "juridique"
  | "courriers_recus" | "reponses_courriers" | "courriers" | "reddition"
  | "commercial" | "biens" | "proprietaires" | "locataires" | "baux"
  | "modeles_relance" | "modeles_courrier" | "imports" | "exports"
  | "admin_users" | "admin_permissions" | "audit_log";

export const MODULE_LABELS: Record<AppModule, string> = {
  dashboard: "Tableau de bord",
  caisse: "Caisse",
  recouvrement: "Recouvrement",
  suivi_locataires: "Suivi locataires",
  juridique: "Juridique",
  courriers_recus: "Préavis & réclamations",
  reponses_courriers: "Réponses aux courriers",
  courriers: "Courriers juridiques",
  reddition: "Reddition propriétaires",
  commercial: "Commercial",
  biens: "Parc immobilier",
  proprietaires: "Propriétaires",
  locataires: "Locataires",
  baux: "Bail",
  modeles_relance: "Modèles de relance",
  modeles_courrier: "Modèles de courriers",
  imports: "Imports",
  exports: "Rapports & Exports",
  admin_users: "Utilisateurs & rôles",
  admin_permissions: "Permissions",
  audit_log: "Journal d'audit",
};

export const ALL_MODULES: AppModule[] = Object.keys(MODULE_LABELS) as AppModule[];
export const ALL_ROLES: AppRole[] = ["admin","direction","commercial","caisse","recouvrement","juridique"];

interface RolePerm { role: AppRole; module: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; }
interface FieldPerm { role: AppRole; module: string; field: string; visible: boolean; editable: boolean; required: boolean; }

let cache: { rolePerms: RolePerm[]; fieldPerms: FieldPerm[] } | null = null;
const listeners = new Set<() => void>();

async function loadAll() {
  const [{ data: rp }, { data: fp }] = await Promise.all([
    supabase.from("role_permissions").select("*"),
    supabase.from("field_permissions").select("*"),
  ]);
  cache = { rolePerms: (rp ?? []) as any, fieldPerms: (fp ?? []) as any };
  listeners.forEach(l => l());
}

export function refreshPermissions() { return loadAll(); }

export function usePermissions() {
  const { roles, loading: authLoading } = useAuth();
  const [, setTick] = useState(0);
  const [permLoading, setPermLoading] = useState(!cache);

  useEffect(() => {
    const l = () => {
      setTick(t => t + 1);
      setPermLoading(false);
    };
    listeners.add(l);
    if (!cache) {
      loadAll().then(() => setPermLoading(false));
    } else {
      setPermLoading(false);
    }
    return () => { listeners.delete(l); };
  }, []);

  const isAdmin = roles.includes("admin");

  const can = useCallback((module: AppModule, action: Action = "view"): boolean => {
    if (isAdmin) return true;
    if (!cache) return false;
    const col = `can_${action}` as const;
    return cache.rolePerms.some(p => roles.includes(p.role) && p.module === module && (p as any)[col]);
  }, [roles, isAdmin]);

  const fieldPerm = useCallback((module: AppModule, field: string) => {
    if (isAdmin || !cache) return { visible: true, editable: true, required: false };
    const rules = cache.fieldPerms.filter(p => roles.includes(p.role) && p.module === module && p.field === field);
    if (rules.length === 0) return { visible: true, editable: true, required: false };
    return {
      visible: rules.some(r => r.visible),
      editable: rules.some(r => r.editable),
      required: rules.some(r => r.required),
    };
  }, [roles, isAdmin]);

  // ready = true seulement quand auth ET permissions sont chargées
  const ready = useMemo(() => !authLoading && !permLoading, [authLoading, permLoading]);

  return { can, fieldPerm, ready, isAdmin };
}
