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
export const APP_VERSION = "immo-pb-v2";
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
    const message =
      e?.response?.message || e?.data?.message || e?.message || "Erreur inconnue";
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
    if (this.mode === "select") {
      // "biens(*), proprietaires(nom)" -> relations à étendre
      if (cols && cols.includes("(")) {
        const rels = [...cols.matchAll(/([a-z_]+)\s*(?:!\w+)?\s*\(/g)]
          .map((m) => m[1])
          .filter((r) => r !== "count");
        if (rels.length) this._expand = rels.join(",");
      }
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

  /* --- filtres --- */
  eq(col: string, val: any)   { this.filters.push(`${col} = ${esc(val)}`); return this; }
  neq(col: string, val: any)  { this.filters.push(`${col} != ${esc(val)}`); return this; }
  gt(col: string, val: any)   { this.filters.push(`${col} > ${esc(val)}`); return this; }
  gte(col: string, val: any)  { this.filters.push(`${col} >= ${esc(val)}`); return this; }
  lt(col: string, val: any)   { this.filters.push(`${col} < ${esc(val)}`); return this; }
  lte(col: string, val: any)  { this.filters.push(`${col} <= ${esc(val)}`); return this; }
  like(col: string, pat: string)  { this.filters.push(`${col} ~ ${esc(pat.replace(/%/g, ""))}`); return this; }
  ilike(col: string, pat: string) { this.filters.push(`${col} ~ ${esc(pat.replace(/%/g, ""))}`); return this; }
  is(col: string, val: any)   {
    this.filters.push(val === null ? `${col} = null` : `${col} = ${esc(val)}`);
    return this;
  }
  not(col: string, _op: string, val: any) { this.filters.push(`${col} != ${esc(val)}`); return this; }
  in(col: string, arr: any[]) {
    if (!arr || arr.length === 0) this.filters.push(`id = ""`); // ensemble vide
    else this.filters.push("(" + arr.map((v) => `${col} = ${esc(v)}`).join(" || ") + ")");
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
    this.sort.push((opts?.ascending === false ? "-" : "") + col);
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
          const clean = { ...row };
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
        const clean = { ...this.payload };
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

    /* Liste des utilisateurs avec leur rôle. */
    case "get_users_with_roles":
      return wrap(async () => {
        const users = await pb.collection("users").getFullList({ sort: "created" });
        let roles: any[] = [];
        try { roles = await pb.collection("user_roles").getFullList(); } catch { /* table absente */ }
        return users.map((u: any) => {
          const r = roles.find((x: any) => x.user_id === u.id);
          return { ...normalize(u), user_id: u.id, role: r?.role ?? null };
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
        const rec = await pb.collection("users").create({
          email: b.email,
          password: b.password,
          passwordConfirm: b.password,
          emailVisibility: true,
          name: b.nom || b.name || b.username || "",
          username: b.username || undefined,
        });
        if (b.role) {
          try { await pb.collection("user_roles").create({ user_id: rec.id, role: b.role }); } catch {}
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
  from: (table: string) => new Query(table),
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
