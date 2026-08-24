import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fmtFCFA } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import {
  TrendingUp, AlertTriangle, Home, Receipt,
  Plus, RefreshCw, ChevronRight, Download,
  CheckCircle, Clock, LayoutDashboard, Lock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Paiement = {
  id: string;
  numero_quittance: string;
  montant: number;
  mois_concerne: string;
  date_paiement: string;
  mode: string;
  encaisse_par: string | null;
  baux?: {
    reference: string;
    locataires?: { id: string; nom: string; prenom: string | null; type_personne?: string; raison_sociale?: string | null };
    biens?: { reference: string };
  };
};

type RetardRow = {
  bail_id: string | null;
  reference: string | null;
  loyer_mensuel: number | null;
  mois_retard: number | null;
  jours_penalite_mois_courant: number | null;
  taux_penalite_journalier: number | null;
  transfert_juridique_propose: boolean | null;
};

type BailOption = {
  id: string;
  reference: string;
  loyer_mensuel: number;
  locataires: { nom: string; prenom: string | null };
  biens: { reference: string };
};

type Profile = { id: string; nom: string; prenom: string | null };

type LigneAgent = {
  agentId: string;
  agentNom: string;
  paiements: Paiement[];
  total: number;
  nbPaiements: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  especes:           { label: "Espèces",        color: "#16a34a", emoji: "💵" },
  wave:              { label: "Wave",            color: "#0284c7", emoji: "📱" },
  orange_money:      { label: "Orange Money",    color: "#ea580c", emoji: "📱" },
  // mobile_money_om:   { label: "Mobile Money OM", color: "#ea580c", emoji: "📱" },
  mtn_money:         { label: "MTN Money",       color: "#ca8a04", emoji: "📱" },
  mobile_money_moov: { label: "Moov Money",      color: "#7c3aed", emoji: "📱" },
  virement:          { label: "Virement",        color: "#0f766e", emoji: "🏦" },
  versement_bancaire:{ label: "Versement banque",color: "#0f766e", emoji: "🏦" },
  cheque:            { label: "Chèque",          color: "#374151", emoji: "📄" },
};

const nomLocataire = (loc?: Paiement["baux"]["locataires"]) => {
  if (!loc) return "—";
  if (loc.type_personne === "morale") return loc.raison_sociale ?? "—";
  return `${loc.prenom ?? ""} ${loc.nom ?? ""}`.trim();
};

const calculPenalite = (r: RetardRow) =>
  Math.round((r.loyer_mensuel ?? 0) * ((r.taux_penalite_journalier ?? 0) / 100) * (r.jours_penalite_mois_courant ?? 0));

const totalDu = (r: RetardRow) =>
  (r.loyer_mensuel ?? 0) * (r.mois_retard ?? 1) + calculPenalite(r);

// ─── Helpers UI ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, emoji, accent }: {
  label: string; value: string; sub?: string; emoji: string; accent: string;
}) {
  return (
    <div style={{
      background: "white", border: "1px solid #e5e7eb", borderRadius: 14,
      padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase" }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: accent + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>{emoji}</div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af" }}>{sub}</div>}
    </div>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const cfg = MODE_CONFIG[mode] ?? { label: mode, color: "#6b7280", emoji: "💳" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: cfg.color + "15", color: cfg.color,
      border: `1px solid ${cfg.color}30`,
      borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function RetardBadge({ mois }: { mois: number }) {
  const color = mois >= 3 ? "#dc2626" : mois >= 2 ? "#ea580c" : "#ca8a04";
  return (
    <span style={{ background: color + "15", color, border: `1px solid ${color}30`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
      {mois} mois
    </span>
  );
}

// ─── Modal Encaissement ───────────────────────────────────────────────────────

function ModalEncaissement({ open, onClose, baux, onSuccess }: {
  open: boolean; onClose: () => void; baux: BailOption[]; onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({ bail_id: "", montant: "", mode: "especes", mois_concerne: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const bailChoisi = baux.find(b => b.id === form.bail_id);

  // Filtrage des baux selon la recherche
  const baux_filtres = search.length >= 1 ? baux.filter(b => {
    const q = search.toLowerCase();
    const nom = `${b.locataires?.prenom ?? ""} ${b.locataires?.nom ?? ""}`.toLowerCase();
    return nom.includes(q) || (b.reference ?? "").toLowerCase().includes(q) || (b.biens?.reference ?? "").toLowerCase().includes(q);
  }).slice(0, 15) : [];

  const onBailChange = (b: BailOption) => {
    setForm(f => ({ ...f, bail_id: b.id, montant: String(b.loyer_mensuel) }));
    setSearch(`${b.locataires?.prenom ?? ""} ${b.locataires?.nom ?? ""}`.trim());
    setShowDropdown(false);
  };

  const reset = () => {
    setForm({ bail_id: "", montant: "", mode: "especes", mois_concerne: "" });
    setSearch(""); setShowDropdown(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!form.bail_id || !form.montant || !form.mois_concerne) { setErr("Tous les champs sont obligatoires."); return; }
    setLoading(true);

    const montantSaisi = Number(form.montant);
    const loyer = bailChoisi?.loyer_mensuel ?? 0;
    const today = new Date().toISOString().slice(0, 10);

    // ── Quittance principale (loyer du mois) ──
    const montantLoyer = Math.min(montantSaisi, loyer > 0 ? loyer : montantSaisi);
    const prefixLoyer = `QUI-${form.mois_concerne.replace("-", "")}-`;
    const { count: cntLoyer } = await supabase.from("paiements").select("*", { count: "exact", head: true }).like("numero_quittance", `${prefixLoyer}%`);
    const numero_quittance = `${prefixLoyer}${String((cntLoyer ?? 0) + 1).padStart(4, "0")}`;

    const { error: e1 } = await supabase.from("paiements").insert({
      bail_id: form.bail_id,
      montant: montantLoyer,
      mode: form.mode as any,
      mois_concerne: `${form.mois_concerne}-01`,
      encaisse_par: user?.id,
      date_paiement: today,
      numero_quittance,
      type_paiement: "loyer",
    } as any);

    if (e1) { setLoading(false); setErr(e1.message); return; }

    // ── Acompte sur mois suivant si surplus ──
    const surplus = montantSaisi - montantLoyer;
    if (surplus > 0 && loyer > 0) {
      // Calculer le mois suivant
      const [annee, mois] = form.mois_concerne.split("-").map(Number);
      const dateSuivante = new Date(annee, mois, 1); // mois est 0-indexé en JS donc mois = mois suivant
      const moisSuivant = `${dateSuivante.getFullYear()}-${String(dateSuivante.getMonth() + 1).padStart(2, "0")}`;
      
      const prefixAcompte = `ACO-${moisSuivant.replace("-", "")}-`;
      const { count: cntAco } = await supabase.from("paiements").select("*", { count: "exact", head: true }).like("numero_quittance", `${prefixAcompte}%`);
      const numero_acompte = `${prefixAcompte}${String((cntAco ?? 0) + 1).padStart(4, "0")}`;

      await supabase.from("paiements").insert({
        bail_id: form.bail_id,
        montant: surplus,
        mode: form.mode as any,
        mois_concerne: `${moisSuivant}-01`,
        encaisse_par: user?.id,
        date_paiement: today,
        numero_quittance: numero_acompte,
        type_paiement: "acompte",
      } as any);
    }

    setLoading(false);
    onSuccess(); onClose(); reset();
  };

  if (!open) return null;

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", fontSize: 14, outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: ".04em", display: "block", marginBottom: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#111827" }}>Nouvel encaissement</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>Une quittance sera générée automatiquement</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 22 }}>×</button>
        </div>
        <div style={{ position: "relative" }}>
          <label style={lbl}>Locataire / Bail ({baux.length} baux chargés)</label>
          <input
            style={{ ...inp }}
            placeholder="🔍 Tapez un nom, prénom ou référence bail…"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true); if (!e.target.value) { setForm(f => ({ ...f, bail_id: "", montant: "" })); } }}
            onFocus={() => setShowDropdown(true)}
            autoComplete="off"
          />
          {/* Dropdown résultats */}
          {showDropdown && search.length >= 1 && (
            <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, maxHeight: 220, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 10, background: "#fff", boxShadow: "0 8px 30px rgba(0,0,0,.12)", marginTop: 4 }}>
              {baux_filtres.length === 0 ? (
                <div style={{ padding: "14px", color: "#9ca3af", fontSize: 13, textAlign: "center" }}>
                  Aucun résultat pour "<strong>{search}</strong>"
                </div>
              ) : baux_filtres.map(b => (
                <div key={b.id}
                  onClick={() => onBailChange(b)}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{b.locataires?.prenom} {b.locataires?.nom}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{b.reference} · {b.biens?.reference}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#16a34a" }}>{fmtFCFA(b.loyer_mensuel)}</div>
                </div>
              ))}
            </div>
          )}
          {/* Bail sélectionné */}
          {bailChoisi && !showDropdown && (
            <div style={{ marginTop: 8, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#15803d" }}>✅ {bailChoisi.locataires?.prenom} {bailChoisi.locataires?.nom}</div>
                <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>{bailChoisi.reference} · {bailChoisi.biens?.reference} · Loyer : {fmtFCFA(bailChoisi.loyer_mensuel)}</div>
              </div>
              <button type="button" onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>×</button>
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>Mois concerné</label>
            <input type="month" style={inp} value={form.mois_concerne} onChange={e => setForm(f => ({ ...f, mois_concerne: e.target.value }))} required />
          </div>
          <div>
            <label style={lbl}>Montant encaissé (FCFA)</label>
            <input type="number" style={inp} value={form.montant} min={0} onChange={e => setForm(f => ({ ...f, montant: e.target.value }))} required />
            {bailChoisi && Number(form.montant) > 0 && Number(form.montant) < bailChoisi.loyer_mensuel && (
              <div style={{ marginTop: 4, fontSize: 11, color: "#ca8a04", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 5, padding: "3px 8px" }}>
                ⚠️ Acompte — manque {fmtFCFA(bailChoisi.loyer_mensuel - Number(form.montant))} · Un reçu d'acompte sera généré
              </div>
            )}
            {bailChoisi && Number(form.montant) >= bailChoisi.loyer_mensuel && (
              <div style={{ marginTop: 4, fontSize: 11, color: "#16a34a", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 5, padding: "3px 8px" }}>
                ✅ Paiement complet — une quittance sera générée
              </div>
            )}
          </div>
        </div>
        <div>
          <label style={lbl}>Mode de paiement</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(MODE_CONFIG).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setForm(f => ({ ...f, mode: k }))} style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: form.mode === k ? `2px solid ${v.color}` : "1px solid #e5e7eb",
                background: form.mode === k ? v.color + "15" : "transparent",
                color: form.mode === k ? v.color : "#6b7280",
              }}>
                {v.emoji} {v.label}
              </button>
            ))}
          </div>
        </div>
        {err && <div style={{ color: "#dc2626", fontSize: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={() => { onClose(); reset(); }} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "none", color: "#374151", cursor: "pointer", fontSize: 14, fontWeight: 500 }}>Annuler</button>
          <button type="submit" disabled={loading} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontSize: 14, opacity: loading ? .7 : 1 }}>
            {loading ? "Enregistrement…" : 
              bailChoisi && Number(form.montant) > bailChoisi.loyer_mensuel 
                ? `Encaisser ${fmtFCFA(bailChoisi.loyer_mensuel)} + acompte ${fmtFCFA(Number(form.montant) - bailChoisi.loyer_mensuel)}`
                : "Encaisser & émettre quittance"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Modal Encaissement Batch Mobile ─────────────────────────────────────────

type LigneBatch = {
  id: number;
  bail_id: string;
  montant: string;
  mois_concerne: string;
  mode: string;
};

function ModalBatchMobile({ open, onClose, baux, onSuccess }: {
  open: boolean; onClose: () => void; baux: BailOption[]; onSuccess: () => void;
}) {
  const { user } = useAuth();
  const moisCourant = new Date().toISOString().slice(0, 7);
  const [mode, setMode] = useState<"orange_money" | "wave">("orange_money");
  const [lignes, setLignes] = useState<LigneBatch[]>([
    { id: 1, bail_id: "", montant: "", mois_concerne: moisCourant, mode: "orange_money" },
  ]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [etape, setEtape] = useState<"saisie" | "recap">("saisie");

  const addLigne = () => setLignes(l => [...l, { id: Date.now(), bail_id: "", montant: "", mois_concerne: moisCourant, mode }]);
  const removeLigne = (id: number) => setLignes(l => l.filter(x => x.id !== id));
  const updateLigne = (id: number, patch: Partial<LigneBatch>) => setLignes(l => l.map(x => x.id === id ? { ...x, ...patch } : x));

  const applyModeTout = (m: string) => {
    setMode(m as any);
    setLignes(l => l.map(x => ({ ...x, mode: m })));
  };

  const valider = () => {
    const vides = lignes.filter(l => !l.bail_id || !l.montant || !l.mois_concerne);
    if (vides.length > 0) { setErr("Complétez toutes les lignes avant de continuer."); return; }
    setErr(""); setEtape("recap");
  };

  const confirmer = async () => {
    setLoading(true);
    let erreurs = 0;
    for (const l of lignes) {
      const prefix = `QUI-${l.mois_concerne.replace("-", "")}-`;
      const { count } = await supabase.from("paiements").select("*", { count: "exact", head: true }).like("numero_quittance", `${prefix}%`);
      const numero_quittance = `${prefix}${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("paiements").insert({
        bail_id: l.bail_id,
        montant: Number(l.montant),
        mode: l.mode as any,
        mois_concerne: `${l.mois_concerne}-01`,
        encaisse_par: user?.id,
        date_paiement: new Date().toISOString().slice(0, 10),
        numero_quittance,
      });
      if (error) erreurs++;
    }
    setLoading(false);
    if (erreurs > 0) { setErr(`${erreurs} paiement(s) n'ont pas pu être enregistrés.`); return; }
    onSuccess(); onClose();
    setLignes([{ id: 1, bail_id: "", montant: "", mois_concerne: moisCourant, mode: "orange_money" }]);
    setEtape("saisie"); setErr("");
  };

  if (!open) return null;

  const MODES_MOBILE = [
    { key: "orange_money", label: "Orange Money", color: "#ea580c", emoji: "📱" },
    { key: "mobile_money_om", label: "OM Business", color: "#ea580c", emoji: "🏢" },
    { key: "wave", label: "Wave", color: "#0284c7", emoji: "📱" },
    { key: "mobile_money_moov", label: "Moov Money", color: "#7c3aed", emoji: "📱" },
    { key: "mtn_money", label: "MTN Money", color: "#ca8a04", emoji: "📱" },
  ];

  const totalBatch = lignes.reduce((s, l) => s + Number(l.montant || 0), 0);
  const inp: React.CSSProperties = { padding: "7px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", fontSize: 13, outline: "none", boxSizing: "border-box" as any };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#111827" }}>
              {etape === "saisie" ? "Encaissements mobiles en lot" : "Récapitulatif — Confirmer"}
            </div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
              {etape === "saisie" ? "Saisissez tous les dépôts reçus aujourd'hui" : `${lignes.length} paiement(s) · Total : ${fmtFCFA(totalBatch)}`}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 22 }}>×</button>
        </div>

        {etape === "saisie" && (
          <>
            {/* Mode global */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 8 }}>Mode de dépôt (appliqué à toutes les lignes)</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {MODES_MOBILE.map(m => (
                  <button key={m.key} onClick={() => applyModeTout(m.key)} style={{
                    display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 8,
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: mode === m.key ? `2px solid ${m.color}` : "1px solid #e5e7eb",
                    background: mode === m.key ? m.color + "15" : "transparent",
                    color: mode === m.key ? m.color : "#6b7280",
                  }}>
                    {m.emoji} {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Lignes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: ".04em", textTransform: "uppercase", padding: "0 4px" }}>
                <span>Locataire / Bail</span><span>Montant (FCFA)</span><span>Mois</span><span></span>
              </div>
              {lignes.map((l, i) => {
                const bail = baux.find(b => b.id === l.bail_id);
                return (
                  <div key={l.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "center", background: "#f9fafb", borderRadius: 10, padding: "10px 12px" }}>
                    <select style={{ ...inp, width: "100%" }} value={l.bail_id} onChange={e => {
                      const b = baux.find(x => x.id === e.target.value);
                      updateLigne(l.id, { bail_id: e.target.value, montant: b ? String(b.loyer_mensuel) : l.montant });
                    }}>
                      <option value="">Sélectionner…</option>
                      {baux.map(b => <option key={b.id} value={b.id}>{b.locataires?.prenom} {b.locataires?.nom} · {b.biens?.reference}</option>)}
                    </select>
                    <input type="number" style={{ ...inp, width: "100%" }} value={l.montant}
                      onChange={e => updateLigne(l.id, { montant: e.target.value })}
                      placeholder={bail ? String(bail.loyer_mensuel) : "0"} />
                    <input type="month" style={{ ...inp, width: "100%" }} value={l.mois_concerne}
                      onChange={e => updateLigne(l.id, { mois_concerne: e.target.value })} />
                    <button onClick={() => removeLigne(l.id)} disabled={lignes.length === 1}
                      style={{ background: "none", border: "none", cursor: lignes.length === 1 ? "not-allowed" : "pointer", color: "#9ca3af", fontSize: 18, padding: "0 4px" }}>×</button>
                  </div>
                );
              })}
            </div>

            <button onClick={addLigne} style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px dashed #e5e7eb", background: "none", color: "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              + Ajouter une ligne
            </button>

            {/* Total */}
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}>Total à encaisser</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{fmtFCFA(totalBatch)}</span>
            </div>
          </>
        )}

        {etape === "recap" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lignes.map((l, i) => {
              const bail = baux.find(b => b.id === l.bail_id);
              const modeCfg = MODES_MOBILE.find(m => m.key === l.mode) ?? MODES_MOBILE[0];
              return (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb", borderRadius: 10, padding: "12px 16px" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>
                      {bail?.locataires?.prenom} {bail?.locataires?.nom}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                      {bail?.biens?.reference} · {new Date(l.mois_concerne + "-01").toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, background: modeCfg.color + "15", color: modeCfg.color, border: `1px solid ${modeCfg.color}30`, borderRadius: 6, padding: "2px 8px", fontWeight: 600 }}>
                      {modeCfg.emoji} {modeCfg.label}
                    </span>
                    <span style={{ fontWeight: 800, color: "#16a34a", fontSize: 14 }}>{fmtFCFA(Number(l.montant))}</span>
                  </div>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginTop: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#15803d" }}>{lignes.length} paiement(s)</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>{fmtFCFA(totalBatch)}</span>
            </div>
          </div>
        )}

        {err && <div style={{ color: "#dc2626", fontSize: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {etape === "recap" && (
            <button onClick={() => setEtape("saisie")} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "none", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              ← Modifier
            </button>
          )}
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "none", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            Annuler
          </button>
          {etape === "saisie" ? (
            <button onClick={valider} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#ea580c", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              Vérifier →
            </button>
          ) : (
            <button onClick={confirmer} disabled={loading} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontSize: 13, opacity: loading ? .7 : 1 }}>
              {loading ? "Enregistrement…" : `Confirmer ${lignes.length} paiement(s)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Onglet Clôture ───────────────────────────────────────────────────────────

function OngletCloture({ paiements, profiles, dateJour }: {
  paiements: Paiement[];
  profiles: Profile[];
  dateJour: string;
}) {
  const [cloturée, setCloturée] = useState(false);
  const [heureCloture, setHeureCloture] = useState<string | null>(null);
  const { user, hasRole } = useAuth();
  const peutCloturer = hasRole("caisse") || hasRole("admin") || hasRole("direction");

  // Ventilation par mode de paiement
  const parMode = Object.keys(MODE_CONFIG).map(mode => {
    const lignes = paiements.filter(p => p.mode === mode);
    return { mode, ...MODE_CONFIG[mode], total: lignes.reduce((s, p) => s + Number(p.montant), 0), nb: lignes.length };
  }).filter(m => m.nb > 0);

  // Ventilation par agent
  const parAgent: LigneAgent[] = profiles.map(p => {
    const pp = paiements.filter(x => x.encaisse_par === p.id);
    return {
      agentId: p.id,
      agentNom: `${p.prenom ?? ""} ${p.nom}`.trim(),
      paiements: pp,
      total: pp.reduce((s, x) => s + Number(x.montant), 0),
      nbPaiements: pp.length,
    };
  }).filter(a => a.nbPaiements > 0);

  // Agents sans profil (encaisse_par non résolu)
  const inconnus = paiements.filter(p => p.encaisse_par && !profiles.find(pr => pr.id === p.encaisse_par));
  if (inconnus.length > 0) {
    parAgent.push({ agentId: "inconnu", agentNom: "Caissier inconnu", paiements: inconnus, total: inconnus.reduce((s, p) => s + Number(p.montant), 0), nbPaiements: inconnus.length });
  }

  const totalGeneral = paiements.reduce((s, p) => s + Number(p.montant), 0);

  // Export CSV
  const exportCSV = () => {
    const rows = [
      ["Quittance", "Date", "Mois concerné", "Locataire", "Bien", "Mode", "Montant FCFA", "Caissier"],
      ...paiements.map(p => [
        p.numero_quittance,
        p.date_paiement,
        p.mois_concerne ? new Date(p.mois_concerne).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "",
        nomLocataire(p.baux?.locataires),
        p.baux?.biens?.reference ?? "",
        MODE_CONFIG[p.mode]?.label ?? p.mode,
        String(p.montant),
        profiles.find(pr => pr.id === p.encaisse_par) ? `${profiles.find(pr => pr.id === p.encaisse_par)?.prenom ?? ""} ${profiles.find(pr => pr.id === p.encaisse_par)?.nom}`.trim() : p.encaisse_par ?? "—",
      ]),
      [],
      ["TOTAL", "", "", "", "", "", String(totalGeneral), ""],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cloture_caisse_${dateJour}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCloturer = () => {
    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    setCloturée(true);
    setHeureCloture(now);
  };

  const th: React.CSSProperties = { textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" };
  const td: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid #f3f4f6", color: "#111827", verticalAlign: "middle" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Bannière clôture */}
      {cloturée ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "16px 20px" }}>
          <CheckCircle size={22} color="#16a34a" />
          <div>
            <div style={{ fontWeight: 700, color: "#15803d", fontSize: 14 }}>Journée clôturée à {heureCloture}</div>
            <div style={{ fontSize: 12, color: "#16a34a", marginTop: 2 }}>Aucune modification possible. Archivez ce rapport ou exportez-le.</div>
          </div>
          <button onClick={exportCSV} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid #86efac", background: "white", color: "#15803d", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            <Download size={14} /> Exporter CSV
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 12, padding: "16px 20px" }}>
          <Clock size={20} color="#ca8a04" />
          <div>
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: 14 }}>Journée en cours — {dateJour}</div>
            <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>Clôturez en fin de journée pour valider les encaissements.</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
            <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              <Download size={14} /> Export CSV
            </button>
            {peutCloturer && paiements.length > 0 && (
              <button onClick={handleCloturer} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "none", background: "#ca8a04", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                <Lock size={14} /> Clôturer la journée
              </button>
            )}
          </div>
        </div>
      )}

      {/* Totaux par mode */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 14 }}>
          Ventilation par mode de paiement
        </div>
        {parMode.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 13, padding: "20px 0" }}>Aucun paiement enregistré.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            {parMode.map(m => (
              <div key={m.mode} style={{ border: `1px solid ${m.color}25`, borderRadius: 12, padding: "16px 18px", background: m.color + "08" }}>
                <div style={{ fontSize: 18, marginBottom: 6 }}>{m.emoji}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: m.color, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{fmtFCFA(m.total)}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{m.nb} paiement{m.nb > 1 ? "s" : ""}</div>
              </div>
            ))}
            {/* Total général */}
            <div style={{ border: "2px solid #111827", borderRadius: 12, padding: "16px 18px", background: "#f9fafb", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 4 }}>Total général</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a" }}>{fmtFCFA(totalGeneral)}</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{paiements.length} paiement{paiements.length > 1 ? "s" : ""}</div>
            </div>
          </div>
        )}
      </div>

      {/* Par agent / caissier */}
      {parAgent.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 14 }}>
            Récapitulatif par caissier
          </div>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#f9fafb" }}>
                <tr>
                  <th style={th}>Caissier</th>
                  <th style={{ ...th, textAlign: "center" }}>Nb paiements</th>
                  <th style={{ ...th, textAlign: "right" }}>Total encaissé</th>
                  <th style={{ ...th, textAlign: "right" }}>% du total</th>
                </tr>
              </thead>
              <tbody>
                {parAgent.sort((a, b) => b.total - a.total).map(a => {
                  const pct = totalGeneral > 0 ? Math.round((a.total / totalGeneral) * 100) : 0;
                  return (
                    <tr key={a.agentId}>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
                            {a.agentNom.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: 600 }}>{a.agentNom}</span>
                          {a.agentId === user?.id && <span style={{ fontSize: 10, background: "#dbeafe", color: "#1d4ed8", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>Vous</span>}
                        </div>
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <span style={{ background: "#f1f5f9", borderRadius: 6, padding: "2px 10px", fontWeight: 700, fontSize: 12 }}>{a.nbPaiements}</span>
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#16a34a", fontSize: 14 }}>{fmtFCFA(a.total)}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                          <div style={{ width: 80, height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: "#16a34a", borderRadius: 3, transition: "width .4s" }} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: 12, color: "#374151", minWidth: 32, textAlign: "right" }}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: "#f0fdf4" }}>
                  <td style={{ ...td, fontWeight: 700, color: "#15803d", borderBottom: "none" }}>Total</td>
                  <td style={{ ...td, textAlign: "center", fontWeight: 700, color: "#15803d", borderBottom: "none" }}>{paiements.length}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 900, color: "#16a34a", fontSize: 15, borderBottom: "none" }}>{fmtFCFA(totalGeneral)}</td>
                  <td style={{ ...td, borderBottom: "none" }}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Détail complet */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 14 }}>
          Détail de tous les paiements du jour
        </div>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th style={th}>Quittance</th>
                <th style={th}>Locataire</th>
                <th style={th}>Bien</th>
                <th style={th}>Mois</th>
                <th style={th}>Mode</th>
                <th style={th}>Caissier</th>
                <th style={{ ...th, textAlign: "right" }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {paiements.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "36px 16px", borderBottom: "none" }}>Aucun paiement aujourd'hui</td></tr>
              ) : (
                paiements.map(p => {
                  const prof = profiles.find(pr => pr.id === p.encaisse_par);
                  return (
                    <tr key={p.id}>
                      <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{p.numero_quittance || "—"}</span></td>
                      <td style={td}>
                        {p.baux?.locataires
                          ? <Link to={`/locataires/${p.baux.locataires.id}`} style={{ color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>{nomLocataire(p.baux.locataires)}</Link>
                          : "—"}
                      </td>
                      <td style={{ ...td, color: "#9ca3af" }}>{p.baux?.biens?.reference ?? "—"}</td>
                      <td style={td}>{p.mois_concerne ? new Date(p.mois_concerne).toLocaleDateString("fr-FR", { month: "short", year: "numeric" }) : "—"}</td>
                      <td style={td}><ModeBadge mode={p.mode} /></td>
                      <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>
                        {prof ? `${prof.prenom ?? ""} ${prof.nom}`.trim() : "—"}
                      </td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#16a34a" }}>{fmtFCFA(p.montant)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {paiements.length > 0 && (
              <tfoot>
                <tr style={{ background: "#f0fdf4" }}>
                  <td colSpan={6} style={{ ...td, fontWeight: 700, color: "#15803d", borderBottom: "none" }}>Total du jour</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 900, fontSize: 16, color: "#16a34a", borderBottom: "none" }}>{fmtFCFA(paiements.reduce((s, p) => s + Number(p.montant), 0))}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Caisse() {
  const { hasRole } = useAuth();
  const canEncaisser = hasRole("caisse") || hasRole("admin") || hasRole("direction");

  const [onglet, setOnglet] = useState<"dashboard" | "cloture">("dashboard");
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [retards, setRetards] = useState<RetardRow[]>([]);
  const [baux, setBaux] = useState<BailOption[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ msg: string; ok: boolean } | null>(null);
  const [spinning, setSpinning] = useState(false);

  const dateJour = new Date().toISOString().slice(0, 10);

  const showToast = (msg: string, ok = true) => {
    setToastMsg({ msg, ok });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setSpinning(true);
    const [{ data: paie }, { data: ret }, { data: b }, { data: prof }] = await Promise.all([
      supabase.from("paiements")
        .select("id, numero_quittance, montant, mois_concerne, date_paiement, mode, encaisse_par, baux!paiements_bail_fk(reference, locataires!baux_locataire_id_fkey(id, nom, prenom, type_personne, raison_sociale), biens!baux_bien_fk(reference))")
        .eq("date_paiement", dateJour)
        .order("created_at", { ascending: false }),
      supabase.from("v_loyers_retard").select("*").order("mois_retard", { ascending: false }),
      supabase.from("baux").select("id, reference, loyer_mensuel, locataires!baux_locataire_id_fkey(nom, prenom), biens!baux_bien_fk(reference)").eq("statut", "actif"),
      supabase.from("profiles").select("id, nom, prenom"),
    ]);
    setPaiements((paie ?? []) as any);
    setRetards((ret ?? []) as any);
    setBaux((b ?? []) as any);
    setProfiles((prof ?? []) as any);
    setLoadingData(false);
    setTimeout(() => setSpinning(false), 600);
  }, [dateJour]);

  useEffect(() => { loadData(); }, [loadData]);

  const totalJour = paiements.reduce((s, p) => s + Number(p.montant), 0);
  const nbRetards = retards.length;
  const montantRetards = retards.reduce((s, r) => s + totalDu(r), 0);
  const tauxRecouvrement = baux.length > 0 ? Math.round(((baux.length - nbRetards) / baux.length) * 100) : 100;

  const th: React.CSSProperties = { textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" };
  const td: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid #f3f4f6", color: "#111827", verticalAlign: "middle" };

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 100, background: toastMsg.ok ? "#16a34a" : "#dc2626", color: "#fff", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>
          {toastMsg.msg}
        </div>
      )}

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-.02em" }}>Caisse</h1>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "5px 0 0" }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadData} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #e5e7eb", background: "white", color: "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            <RefreshCw size={14} style={{ animation: spinning ? "spin 1s linear infinite" : "none" }} /> Actualiser
          </button>
          {canEncaisser && (
            <button onClick={() => setOpenModal(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
              <Plus size={15} /> Nouvel encaissement
            </button>
          )}
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 28 }}>
        {([
          { key: "dashboard", label: "Tableau de bord", icon: <LayoutDashboard size={14} /> },
          { key: "cloture",   label: "Clôture journalière", icon: <Lock size={14} /> },
        ] as const).map(o => (
          <button key={o.key} onClick={() => setOnglet(o.key)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 18px", border: "none", background: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600,
            color: onglet === o.key ? "#111827" : "#6b7280",
            borderBottom: onglet === o.key ? "2px solid #111827" : "2px solid transparent",
            marginBottom: -2, transition: "color .15s",
          }}>
            {o.icon} {o.label}
            {o.key === "cloture" && paiements.length > 0 && (
              <span style={{ background: "#16a34a", color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{paiements.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══ ONGLET DASHBOARD ══ */}
      {onglet === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

          {/* KPI */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <KpiCard label="Encaissé aujourd'hui" value={fmtFCFA(totalJour)} sub={`${paiements.length} paiement${paiements.length !== 1 ? "s" : ""}`} emoji="💰" accent="#16a34a" />
            <KpiCard label="Baux en retard" value={String(nbRetards)} sub={nbRetards > 0 ? `${fmtFCFA(montantRetards)} à recouvrer` : "Aucun retard"} emoji={nbRetards > 0 ? "🔴" : "✅"} accent={nbRetards > 0 ? "#dc2626" : "#16a34a"} />
            <KpiCard label="Baux actifs" value={String(baux.length)} sub="contrats en cours" emoji="🏠" accent="#0284c7" />
            <KpiCard label="Taux de recouvrement" value={`${tauxRecouvrement}%`} sub="baux à jour / total" emoji={tauxRecouvrement >= 90 ? "📈" : "⚠️"} accent={tauxRecouvrement >= 90 ? "#16a34a" : tauxRecouvrement >= 70 ? "#ca8a04" : "#dc2626"} />
          </div>

          {/* Paiements du jour */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 14 }}>Encaissements du jour</div>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={th}>Quittance</th><th style={th}>Locataire</th><th style={th}>Bien</th>
                    <th style={th}>Mois</th><th style={th}>Mode</th>
                    <th style={{ ...th, textAlign: "right" }}>Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {paiements.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "36px 16px", borderBottom: "none" }}>
                      {loadingData ? "Chargement…" : "Aucun encaissement enregistré aujourd'hui"}
                    </td></tr>
                  ) : paiements.map(p => (
                    <tr key={p.id}>
                      <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{p.numero_quittance || "—"}</span></td>
                      <td style={td}>
                        {p.baux?.locataires
                          ? <Link to={`/locataires/${p.baux.locataires.id}`} style={{ color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>{nomLocataire(p.baux.locataires)}</Link>
                          : "—"}
                      </td>
                      <td style={{ ...td, color: "#9ca3af" }}>{p.baux?.biens?.reference ?? "—"}</td>
                      <td style={td}>{p.mois_concerne ? new Date(p.mois_concerne).toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) : "—"}</td>
                      <td style={td}><ModeBadge mode={p.mode} /></td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#16a34a", fontSize: 14 }}>{fmtFCFA(p.montant)}</td>
                    </tr>
                  ))}
                </tbody>
                {paiements.length > 0 && (
                  <tfoot>
                    <tr style={{ background: "#f0fdf4" }}>
                      <td colSpan={5} style={{ ...td, fontWeight: 700, color: "#15803d", borderBottom: "none" }}>Total encaissé</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 900, fontSize: 16, color: "#16a34a", borderBottom: "none" }}>{fmtFCFA(totalJour)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Retards */}
          {nbRetards > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", letterSpacing: ".06em", textTransform: "uppercase" }}>Baux en retard ({nbRetards})</div>
                <Link to="/recouvrement" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>
                  Voir le recouvrement <ChevronRight size={14} />
                </Link>
              </div>
              <div style={{ border: "1px solid #fecaca", borderRadius: 12, overflow: "hidden", background: "white" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead style={{ background: "#fff5f5" }}>
                    <tr>
                      <th style={{ ...th, color: "#dc2626" }}>Bail</th>
                      <th style={{ ...th, color: "#dc2626" }}>Retard</th>
                      <th style={{ ...th, color: "#dc2626" }}>Loyer / mois</th>
                      <th style={{ ...th, color: "#dc2626" }}>Pénalités</th>
                      <th style={{ ...th, color: "#dc2626", textAlign: "right" }}>Total dû</th>
                      <th style={{ ...th, color: "#dc2626" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {retards.map((r, i) => (
                      <tr key={r.bail_id ?? i}>
                        <td style={td}>
                          <span style={{ fontWeight: 700 }}>{r.reference ?? "—"}</span>
                          {r.transfert_juridique_propose && <span style={{ marginLeft: 8, fontSize: 10, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 4, padding: "1px 6px", fontWeight: 600 }}>Juridique</span>}
                        </td>
                        <td style={td}><RetardBadge mois={r.mois_retard ?? 0} /></td>
                        <td style={{ ...td, color: "#6b7280" }}>{fmtFCFA(r.loyer_mensuel)}</td>
                        <td style={{ ...td, color: "#ea580c", fontWeight: 600 }}>{fmtFCFA(calculPenalite(r))}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#dc2626", fontSize: 14 }}>{fmtFCFA(totalDu(r))}</td>
                        <td style={td}>
                          {canEncaisser && (
                            <button onClick={() => setOpenModal(true)} style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #e5e7eb", background: "white", color: "#0284c7", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                              Encaisser
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#fff5f5" }}>
                      <td colSpan={4} style={{ ...td, fontWeight: 700, color: "#dc2626", borderBottom: "none" }}>Total à recouvrer</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 900, fontSize: 16, color: "#dc2626", borderBottom: "none" }}>{fmtFCFA(montantRetards)}</td>
                      <td style={{ ...td, borderBottom: "none" }} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ ONGLET CLÔTURE ══ */}
      {onglet === "cloture" && (
        <OngletCloture paiements={paiements} profiles={profiles} dateJour={dateJour} />
      )}

      <ModalEncaissement
        open={openModal}
        onClose={() => setOpenModal(false)}
        baux={baux}
        onSuccess={() => { loadData(); showToast("Encaissement enregistré — quittance générée"); }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}