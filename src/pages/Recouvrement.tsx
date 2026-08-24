import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fmtFCFA } from "@/lib/format";
import { buildWhatsAppLink, buildSmsLink, renderTemplate } from "@/lib/messaging";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle, MessageSquare, Send, Gavel,
  RefreshCw, ChevronRight, Phone, Layers,
  List, Clock, CheckCircle, XCircle, Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BailOption = {
  id: string;
  reference: string;
  loyer_mensuel: number;
  locataires: { nom: string; prenom: string | null };
  biens: { reference: string };
};

type Impaye = {
  bail_id: string;
  reference_bail: string;
  locataire_id: string | null;
  locataire: string;
  locataire_nom: string;
  locataire_telephone: string | null;
  bien: string;
  loyer: number;
  mois_dus: number;
  montant_du: number;
  est_partiel: boolean;
  montant_partiel_paye: number;
  jour_echeance: number;
  premier_mois_du: string;
  stade: "amiable" | "ferme" | "pre_juridique" | "juridique";
};

type Relance = {
  id: string;
  bail_id: string;
  canal: string;
  contenu_envoye: string;
  date_envoi: string;
  destinataire: string;
  statut: string;
  envoye_par: string | null;
  modele_id: string | null;
};

type Modele = {
  id: string;
  nom: string;
  canal: string;
  contenu: string;
  jour_declenchement: number;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const STADE_CONFIG = {
  amiable:       { label: "Relance amiable",  color: "#ca8a04", bg: "#fffbeb", border: "#fcd34d", emoji: "💬", moisMin: 1, moisMax: 1 },
  ferme:         { label: "Relance ferme",     color: "#ea580c", bg: "#fff7ed", border: "#fdba74", emoji: "⚠️", moisMin: 2, moisMax: 2 },
  pre_juridique: { label: "Pré-juridique",     color: "#dc2626", bg: "#fef2f2", border: "#fca5a5", emoji: "🔴", moisMin: 3, moisMax: 3 },
  juridique:     { label: "Dossier juridique", color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd", emoji: "⚖️", moisMin: 4, moisMax: 99 },
} as const;

const CANAL_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  whatsapp: { label: "WhatsApp", color: "#16a34a", emoji: "💬" },
  sms:      { label: "SMS",      color: "#0284c7", emoji: "📱" },
  email:    { label: "Email",    color: "#6b7280", emoji: "📧" },
};

const STATUT_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  envoyee: { label: "Envoyée",   icon: <CheckCircle size={12} />, color: "#16a34a" },
  lue:     { label: "Lue",       icon: <CheckCircle size={12} />, color: "#0284c7" },
  echec:   { label: "Échec",     icon: <XCircle size={12} />,     color: "#dc2626" },
  preparee:{ label: "Préparée",  icon: <Clock size={12} />,       color: "#6b7280" },
};

const getStade = (mois: number): Impaye["stade"] => {
  if (mois >= 4) return "juridique";
  if (mois >= 3) return "pre_juridique";
  if (mois >= 2) return "ferme";
  return "amiable";
};

// ─── Helpers UI ───────────────────────────────────────────────────────────────

const s = (base: React.CSSProperties, ...rest: React.CSSProperties[]): React.CSSProperties =>
  Object.assign({}, base, ...rest);

function KpiCard({ label, value, sub, emoji, accent }: {
  label: string; value: string; sub?: string; emoji: string; accent: string;
}) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase" }}>{label}</span>
        <span style={{ fontSize: 20 }}>{emoji}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af" }}>{sub}</div>}
    </div>
  );
}

// ─── Modal Relance ────────────────────────────────────────────────────────────

