import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    // Vérifier que l'appelant est admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Session invalide" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin, error: rErr } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (rErr || !isAdmin) return json({ error: "Accès refusé : admin requis" }, 403);

    const body = await req.json();
    const { email, password, nom, prenom, telephone, roles } = body as {
      email: string; password: string; nom?: string; prenom?: string; telephone?: string; roles: string[];
    };

    if (!email || !password) return json({ error: "Email et mot de passe requis" }, 400);
    if (password.length < 8) return json({ error: "Mot de passe : 8 caractères minimum" }, 400);

    // Créer l'utilisateur (email confirmé directement par l'admin)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { nom: nom ?? "", prenom: prenom ?? "" },
    });
    if (cErr || !created.user) return json({ error: cErr?.message ?? "Création échouée" }, 400);

    const newId = created.user.id;

    // Mettre à jour le profil (téléphone)
    if (telephone) {
      await admin.from("profiles").update({ telephone }).eq("id", newId);
    }

    // Le trigger handle_new_user() crée déjà un rôle par défaut.
    // On nettoie et on remet exactement les rôles demandés.
    if (Array.isArray(roles)) {
      await admin.from("user_roles").delete().eq("user_id", newId);
      const valid = roles.filter((r) =>
        ["admin", "direction", "commercial", "caisse", "recouvrement", "juridique"].includes(r)
      );
      if (valid.length) {
        await admin.from("user_roles").insert(valid.map((r) => ({ user_id: newId, role: r })));
      }
    }

    return json({ ok: true, user_id: newId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
