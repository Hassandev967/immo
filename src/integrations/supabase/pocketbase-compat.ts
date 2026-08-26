/**
 * ============================================================================
 *  pocketbase-compat.ts
 *  Couche de compatibilité : expose une API identique à supabase-js,
 *  mais dialogue avec PocketBase.
 *  ------------------------------------------------------------------------
 *  Objectif : ne pas réécrire les ~139 appels `supabase.from(...)` du projet.
 *  Les composants continuent d'utiliser la même syntaxe.
 * ==========================================================================*/

import PocketBase, { RecordModel } from "pocketbase";

const PB_URL = import.meta.env.VITE_PB_URL || window.location.origin;


/* Marqueur de version — permet de vérifier en console quelle version est déployée */
export const APP_VERSION = "immo-pb-v6";
if (typeof window !== "undefined") {
  (window as any).APP_VERSION = APP_VERSION;
  console.log("%cYapGi Immobilier " + APP_VERSION + " — backend PocketBase",
              "background:#1e3a5f;color:#fff;padding:2px 8px;border-radius:4px");
}

export const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

/* ---------------------------------------------------------------------------
   Utilitaires
--------------------------------------------------------------------------- */

/** Échappe une valeur pour l'insérer dans un filtre PocketBase. */
function esc(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return `"${String(v).replace(/"/g, '\\"')}"`;
}

/** Supabase renvoie {data, error}. On enveloppe les promesses PocketBase. */
type Result<T> = { data: T; error: { message: string } | null; count?: number };

async function wrap<T>(fn: () => Promise<T>, fallback: T): Promise<Result<T>> {
  try {
    const data = await fn();
    return { data, error: null };
  } catch (e: any) {
    // PocketBase détaille les champs fautifs dans response.data : on les remonte
    const details = e?.response?.data || e?.data;
    let message =
      e?.response?.message || e?.data?.message || e?.message || "Erreur inconnue";

    if (details && typeof details === "object" && Object.keys(details).length) {
      const champs = Object.entries(details)
        .map(([champ, info]: any) => `${champ} : ${info?.message || info?.code || "invalide"}`)
        .join(" · ");
      message = `${message} → ${champs}`;
    }
    console.error("[PB]", message, e);
    return { data: fallback, error: { message } };
  }
}