function ModalRelance({ target, modeles, onClose, onSent }: {
  target: Impaye; modeles: Modele[]; onClose: () => void; onSent: () => void;
}) {
  const { user } = useAuth();
  const [modeleId, setModeleId] = useState(modeles[0]?.id ?? "");
  const [canal, setCanal] = useState<"whatsapp" | "sms">("whatsapp");
  const [contenu, setContenu] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");

  const applyModele = useCallback((id: string, t: Impaye) => {
    const m = modeles.find(x => x.id === id);
    if (!m) return;
    setCanal(m.canal as any);
    const moisLabel = new Date(t.premier_mois_du).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    setContenu(renderTemplate(m.contenu, {
      nom: t.locataire_nom || t.locataire,
      montant: new Intl.NumberFormat("fr-FR").format(t.montant_du),
      mois: moisLabel,
      bien: t.bien,
      loyer: new Intl.NumberFormat("fr-FR").format(t.loyer),
      mois_dus: String(t.mois_dus),
    }));
  }, [modeles]);

  useEffect(() => {
    if (modeles.length > 0) applyModele(modeles[0].id, target);
  }, [target, modeles, applyModele]);

  const envoyer = async () => {
    if (!target.locataire_telephone) return;
    setErr("");
    setSending(true);
    const link = canal === "whatsapp"
      ? buildWhatsAppLink(target.locataire_telephone, contenu)
      : buildSmsLink(target.locataire_telephone, contenu);
    const { error } = await supabase.from("relances_envoyees").insert({
      bail_id: target.bail_id, modele_id: modeleId || null, canal,
      destinataire: target.locataire_telephone, contenu_envoye: contenu,
      statut: "envoyee", envoye_par: user?.id ?? null,
    });
    setSending(false);
    if (error) { setErr(error.message); return; }
    window.open(link, "_blank");
    onSent();
    onClose();
  };

  const inp: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", color: "#111827", fontSize: 13, outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".04em", display: "block", marginBottom: 5 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 520, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>

        {/* En-tête */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#111827" }}>Relancer {target.locataire}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3, display: "flex", gap: 12 }}>
              <span><Phone size={11} style={{ verticalAlign: "middle" }} /> {target.locataire_telephone}</span>
              <span style={{ color: "#dc2626", fontWeight: 600 }}>{fmtFCFA(target.montant_du)} dû · {target.mois_dus} mois</span>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 22 }}>×</button>
        </div>

        {/* Modèle */}
        <div>
          <label style={lbl}>Modèle de relance</label>
          <select style={inp} value={modeleId} onChange={e => { setModeleId(e.target.value); applyModele(e.target.value, target); }}>
            <option value="">— Message libre —</option>
            {modeles.map(m => <option key={m.id} value={m.id}>{m.nom} (J+{m.jour_declenchement})</option>)}
          </select>
        </div>

        {/* Canal */}
        <div>
          <label style={lbl}>Canal d'envoi</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["whatsapp", "sms"] as const).map(c => {
              const cfg = CANAL_CONFIG[c];
              return (
                <button key={c} type="button" onClick={() => setCanal(c)} style={{
                  flex: 1, padding: "8px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: canal === c ? `2px solid ${cfg.color}` : "1px solid #e5e7eb",
                  background: canal === c ? cfg.color + "12" : "transparent",
                  color: canal === c ? cfg.color : "#6b7280",
                }}>
                  {cfg.emoji} {cfg.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Message */}
        <div>
          <label style={lbl}>Message (modifiable)</label>
          <textarea rows={6} value={contenu} onChange={e => setContenu(e.target.value)}
            style={{ ...inp, resize: "vertical", lineHeight: 1.6, fontFamily: "inherit" }} />
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Variables : {`{{nom}}`} {`{{montant}}`} {`{{mois}}`} {`{{bien}}`}</div>
        </div>

        {/* Info */}
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#0369a1" }}>
          Le bouton "Envoyer" ouvrira {canal === "whatsapp" ? "WhatsApp" : "l'app SMS"} avec le message pré-rempli. L'envoi sera enregistré dans l'historique.
        </div>

        {err && <div style={{ color: "#dc2626", fontSize: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "none", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Annuler</button>
          <button onClick={envoyer} disabled={sending || !target.locataire_telephone || !contenu} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, border: "none", background: canal === "whatsapp" ? "#16a34a" : "#0284c7", color: "#fff", fontWeight: 700, cursor: sending ? "wait" : "pointer", fontSize: 13, opacity: (!target.locataire_telephone || !contenu) ? .5 : 1 }}>
            <Send size={14} /> {sending ? "Envoi…" : `Envoyer via ${canal === "whatsapp" ? "WhatsApp" : "SMS"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Transfert Juridique ────────────────────────────────────────────────

function ModalTransfert({ target, onClose, onDone }: {
  target: Impaye; onClose: () => void; onDone: (id: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const confirmer = async () => {
    setErr("");
    setLoading(true);
    const { error } = await supabase.rpc("transferer_au_juridique", { p_bail_id: target.bail_id });
    setLoading(false);
    if (error) { setErr(error.message); return; }
    onDone(target.bail_id);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: "100%", maxWidth: 460, display: "flex", flexDirection: "column", gap: 18, boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Gavel size={20} color="#dc2626" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#dc2626" }}>Transférer au juridique</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>Action irréversible</div>
          </div>
        </div>

        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "14px 16px", fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#dc2626", marginBottom: 10 }}>⚠️ Une fois transféré, le dossier sort du recouvrement amiable.</div>
          {[
            ["Locataire", target.locataire],
            ["Bien", target.bien],
            ["Retard", `${target.mois_dus} mois`],
            ["Montant dû", fmtFCFA(target.montant_du)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #fecaca" }}>
              <span style={{ color: "#6b7280" }}>{k}</span>
              <span style={{ fontWeight: 600, color: "#111827" }}>{v}</span>
            </div>
          ))}
        </div>

        {err && <div style={{ color: "#dc2626", fontSize: 12, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px" }}>{err}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={loading} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid #e5e7eb", background: "none", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>Annuler</button>
          <button onClick={confirmer} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontSize: 13, opacity: loading ? .7 : 1 }}>
            <Gavel size={14} /> {loading ? "Transfert…" : "Confirmer le transfert"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Onglet Pipeline ─────────────────────────────────────────────────────────

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


function OngletPipeline({ impayes, onRelancer, onTransferer }: {
  impayes: Impaye[];
  onRelancer: (i: Impaye) => void;
  onTransferer: (i: Impaye) => void;
}) {
  const stades = (["amiable", "ferme", "pre_juridique", "juridique"] as const);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
      {stades.map(stade => {
        const cfg = STADE_CONFIG[stade];
        const dossiers = impayes.filter(i => i.stade === stade);
        const total = dossiers.reduce((s, i) => s + i.montant_du, 0);

        return (
          <div key={stade} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Header colonne */}
            <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                </div>
                <span style={{ background: cfg.color, color: "white", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{dossiers.length}</span>
              </div>
              {total > 0 && <div style={{ fontSize: 12, color: cfg.color, fontWeight: 700, marginTop: 4 }}>{fmtFCFA(total)}</div>}
            </div>

            {/* Cartes dossiers */}
            {dossiers.length === 0 ? (
              <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "20px 0" }}>Aucun dossier</div>
            ) : (
              dossiers.map(i => (
                <div key={i.bail_id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
                      {i.locataire_id
                        ? <Link to={`/locataires/${i.locataire_id}`} style={{ color: "#111827", textDecoration: "none" }}>{i.locataire}</Link>
                        : i.locataire}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{i.bien}</div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 5, padding: "2px 7px", fontWeight: 700 }}>
                      {i.mois_dus} mois
                    </span>
                    <span style={{ fontWeight: 800, color: "#dc2626", fontSize: 14 }}>{fmtFCFA(i.montant_du)}</span>
                  </div>

                  {i.est_partiel && (
                    <div style={{ fontSize: 11, color: "#ca8a04", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 5, padding: "3px 8px" }}>
                      Partiel : {fmtFCFA(i.montant_partiel_paye)} versé
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => onRelancer(i)} disabled={!i.locataire_telephone}
                      title={!i.locataire_telephone ? "Aucun téléphone enregistré" : ""}
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px", borderRadius: 7, border: "1px solid #e5e7eb", background: "white", color: i.locataire_telephone ? "#0284c7" : "#9ca3af", cursor: i.locataire_telephone ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 600 }}>
                      <MessageSquare size={12} /> Relancer
                    </button>
                    {i.mois_dus >= 2 && (
                      <button onClick={() => onTransferer(i)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px", borderRadius: 7, border: "none", background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                        <Gavel size={12} /> Juridique
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Onglet Liste ─────────────────────────────────────────────────────────────

function OngletListe({ impayes, onRelancer, onTransferer, onExport }: {
  impayes: Impaye[];
  onRelancer: (i: Impaye) => void;
  onTransferer: (i: Impaye) => void;
  onExport: () => void;
}) {
  const [filtre, setFiltre] = useState<"tous" | Impaye["stade"]>("tous");
  const filtres = impayes.filter(i => filtre === "tous" || i.stade === filtre);

  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" };
  const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filtres + export */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {([["tous", "Tous"], ["amiable", "Amiable"], ["ferme", "Ferme"], ["pre_juridique", "Pré-juridique"], ["juridique", "Juridique"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFiltre(k)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: filtre === k ? "2px solid #111827" : "1px solid #e5e7eb",
            background: filtre === k ? "#111827" : "white",
            color: filtre === k ? "white" : "#6b7280",
          }}>
            {l} {k !== "tous" ? `(${impayes.filter(i => i.stade === k).length})` : `(${impayes.length})`}
          </button>
        ))}
        <button onClick={onExport} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ background: "#f9fafb" }}>
            <tr>
              <th style={th}>Locataire</th>
              <th style={th}>Bien</th>
              <th style={{ ...th, textAlign: "center" }}>Retard</th>
              <th style={th}>Stade</th>
              <th style={{ ...th, textAlign: "right" }}>Montant dû</th>
              <th style={{ ...th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtres.length === 0 ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "36px" }}>Aucun dossier dans ce filtre</td></tr>
            ) : (
              filtres.map(i => {
                const cfg = STADE_CONFIG[i.stade];
                return (
                  <tr key={i.bail_id}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>
                        {i.locataire_id
                          ? <Link to={`/locataires/${i.locataire_id}`} style={{ color: "#0284c7", textDecoration: "none" }}>{i.locataire}</Link>
                          : i.locataire}
                      </div>
                      {i.locataire_telephone && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{i.locataire_telephone}</div>}
                    </td>
                    <td style={{ ...td, color: "#9ca3af", fontSize: 12 }}>{i.bien}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        {i.mois_dus} mois
                      </span>
                      {i.est_partiel && <div style={{ fontSize: 10, color: "#ca8a04", marginTop: 3 }}>partiel</div>}
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.emoji} {cfg.label}</span>
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 800, color: "#dc2626", fontSize: 14 }}>{fmtFCFA(i.montant_du)}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => onRelancer(i)} disabled={!i.locataire_telephone}
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid #e5e7eb", background: "white", color: i.locataire_telephone ? "#0284c7" : "#9ca3af", cursor: i.locataire_telephone ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 600 }}>
                          <MessageSquare size={11} /> Relancer
                        </button>
                        {i.mois_dus >= 2 && (
                          <button onClick={() => onTransferer(i)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "none", background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                            <Gavel size={11} /> Juridique
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filtres.length > 0 && (
            <tfoot>
              <tr style={{ background: "#fff5f5" }}>
                <td colSpan={4} style={{ ...td, fontWeight: 700, color: "#dc2626", borderBottom: "none" }}>Total à recouvrer</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 900, fontSize: 15, color: "#dc2626", borderBottom: "none" }}>
                  {fmtFCFA(filtres.reduce((s, i) => s + i.montant_du, 0))}
                </td>
                <td style={{ ...td, borderBottom: "none" }} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ─── Onglet Historique ────────────────────────────────────────────────────────

function OngletHistorique({ relances, impayes }: { relances: Relance[]; impayes: Impaye[] }) {
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" };
  const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", fontSize: 13 };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f9fafb" }}>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Locataire</th>
            <th style={th}>Canal</th>
            <th style={th}>Message</th>
            <th style={th}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {relances.length === 0 ? (
            <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "36px" }}>Aucune relance envoyée</td></tr>
          ) : (
            relances.map(r => {
              const impaye = impayes.find(i => i.bail_id === r.bail_id);
              const canalCfg = CANAL_CONFIG[r.canal] ?? { label: r.canal, color: "#6b7280", emoji: "📨" };
              const statutCfg = STATUT_CONFIG[r.statut] ?? { label: r.statut, icon: null, color: "#6b7280" };
              return (
                <tr key={r.id}>
                  <td style={{ ...td, color: "#9ca3af", fontSize: 12 }}>
                    {new Date(r.date_envoi).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                    <div style={{ fontSize: 10 }}>{new Date(r.date_envoi).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td style={td}>
                    {impaye
                      ? <div><div style={{ fontWeight: 600 }}>{impaye.locataire}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{impaye.bien}</div></div>
                      : <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{r.bail_id.slice(0, 8)}…</span>}
                  </td>
                  <td style={td}>
                    <span style={{ background: canalCfg.color + "15", color: canalCfg.color, border: `1px solid ${canalCfg.color}30`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                      {canalCfg.emoji} {canalCfg.label}
                    </span>
                  </td>
                  <td style={{ ...td, maxWidth: 280 }}>
                    <div style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contenu_envoye}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{r.destinataire}</div>
                  </td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: statutCfg.color }}>
                      {statutCfg.icon} {statutCfg.label}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function Recouvrement() {
  const [onglet, setOnglet] = useState<"pipeline" | "liste" | "historique">("pipeline");
  const [openBatch, setOpenBatch] = useState(false);
  const [baux, setBaux] = useState<BailOption[]>([]);
  const [impayes, setImpayes] = useState<Impaye[]>([]);
  const [relances, setRelances] = useState<Relance[]>([]);
  const [modeles, setModeles] = useState<Modele[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [targetRelance, setTargetRelance] = useState<Impaye | null>(null);
  const [targetTransfert, setTargetTransfert] = useState<Impaye | null>(null);
  const [toastMsg, setToastMsg] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToastMsg({ msg, ok });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setSpinning(true);
    const today = new Date();

    const [{ data: bxActifs }, { data: baux_data }, { data: paiements }, { data: mods }, { data: rels }] = await Promise.all([
      supabase.from("baux").select("id, reference, loyer_mensuel, locataires!baux_locataire_id_fkey(nom, prenom), biens!baux_bien_fk(reference)").eq("statut", "actif"),
      supabase.from("baux")
        .select("id, reference, loyer_mensuel, jour_echeance, date_entree, locataire_id, transfere_juridique_le, locataires(id, nom, prenom, telephone), biens(reference, quartier)")
        .eq("statut", "actif")
        .is("transfere_juridique_le", null),
      supabase.from("paiements").select("bail_id, mois_concerne, montant"),
      supabase.from("modeles_relance").select("*").eq("actif", true).order("jour_declenchement"),
      supabase.from("relances_envoyees").select("*").order("date_envoi", { ascending: false }).limit(100),
    ]);

    setBaux((bxActifs ?? []) as any);
    setModeles((mods ?? []) as any);
    setRelances((rels ?? []) as any);

    // Calcul des impayés
    const paiesParBail = new Map<string, Map<string, number>>();
    (paiements ?? []).forEach((p: any) => {
      const m = paiesParBail.get(p.bail_id) ?? new Map<string, number>();
      m.set(p.mois_concerne, (m.get(p.mois_concerne) ?? 0) + Number(p.montant));
      paiesParBail.set(p.bail_id, m);
    });

    const result: Impaye[] = [];
    (baux ?? []).forEach((b: any) => {
      const dateEntree = new Date(b.date_entree);
      const bailMap = paiesParBail.get(b.id) ?? new Map<string, number>();
      let cursor = new Date(dateEntree.getFullYear(), dateEntree.getMonth(), 1);
      const moisCourant = new Date(today.getFullYear(), today.getMonth(), 1);

      let moisDusCount = 0, montantDuTotal = 0, premierMoisDu = "", premierPaye = 0, estPartiel = false;

      while (cursor <= moisCourant) {
        const iso = cursor.toISOString().slice(0, 10);
        const isCourant = cursor.getTime() === moisCourant.getTime();
        if (isCourant && today.getDate() <= b.jour_echeance) { cursor.setMonth(cursor.getMonth() + 1); continue; }

        const loyer = Number(b.loyer_mensuel);
        const paye = bailMap.get(iso) ?? 0;
        if (paye < loyer) {
          moisDusCount++;
          montantDuTotal += loyer - paye;
          if (!premierMoisDu) { premierMoisDu = iso; premierPaye = paye; estPartiel = paye > 0; }
        }
        cursor.setMonth(cursor.getMonth() + 1);
      }

      if (moisDusCount > 0) {
        result.push({
          bail_id: b.id,
          reference_bail: b.reference,
          locataire_id: b.locataires?.id ?? null,
          locataire: `${b.locataires?.prenom ?? ""} ${b.locataires?.nom ?? ""}`.trim(),
          locataire_nom: b.locataires?.nom ?? "",
          locataire_telephone: b.locataires?.telephone ?? null,
          bien: `${b.biens?.reference ?? ""}${b.biens?.quartier ? " · " + b.biens.quartier : ""}`,
          loyer: Number(b.loyer_mensuel),
          mois_dus: moisDusCount,
          montant_du: montantDuTotal,
          est_partiel: estPartiel,
          montant_partiel_paye: premierPaye,
          jour_echeance: b.jour_echeance,
          premier_mois_du: premierMoisDu,
          stade: getStade(moisDusCount),
        });
      }
    });

    result.sort((a, b) => b.mois_dus - a.mois_dus);
    setImpayes(result);
    setLoading(false);
    setTimeout(() => setSpinning(false), 600);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const exportCSV = () => {
    const rows = [
      ["Locataire", "Bien", "Téléphone", "Mois de retard", "Stade", "Loyer mensuel", "Montant dû"],
      ...impayes.map(i => [
        i.locataire, i.bien, i.locataire_telephone ?? "",
        String(i.mois_dus), STADE_CONFIG[i.stade].label,
        String(i.loyer), String(i.montant_du),
      ]),
      [], ["TOTAL", "", "", "", "", "", String(impayes.reduce((s, i) => s + i.montant_du, 0))],
    ];
    const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `recouvrement_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // KPI
  const totalDu = impayes.reduce((s, i) => s + i.montant_du, 0);
  const aTransferer = impayes.filter(i => i.mois_dus >= 2).length;
  const critique = impayes.filter(i => i.mois_dus >= 3).length;

  const ONGLETS = [
    { key: "pipeline",    label: "Pipeline",    icon: <Layers size={14} /> },
    { key: "liste",       label: "Liste détaillée", icon: <List size={14} /> },
    { key: "historique",  label: "Historique relances", icon: <Clock size={14} /> },
  ] as const;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1280, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Toast */}
      {toastMsg && (
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 100, background: toastMsg.ok ? "#16a34a" : "#dc2626", color: "#fff", borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,.15)" }}>
          {toastMsg.msg}
        </div>
      )}

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-.02em" }}>Recouvrement</h1>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "5px 0 0" }}>Suivi des impayés et relances locataires</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadData} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #e5e7eb", background: "white", color: "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            <RefreshCw size={14} style={{ animation: spinning ? "spin 1s linear infinite" : "none" }} /> Actualiser
          </button>
          <button onClick={() => setOpenBatch(true)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 9, border: "none", background: "#ea580c", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
            📱 Lot mobile
          </button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 28 }}>
        <KpiCard label="Dossiers actifs" value={String(impayes.length)} sub={loading ? "calcul…" : `${impayes.length} bail${impayes.length > 1 ? "s" : ""} en retard`} emoji="📋" accent={impayes.length > 0 ? "#dc2626" : "#16a34a"} />
        <KpiCard label="Montant total dû" value={fmtFCFA(totalDu)} sub="loyers + partiels" emoji="💸" accent="#dc2626" />
        <KpiCard label="À transférer ≥ 2 mois" value={String(aTransferer)} sub="passage en juridique recommandé" emoji="⚖️" accent={aTransferer > 0 ? "#dc2626" : "#16a34a"} />
        <KpiCard label="Critique ≥ 3 mois" value={String(critique)} sub="action urgente requise" emoji="🔴" accent={critique > 0 ? "#7c3aed" : "#16a34a"} />
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 4, borderBottom: "2px solid #e5e7eb", marginBottom: 24 }}>
        {ONGLETS.map(o => (
          <button key={o.key} onClick={() => setOnglet(o.key)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "10px 18px",
            border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
            color: onglet === o.key ? "#111827" : "#6b7280",
            borderBottom: onglet === o.key ? "2px solid #111827" : "2px solid transparent",
            marginBottom: -2, transition: "color .15s",
          }}>
            {o.icon} {o.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {loading ? (
        <div style={{ textAlign: "center", color: "#9ca3af", padding: "60px 0", fontSize: 14 }}>Calcul des impayés en cours…</div>
      ) : (
        <>
          {onglet === "pipeline" && <OngletPipeline impayes={impayes} onRelancer={setTargetRelance} onTransferer={setTargetTransfert} />}
          {onglet === "liste" && <OngletListe impayes={impayes} onRelancer={setTargetRelance} onTransferer={setTargetTransfert} onExport={exportCSV} />}
          {onglet === "historique" && <OngletHistorique relances={relances} impayes={impayes} />}
        </>
      )}

      {/* Lien vers juridique */}
      {aTransferer > 0 && (
        <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Link to="/juridique" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#7c3aed", textDecoration: "none", fontWeight: 600, background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 8, padding: "10px 18px" }}>
            <Gavel size={14} /> Voir les dossiers juridiques <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Modals */}
      {targetRelance && (
        <ModalRelance
          target={targetRelance}
          modeles={modeles}
          onClose={() => setTargetRelance(null)}
          onSent={() => { showToast("Relance enregistrée — message ouvert dans l'app"); loadData(); }}
        />
      )}
      {targetTransfert && (
        <ModalTransfert
          target={targetTransfert}
          onClose={() => setTargetTransfert(null)}
          onDone={(id) => { setImpayes(prev => prev.filter(i => i.bail_id !== id)); showToast(`Dossier transféré au service Juridique`); }}
        />
      )}

      <ModalBatchMobile
        open={openBatch}
        onClose={() => setOpenBatch(false)}
        baux={baux}
        onSuccess={() => { loadData(); showToast("Paiements enregistrés en lot"); }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}