/** PocketBase renvoie `id`; certains écrans attendent aussi `created_at`. */
function normalize(r: RecordModel | any) {
  if (!r || typeof r !== "object") return r;
  const out: any = { ...r };
  if (out.created && !out.created_at) out.created_at = out.created;
  if (out.updated && !out.updated_at) out.updated_at = out.updated;

  /* Les relations étendues arrivent dans `expand` sous le nom du CHAMP
     (locataire_id). L'application les attend sous le nom de la TABLE
     (locataires). On expose les deux formes. */
  if (out.expand && typeof out.expand === "object") {
    for (const [champ, valeur] of Object.entries<any>(out.expand)) {
      const v = Array.isArray(valeur) ? valeur.map(normalize) : normalize(valeur);
      out[champ] = v;                                    // locataire_id
      const base = champ.replace(/_id$/, "");            // locataire
      out[base] = v;                                     // locataire
      out[base.endsWith("s") ? base : base + "s"] = v;   // locataires
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Valeurs par défaut
   ---------------------------------------------------------------------------
   Dans Supabase, ces colonnes avaient un DEFAULT en base. PocketBase n'en a
   pas sur les listes de choix : le champ devient simplement obligatoire.
   On complète donc automatiquement à la création quand rien n'est fourni.
--------------------------------------------------------------------------- */
const DEFAUTS: Record<string, Record<string, any>> = {
  baux:                 { statut: "actif" },
  biens:                { statut: "vacant" },
  candidatures:         { statut: "en_etude" },
  courriers_juridiques: { categorie: "mise_en_demeure", statut: "brouillon" },
  courriers_recus:      { categorie: "reclamation", statut: "recu" },
  documents_locataire:  { type: "bail", statut: "valide" },
  factures_entree:      { statut: "brouillon" },
  frais_juridiques:     { type: "huissier" },
  mises_en_demeure:     { statut: "brouillon" },
  modeles_courrier:     { categorie: "mise_en_demeure" },
  modeles_relance:      { canal: "sms" },
  paiements:            { mode: "especes" },
  procedures:           { type: "commandement", statut: "en_cours" },
  prospects:            { statut: "nouveau" },
  relances_envoyees:    { canal: "sms", statut: "preparee" },
  reversements:         { statut: "a_payer" },
  visites:              { statut: "planifiee" },
};

function avecDefauts(collection: string, ligne: any) {
  const out: any = { ...ligne };

  /* Supabase envoie `null` pour « pas de valeur ». PocketBase le refuse sur
     les champs numériques et les dates. À la création, on retire simplement
     ces clés : PocketBase appliquera ses propres valeurs vides. */
  for (const [champ, valeur] of Object.entries(out)) {
    if (valeur === null || valeur === undefined) delete out[champ];
  }

  const d = DEFAUTS[collection];
  if (d) {
    for (const [champ, valeur] of Object.entries(d)) {
      if (out[champ] === undefined || out[champ] === "") out[champ] = valeur;
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
   Constructeur de requête (imite PostgrestFilterBuilder)
--------------------------------------------------------------------------- */

class Query implements PromiseLike<Result<any>> {
  private filters: string[] = [];
  private sort: string[] = [];
  private _limit = 0;
  private _expand = "";
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private _single = false;
  private maybe = false;

  constructor(private collection: string) {}

  /* --- verbes --- */
  select(cols?: string) {
    if (this.mode === "select" && cols && cols.includes("(")) {
      /* Supabase joint ainsi :  locataires!baux_locataire_id_fkey(nom, prenom)
         PocketBase utilise `expand` sur le CHAMP de relation, pas sur la table.
         On déduit donc le champ à étendre à partir du nom de la contrainte
         (baux_locataire_id_fkey -> locataire_id) ou du nom de la table. */
      const champs: string[] = [];
      const re = /([a-z_]+)\s*(?:!([a-z_]+))?\s*\(/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cols)) !== null) {
        const table = m[1];
        const contrainte = m[2];
        if (table === "count") continue;

        let champ: string | null = null;
        if (contrainte) {
          // "baux_locataire_id_fkey" -> "locataire_id" ; "baux_bien_fk" -> "bien_id"
          let c = contrainte.replace(/_fkey$/, "").replace(/_fk$/, "");
          c = c.replace(new RegExp(`^${this.collection}_`), "");
          champ = c.endsWith("_id") ? c : `${c}_id`;
        } else {
          // sans contrainte : on déduit du nom de table (locataires -> locataire_id)
          champ = table.replace(/s$/, "") + "_id";
        }
        if (champ && !champs.includes(champ)) champs.push(champ);
      }
      if (champs.length) this._expand = champs.join(",");
    }
    return this;
  }
  insert(values: any) {
    this.mode = "insert";
    this.payload = values;
    return this;
  }
  update(values: any) {
    this.mode = "update";
    this.payload = values;
    return this;
  }
  upsert(values: any) {
    this.mode = "upsert";
    this.payload = values;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }

  /* Les noms de colonnes diffèrent : Supabase created_at -> PocketBase created */
  private col(nom: string) {
    if (nom === "created_at") return "created";
    if (nom === "updated_at") return "updated";
    return nom;
  }

  /* --- filtres --- */
  eq(col: string, val: any)   { this.filters.push(`${this.col(col)} = ${esc(val)}`); return this; }
  neq(col: string, val: any)  { this.filters.push(`${this.col(col)} != ${esc(val)}`); return this; }
  gt(col: string, val: any)   { this.filters.push(`${this.col(col)} > ${esc(val)}`); return this; }
  gte(col: string, val: any)  { this.filters.push(`${this.col(col)} >= ${esc(val)}`); return this; }
  lt(col: string, val: any)   { this.filters.push(`${this.col(col)} < ${esc(val)}`); return this; }
  lte(col: string, val: any)  { this.filters.push(`${this.col(col)} <= ${esc(val)}`); return this; }
  like(col: string, pat: string)  { this.filters.push(`${this.col(col)} ~ ${esc(pat.replace(/%/g, ""))}`); return this; }
  ilike(col: string, pat: string) { this.filters.push(`${this.col(col)} ~ ${esc(pat.replace(/%/g, ""))}`); return this; }
  is(col: string, val: any)   {
    const c = this.col(col);
    this.filters.push(val === null ? `${c} = null` : `${c} = ${esc(val)}`);
    return this;
  }
  not(col: string, _op: string, val: any) { this.filters.push(`${this.col(col)} != ${esc(val)}`); return this; }
  in(col: string, arr: any[]) {
    const c = this.col(col);
    if (!arr || arr.length === 0) this.filters.push(`id = ""`); // ensemble vide
    else this.filters.push("(" + arr.map((v) => `${c} = ${esc(v)}`).join(" || ") + ")");
    return this;
  }
  or(expr: string) {
    // "a.eq.1,b.eq.2" -> "(a = 1 || b = 2)"
    const parts = expr.split(",").map((p) => {
      const [col, op, ...rest] = p.split(".");
      const val = rest.join(".");
      const map: Record<string, string> = { eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "~", ilike: "~" };
      return `${col} ${map[op] || "="} ${esc(val)}`;
    });
    this.filters.push("(" + parts.join(" || ") + ")");
    return this;
  }

  /* --- tri / pagination --- */
  order(col: string, opts?: { ascending?: boolean }) {
    this.sort.push((opts?.ascending === false ? "-" : "") + this.col(col));
    return this;
  }
  limit(n: number) { this._limit = n; return this; }
  range(from: number, to: number) { this._limit = to - from + 1; return this; }

  /* --- terminateurs --- */
  single()      { this._single = true; return this; }
  maybeSingle() { this.maybe = true; this._single = true; return this; }

  private options() {
    const o: any = {};
    if (this.filters.length) o.filter = this.filters.join(" && ");
    if (this.sort.length) o.sort = this.sort.join(",");
    if (this._expand) o.expand = this._expand;
    return o;
  }

  /** Exécution : c'est ici que la requête part vers PocketBase. */
  private async run(): Promise<Result<any>> {
    const col = pb.collection(this.collection);

    if (this.mode === "insert" || this.mode === "upsert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      return wrap(async () => {
        const created = [];
        for (const row of rows) {
          const clean = avecDefauts(this.collection, { ...row });
          delete clean.created_at; delete clean.updated_at;
          if (this.mode === "upsert" && clean.id) {
            try { created.push(normalize(await col.update(clean.id, clean))); continue; }
            catch { /* n'existe pas encore : on crée */ }
          }
          created.push(normalize(await col.create(clean)));
        }
        return this._single ? created[0] : created;
      }, this._single ? null : []);
    }

    if (this.mode === "update") {
      return wrap(async () => {
        const opts = this.options();
        const targets = await col.getFullList(opts);
        const clean: any = { ...this.payload };
        for (const [k, v] of Object.entries(clean)) if (v === null) clean[k] = "";
        delete clean.created_at; delete clean.updated_at;
        const out = [];
        for (const t of targets) out.push(normalize(await col.update(t.id, clean)));
        return this._single ? out[0] : out;
      }, this._single ? null : []);
    }

    if (this.mode === "delete") {
      return wrap(async () => {
        const targets = await col.getFullList(this.options());
        for (const t of targets) await col.delete(t.id);
        return [];
      }, []);
    }

    // select
    return wrap(async () => {
      const opts = this.options();
      if (this._single) {
        const list = await col.getList(1, 1, opts);
        const item = list.items[0];
        if (!item && !this.maybe) throw new Error("Aucun enregistrement trouvé");
        return item ? normalize(item) : null;
      }
      const items = this._limit
        ? (await col.getList(1, this._limit, opts)).items
        : await col.getFullList(opts);
      return items.map(normalize);
    }, this._single ? null : []);
  }

  /* rend la classe "awaitable" comme une promesse Supabase */
  then<R1 = Result<any>, R2 = never>(
    onfulfilled?: ((v: Result<any>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/* ---------------------------------------------------------------------------
   Vue « loyers en retard »
   ---------------------------------------------------------------------------
   Dans Supabase c'était une vue SQL (v_loyers_retard). PocketBase n'a pas de
   vues : on la recalcule ici à partir des baux actifs et des paiements.
--------------------------------------------------------------------------- */

class VueLoyersRetard implements PromiseLike<Result<any[]>> {
  private sortDesc = true;
  private _limit = 0;

  select(_cols?: string) { return this; }
  order(_col: string, opts?: { ascending?: boolean }) {
    this.sortDesc = opts?.ascending === false || opts?.ascending === undefined;
    return this;
  }
  eq() { return this; }
  limit(n: number) { this._limit = n; return this; }

  private async run(): Promise<Result<any[]>> {
    return wrap(async () => {
      const baux = await pb.collection("baux").getFullList({
        filter: 'statut = "actif"',
        expand: "locataire_id,bien_id",
      });
      let paiements: any[] = [];
      try { paiements = await pb.collection("paiements").getFullList(); } catch { /* aucune */ }

      const maintenant = new Date();
      const lignes = baux.map((b: any) => {
        const loyer = Number(b.loyer_mensuel) || 0;

        // total déjà réglé pour ce bail
        const regle = paiements
          .filter((p) => p.bail_id === b.id)
          .reduce((s, p) => s + (Number(p.montant) || 0), 0);

        // nombre de mois écoulés depuis le début du bail
        const debut = b.date_debut ? new Date(b.date_debut) : null;
        let moisEcoules = 0;
        if (debut && !isNaN(debut.getTime())) {
          moisEcoules =
            (maintenant.getFullYear() - debut.getFullYear()) * 12 +
            (maintenant.getMonth() - debut.getMonth()) + 1;
          if (moisEcoules < 0) moisEcoules = 0;
        }

        const dû = loyer * moisEcoules;
        const impaye = Math.max(0, dû - regle);
        const moisRetard = loyer > 0 ? Math.floor(impaye / loyer) : 0;

        // pénalités : jours écoulés depuis le début du mois courant
        const joursPenalite = moisRetard > 0 ? maintenant.getDate() : 0;

        return {
          bail_id: b.id,
          reference: b.reference ?? null,
          loyer_mensuel: loyer,
          mois_retard: moisRetard,
          jours_penalite_mois_courant: joursPenalite,
          taux_penalite_journalier: Number(b.taux_penalite_journalier) || 0,
          transfert_juridique_propose: moisRetard >= 3,
          locataires: b.expand?.locataire_id ? normalize(b.expand.locataire_id) : undefined,
          biens: b.expand?.bien_id ? normalize(b.expand.bien_id) : undefined,
        };
      })
      .filter((l) => (l.mois_retard || 0) > 0);   // seuls les baux en retard

      lignes.sort((a, b) =>
        this.sortDesc ? (b.mois_retard - a.mois_retard) : (a.mois_retard - b.mois_retard)
      );
      return this._limit ? lignes.slice(0, this._limit) : lignes;
    }, []);
  }

  then<R1 = Result<any[]>, R2 = never>(
    onfulfilled?: ((v: Result<any[]>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/* ---------------------------------------------------------------------------
   Authentification
--------------------------------------------------------------------------- */

type AuthCb = (event: string, session: any | null) => void;
const authCallbacks: AuthCb[] = [];

function session() {
  if (!pb.authStore.isValid) return null;
  const rec: any = pb.authStore.record || (pb.authStore as any).model;
  return {
    access_token: pb.authStore.token,
    user: { id: rec?.id, email: rec?.email, user_metadata: rec || {} },
  };
}
function emit(event: string) {
  const s = session();
  authCallbacks.forEach((cb) => { try { cb(event, s); } catch (e) { console.error(e); } });
}

const auth = {
  async getSession() {
    return { data: { session: session() }, error: null };
  },
  async getUser() {
    const s = session();
    return { data: { user: s?.user ?? null }, error: null };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      // `email` peut être une adresse OU un nom d'utilisateur : PocketBase
      // accepte les deux dès lors qu'ils sont déclarés comme identifiants.
      await pb.collection("users").authWithPassword(email, password);
      emit("SIGNED_IN");
      const s = session();
      return { data: { session: s, user: s?.user }, error: null };
    } catch (e: any) {
      const status = e?.status;
      let message = "Identifiants incorrects";
      if (status === 400) message = "Nom d'utilisateur ou mot de passe incorrect.";
      else if (status === 403) message = "Ce compte n'est pas autorisé à se connecter.";
      else if (!status) message = "Serveur injoignable. Vérifie ta connexion.";
      return { data: { session: null, user: null }, error: { message } };
    }
  },
  async signUp({ email, password, options }: any) {
    try {
      const meta = options?.data || {};
      const rec = await pb.collection("users").create({
        email, password, passwordConfirm: password, emailVisibility: true, ...meta,
      });
      await pb.collection("users").authWithPassword(email, password);
      emit("SIGNED_IN");
      const s = session();
      return { data: { session: s, user: s?.user ?? rec }, error: null };
    } catch (e: any) {
      const msg = e?.response?.data
        ? Object.entries(e.response.data).map(([k, v]: any) => `${k}: ${v?.message}`).join(", ")
        : e?.message || "Inscription impossible";
      return { data: { session: null, user: null }, error: { message: msg } };
    }
  },
  async signOut() {
    pb.authStore.clear();
    emit("SIGNED_OUT");
    return { error: null };
  },
  onAuthStateChange(cb: AuthCb) {
    authCallbacks.push(cb);
    setTimeout(() => cb(session() ? "INITIAL_SESSION" : "SIGNED_OUT", session()), 0);
    const unsub = pb.authStore.onChange(() => emit("TOKEN_REFRESHED"));
    return {
      data: {
        subscription: {
          unsubscribe() {
            const i = authCallbacks.indexOf(cb);
            if (i >= 0) authCallbacks.splice(i, 1);
            unsub();
          },
        },
      },
    };
  },
  async resetPasswordForEmail(email: string) {
    return wrap(() => pb.collection("users").requestPasswordReset(email), null);
  },
};

/* ---------------------------------------------------------------------------
   Stockage de fichiers
--------------------------------------------------------------------------- */

const storage = {
  from(bucket: string) {
    return {
      /** Le fichier est rangé dans la collection "fichiers" (champ `fichier`). */
      async upload(path: string, file: File | Blob, _opts?: any) {
        return wrap(async () => {
          const fd = new FormData();
          fd.append("fichier", file as any, path.split("/").pop() || "fichier");
          fd.append("chemin", path);
          fd.append("bucket", bucket);
          const rec = await pb.collection("fichiers").create(fd);
          return { path, id: rec.id };
        }, null);
      },
      async createSignedUrl(path: string, _expires: number) {
        return wrap(async () => {
          const rec = await pb.collection("fichiers").getFirstListItem(`chemin = ${esc(path)}`);
          const url = pb.files.getURL(rec, (rec as any).fichier);
          return { signedUrl: url };
        }, null);
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: `${PB_URL}/api/files/fichiers/${path}` } };
      },
      async remove(paths: string[]) {
        return wrap(async () => {
          for (const p of paths) {
            try {
              const rec = await pb.collection("fichiers").getFirstListItem(`chemin = ${esc(p)}`);
              await pb.collection("fichiers").delete(rec.id);
            } catch { /* déjà supprimé */ }
          }
          return [];
        }, []);
      },
      async download(path: string) {
        return wrap(async () => {
          const rec = await pb.collection("fichiers").getFirstListItem(`chemin = ${esc(path)}`);
          const url = pb.files.getURL(rec, (rec as any).fichier);
          const res = await fetch(url);
          return await res.blob();
        }, null);
      },
    };
  },
};

/* ---------------------------------------------------------------------------
   Fonctions RPC — réécrites côté client
--------------------------------------------------------------------------- */

async function rpc(name: string, params: any = {}) {
  switch (name) {
    /* Retrouver l'e-mail à partir du nom d'utilisateur.
       PocketBase accepte désormais le nom d'utilisateur comme identifiant de
       connexion : inutile (et impossible sans être connecté) d'interroger la
       collection `users`. On renvoie donc l'identifiant tel quel. */
    case "get_email_by_username": {
      const u = params.username ?? params._username ?? params.p_username ?? "";
      return { data: u, error: null };
    }

    /* Liste des utilisateurs avec leurs rôles.
       L'écran d'administration attend : id, nom, prenom, telephone, roles[] */
    case "get_users_with_roles":
      return wrap(async () => {
        const users = await pb.collection("users").getFullList({ sort: "created" });
        let roles: any[] = [];
        try { roles = await pb.collection("user_roles").getFullList(); } catch { /* collection absente */ }

        return users.map((u: any) => {
          // tous les rôles de cet utilisateur
          const mesRoles = roles
            .filter((r: any) => r.user_id === u.id)
            .map((r: any) => r.role)
            .filter(Boolean);

          // le nom peut venir de champs différents selon la façon dont le compte a été créé
          const nomComplet = (u.name || "").trim();
          const [prenomAuto, ...resteAuto] = nomComplet.split(" ");

          return {
            ...normalize(u),
            id: u.id,
            user_id: u.id,
            email: u.email,
            nom: u.nom || (resteAuto.length ? resteAuto.join(" ") : nomComplet) || u.username || u.email || "—",
            prenom: u.prenom || (resteAuto.length ? prenomAuto : ""),
            telephone: u.telephone || null,
            roles: mesRoles,
          };
        });
      }, []);

    /* Transfert d'un dossier au service juridique. */
    case "transferer_au_juridique":
      return wrap(async () => {
        const bailId = params.bail_id ?? params.p_bail_id;
        const proc = await pb.collection("procedures").create({
          bail_id: bailId,
          statut: params.statut ?? "ouverte",
          date_ouverture: new Date().toISOString(),
          created_by: pb.authStore.record?.id,
        });
        try { await pb.collection("baux").update(bailId, { statut: "contentieux" }); } catch {}
        return proc.id;
      }, null);

    default:
      console.warn(`[PB] Fonction RPC non implémentée : ${name}`);
      return { data: null, error: { message: `Fonction « ${name} » non disponible` } };
  }
}

/* ---------------------------------------------------------------------------
   Fonctions serveur (Edge Functions)
--------------------------------------------------------------------------- */

const functions = {
  async invoke(name: string, opts?: { body?: any }) {
    if (name === "admin-create-user") {
      const b = opts?.body || {};
      return wrap(async () => {
        const nomComplet = [b.prenom, b.nom].filter(Boolean).join(" ").trim();
        const rec = await pb.collection("users").create({
          email: b.email,
          password: b.password,
          passwordConfirm: b.password,
          emailVisibility: true,
          verified: true,
          name: nomComplet || b.username || b.email,
          username: b.username || (b.email || "").split("@")[0],
          nom: b.nom || "",
          prenom: b.prenom || "",
          telephone: b.telephone || "",
        });

        // rôles : le formulaire en envoie un tableau
        const roles: string[] = Array.isArray(b.roles) ? b.roles : (b.role ? [b.role] : []);
        for (const r of roles) {
          try { await pb.collection("user_roles").create({ user_id: rec.id, role: r }); }
          catch (e) { console.error("Rôle non attribué :", r, e); }
        }
        return { user: normalize(rec) };
      }, null);
    }
    console.warn(`[PB] Fonction serveur non implémentée : ${name}`);
    return { data: null, error: { message: `Fonction « ${name} » non disponible` } };
  },
};

/* ---------------------------------------------------------------------------
   Client exporté — même forme que celui de Supabase
--------------------------------------------------------------------------- */

export const supabase = {
  from: (table: string) => {
    /* `profiles` n'existe pas dans PocketBase : les profils sont dans `users`. */
    if (table === "profiles") return new Query("users");
    /* `v_loyers_retard` est une vue SQL calculée : on la reconstruit côté client. */
    if (table === "v_loyers_retard") return new VueLoyersRetard() as any;
    return new Query(table);
  },
  auth,
  storage,
  rpc,
  functions,
  /** Abonnements temps réel (PocketBase les gère nativement). */
  channel(_name: string) {
    const subs: Array<() => void> = [];
    const api: any = {
      on(_evt: string, cfg: any, cb: (payload: any) => void) {
        const table = cfg?.table;
        if (table) {
          pb.collection(table)
            .subscribe("*", (e) => cb({ eventType: e.action, new: normalize(e.record), old: null }))
            .then((un) => subs.push(un as any))
            .catch(() => {});
        }
        return api;
      },
      subscribe() { return api; },
      unsubscribe() { subs.forEach((u) => { try { u(); } catch {} }); return api; },
    };
    return api;
  },
  removeChannel(ch: any) { try { ch?.unsubscribe?.(); } catch {} },
};

export default supabase;
