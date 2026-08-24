import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtFCFA, monthLabel } from "@/lib/format";
import {
  ArrowLeft, Phone, Mail, User, Building2,
  Receipt, ScrollText, FileText, AlertTriangle,
  CheckCircle, Clock, ChevronRight, Home,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Locataire = {
  id: string; nom: string; prenom: string | null; reference: string | null;
  type_personne: string; raison_sociale: string | null;
  telephone: string | null; email: string | null;
  employeur: string | null; revenus_mensuels: number | null;
  piece_identite: string | null; numero_piece: string | null;
  piece_date_expiration: string | null;
  garant_prenom: string | null; garant_employeur: string | null;
};

type Bail = {
  id: string; reference: string; statut: string;
  date_entree: string; date_fin: string | null;
  loyer_mensuel: number; caution: number;
  jour_echeance: number; taux_penalite_journalier: number;
  transfere_juridique_le: string | null;
  biens?: { id: string; reference: string; quartier: string | null; commune: string | null; proprietaire_id: string; proprietaires?: { id: string; nom: string } };
};

type Paiement = {
  id: string; numero_quittance: string; montant: number;
  mois_concerne: string; date_paiement: string; mode: string;
  bail_id: string; baux?: { reference: string };
};

type Relance = {
  id: string; bail_id: string; canal: string;
  contenu_envoye: string; date_envoi: string;
  destinataire: string; statut: string;
};

type Document = {
  id: string; type: string; libelle: string; statut: string;
  date_emission: string | null; date_expiration: string | null;
  fichier_url: string | null; bail_id: string;
};

type SituationBail = {
  bail: Bail;
  moisDus: number;
  montantDu: number;
  totalPaye: number;
  dernierPaiement: string | null;
  estAJour: boolean;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const MODE_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  especes:           { label: "Espèces",        color: "#16a34a", emoji: "💵" },
  wave:              { label: "Wave",            color: "#0284c7", emoji: "📱" },
  orange_money:      { label: "Orange Money",    color: "#ea580c", emoji: "📱" },
  mobile_money_om:   { label: "Mobile Money OM", color: "#ea580c", emoji: "📱" },
  mtn_money:         { label: "MTN Money",       color: "#ca8a04", emoji: "📱" },
  mobile_money_moov: { label: "Moov Money",      color: "#7c3aed", emoji: "📱" },
  virement:          { label: "Virement",        color: "#0f766e", emoji: "🏦" },
  versement_bancaire:{ label: "Banque",          color: "#0f766e", emoji: "🏦" },
  cheque:            { label: "Chèque",          color: "#374151", emoji: "📄" },
};

const STATUT_BAIL: Record<string, { label: string; color: string; bg: string }> = {
  actif:   { label: "Actif",   color: "#16a34a", bg: "#f0fdf4" },
  resilie: { label: "Résilié", color: "#dc2626", bg: "#fef2f2" },
  expire:  { label: "Expiré",  color: "#6b7280", bg: "#f9fafb" },
};

const DOC_TYPE: Record<string, string> = {
  bail: "Bail", piece_identite: "Pièce d'identité",
  assurance: "Assurance", garant: "Garant", caution: "Caution", autre: "Autre",
};

const DOC_STATUT: Record<string, { label: string; color: string }> = {
  valide:   { label: "Valide",    color: "#16a34a" },
  expirant: { label: "Expirant",  color: "#ca8a04" },
  expire:   { label: "Expiré",    color: "#dc2626" },
  manquant: { label: "Manquant",  color: "#9ca3af" },
};

// ─── Calcul situation financière ─────────────────────────────────────────────

function calculerSituation(bail: Bail, paiements: Paiement[]): SituationBail {
  const today = new Date();
  const bailPaiements = paiements.filter(p => p.bail_id === bail.id);
  const totalPaye = bailPaiements.reduce((s, p) => s + Number(p.montant), 0);

  const paiesParMois = new Map<string, number>();
  bailPaiements.forEach(p => {
    const iso = p.mois_concerne.slice(0, 10);
    paiesParMois.set(iso, (paiesParMois.get(iso) ?? 0) + Number(p.montant));
  });

  const dateEntree = new Date(bail.date_entree);
  let cursor = new Date(dateEntree.getFullYear(), dateEntree.getMonth(), 1);
  const moisCourant = new Date(today.getFullYear(), today.getMonth(), 1);

  let moisDus = 0, montantDu = 0;

  while (cursor <= moisCourant) {
    const iso = cursor.toISOString().slice(0, 10);
    const isCourant = cursor.getTime() === moisCourant.getTime();
    if (isCourant && today.getDate() <= bail.jour_echeance) { cursor.setMonth(cursor.getMonth() + 1); continue; }
    const loyer = Number(bail.loyer_mensuel);
    const paye = paiesParMois.get(iso) ?? 0;
    if (paye < loyer) { moisDus++; montantDu += loyer - paye; }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const dernierPaiement = bailPaiements.length > 0
    ? bailPaiements.sort((a, b) => b.date_paiement.localeCompare(a.date_paiement))[0].date_paiement
    : null;

  return { bail, moisDus, montantDu, totalPaye, dernierPaiement, estAJour: moisDus === 0 };
}

// ─── Composants UI ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, minWidth: 140 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#111827", fontWeight: 500, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 5, padding: "9px 16px",
      border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
      color: active ? "#111827" : "#6b7280",
      borderBottom: active ? "2px solid #111827" : "2px solid transparent",
      marginBottom: -2, transition: "color .15s", whiteSpace: "nowrap",
    }}>
      {children}
    </button>
  );
}

// ─── Carte Bail ───────────────────────────────────────────────────────────────

function CarteBail({ situation }: { situation: SituationBail }) {
  const { bail, moisDus, montantDu, totalPaye, dernierPaiement, estAJour } = situation;
  const cfg = STATUT_BAIL[bail.statut] ?? STATUT_BAIL.actif;

  return (
    <div style={{ border: `1px solid ${estAJour ? "#e5e7eb" : "#fecaca"}`, borderRadius: 12, padding: "18px 20px", background: estAJour ? "white" : "#fff5f5" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#6b7280", background: "#f3f4f6", borderRadius: 5, padding: "2px 7px" }}>{bail.reference}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, borderRadius: 5, padding: "2px 8px" }}>{cfg.label}</span>
            {bail.transfere_juridique_le && <span style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", background: "#f5f3ff", border: "1px solid #c4b5fd", borderRadius: 5, padding: "2px 7px" }}>⚖️ Juridique</span>}
          </div>
          {bail.biens && (
            <div style={{ marginTop: 6 }}>
              <Link to={`/biens`} style={{ fontSize: 14, fontWeight: 700, color: "#111827", textDecoration: "none" }}>
                <Home size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />
                {bail.biens.reference}
                {bail.biens.quartier && <span style={{ color: "#9ca3af", fontWeight: 400 }}> · {bail.biens.quartier}</span>}
              </Link>
              {bail.biens.proprietaires && (
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                  Propriétaire : <Link to={`/proprietaires/${bail.biens.proprietaire_id}`} style={{ color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>{bail.biens.proprietaires.nom}</Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Situation financière badge */}
        <div style={{ textAlign: "right" }}>
          {estAJour ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#16a34a", fontSize: 12, fontWeight: 700 }}>
              <CheckCircle size={14} /> À jour
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>{moisDus} mois de retard</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#dc2626" }}>{fmtFCFA(montantDu)} dû</div>
            </div>
          )}
        </div>
      </div>

      {/* Grille infos bail */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "6px 20px", fontSize: 12 }}>
        {[
          ["Loyer mensuel", fmtFCFA(bail.loyer_mensuel)],
          ["Caution", fmtFCFA(bail.caution)],
          ["Date d'entrée", fmtDate(bail.date_entree)],
          ["Échéance", `${bail.jour_echeance} du mois`],
          ["Total encaissé", fmtFCFA(totalPaye)],
          ["Dernier paiement", dernierPaiement ? fmtDate(dernierPaiement) : "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <div style={{ color: "#9ca3af", marginBottom: 1 }}>{k}</div>
            <div style={{ fontWeight: 600, color: "#111827" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline paiements ───────────────────────────────────────────────────────

function TimelinePaiements({ paiements, baux }: { paiements: Paiement[]; baux: Bail[] }) {
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" };
  const td: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", fontSize: 13 };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f9fafb" }}>
          <tr>
            <th style={th}>Quittance</th>
            <th style={th}>Date</th>
            <th style={th}>Mois</th>
            <th style={th}>Bail</th>
            <th style={th}>Mode</th>
            <th style={{ ...th, textAlign: "right" }}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {paiements.length === 0 ? (
            <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "36px" }}>Aucun encaissement enregistré</td></tr>
          ) : (
            paiements.map(p => {
              const bail = baux.find(b => b.id === p.bail_id);
              const modeCfg = MODE_CONFIG[p.mode] ?? { label: p.mode, color: "#6b7280", emoji: "💳" };
              return (
                <tr key={p.id}>
                  <td style={td}><span style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af" }}>{p.numero_quittance || "—"}</span></td>
                  <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>{fmtDate(p.date_paiement)}</td>
                  <td style={td}>{monthLabel(p.mois_concerne)}</td>
                  <td style={{ ...td, fontSize: 12 }}>
                    <span style={{ fontFamily: "monospace", background: "#f3f4f6", borderRadius: 4, padding: "1px 6px", color: "#6b7280" }}>
                      {bail?.reference ?? p.baux?.reference ?? "—"}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: modeCfg.color + "15", color: modeCfg.color, border: `1px solid ${modeCfg.color}30`, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                      {modeCfg.emoji} {modeCfg.label}
                    </span>
                    {(p as any).type_paiement === "acompte" && (
                      <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: "#fffbeb", color: "#ca8a04", border: "1px solid #fcd34d", borderRadius: 4, padding: "1px 6px" }}>
                        ACOMPTE
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 800, color: (p as any).type_paiement === "acompte" ? "#ca8a04" : "#16a34a", fontSize: 14 }}>{fmtFCFA(p.montant)}</td>
                </tr>
              );
            })
          )}
        </tbody>
        {paiements.length > 0 && (
          <tfoot>
            <tr style={{ background: "#f0fdf4" }}>
              <td colSpan={5} style={{ ...td, fontWeight: 700, color: "#15803d", borderBottom: "none" }}>Total encaissé</td>
              <td style={{ ...td, textAlign: "right", fontWeight: 900, fontSize: 15, color: "#16a34a", borderBottom: "none" }}>
                {fmtFCFA(paiements.reduce((s, p) => s + Number(p.montant), 0))}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ─── Onglet Relances ──────────────────────────────────────────────────────────

function OngletRelances({ relances }: { relances: Relance[] }) {
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" };
  const td: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", fontSize: 13 };

  const STATUT: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    envoyee: { label: "Envoyée",  color: "#16a34a", icon: <CheckCircle size={12} /> },
    lue:     { label: "Lue",     color: "#0284c7", icon: <CheckCircle size={12} /> },
    echec:   { label: "Échec",   color: "#dc2626", icon: <AlertTriangle size={12} /> },
    preparee:{ label: "Préparée",color: "#6b7280", icon: <Clock size={12} /> },
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f9fafb" }}>
          <tr>
            <th style={th}>Date</th>
            <th style={th}>Canal</th>
            <th style={th}>Message</th>
            <th style={th}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {relances.length === 0 ? (
            <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "36px" }}>Aucune relance envoyée pour ce locataire</td></tr>
          ) : relances.map(r => {
            const CANAL = MODE_CONFIG[r.canal] ?? { label: r.canal, color: "#6b7280", emoji: "📨" };
            const stat = STATUT[r.statut] ?? { label: r.statut, color: "#6b7280", icon: null };
            return (
              <tr key={r.id}>
                <td style={{ ...td, color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>
                  {fmtDate(r.date_envoi)}
                  <div style={{ fontSize: 10 }}>{new Date(r.date_envoi).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                </td>
                <td style={td}>
                  <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#374151" }}>
                    {r.canal === "whatsapp" ? "💬" : r.canal === "sms" ? "📱" : "📧"} {r.canal === "whatsapp" ? "WhatsApp" : r.canal.toUpperCase()}
                  </span>
                </td>
                <td style={{ ...td, maxWidth: 320 }}>
                  <div style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.contenu_envoye}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{r.destinataire}</div>
                </td>
                <td style={td}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: stat.color }}>
                    {stat.icon} {stat.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Onglet Documents ─────────────────────────────────────────────────────────

function OngletDocuments({ documents, pieces }: { documents: Document[]; pieces: any[] }) {
  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" };
  const td: React.CSSProperties = { padding: "11px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", fontSize: 13 };

  const tous = [
    ...documents.map(d => ({ id: d.id, type: DOC_TYPE[d.type] ?? d.type, libelle: d.libelle, statut: d.statut, expiration: d.date_expiration, url: d.fichier_url })),
    ...pieces.map(p => ({ id: p.id, type: p.type_document, libelle: p.libelle, statut: "valide", expiration: p.date_expiration, url: p.fichier_url })),
  ];

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f9fafb" }}>
          <tr>
            <th style={th}>Type</th>
            <th style={th}>Libellé</th>
            <th style={th}>Expiration</th>
            <th style={th}>Statut</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {tous.length === 0 ? (
            <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "36px" }}>Aucun document enregistré</td></tr>
          ) : tous.map(d => {
            const stat = DOC_STATUT[d.statut] ?? { label: d.statut, color: "#6b7280" };
            return (
              <tr key={d.id}>
                <td style={{ ...td, fontSize: 12 }}>
                  <span style={{ background: "#f3f4f6", borderRadius: 5, padding: "2px 8px", fontWeight: 600, color: "#374151" }}>{d.type}</span>
                </td>
                <td style={{ ...td, fontWeight: 500 }}>{d.libelle}</td>
                <td style={{ ...td, color: "#6b7280", fontSize: 12 }}>{d.expiration ? fmtDate(d.expiration) : "—"}</td>
                <td style={td}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: stat.color }}>{stat.label}</span>
                </td>
                <td style={{ ...td, textAlign: "right" }}>
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>
                      Voir <ChevronRight size={12} style={{ verticalAlign: "middle" }} />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Onglet Historique & Score ────────────────────────────────────────────────

function OngletHistoriqueScore({ locataireId, paiements, relances, baux }: {
  locataireId: string;
  paiements: Paiement[];
  relances: Relance[];
  baux: Bail[];
}) {
  const [meds, setMeds] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [loadingJur, setLoadingJur] = useState(true);

  useEffect(() => {
    const bailIds = baux.map(b => b.id);
    if (!bailIds.length) { setLoadingJur(false); return; }
    Promise.all([
      supabase.from("mises_en_demeure").select("*").in("bail_id", bailIds).order("date_emission", { ascending: false }),
      supabase.from("procedures").select("*").in("bail_id", bailIds).order("date_debut", { ascending: false }),
    ]).then(([{ data: m }, { data: p }]) => {
      setMeds(m ?? []);
      setProcedures(p ?? []);
      setLoadingJur(false);
    });
  }, [baux]);

  // Calcul des indicateurs
  const today = new Date();
  const bailsActifs = baux.filter(b => b.statut === "actif");

  // Calcul du solde créditeur (acomptes non encore imputés)
  const acomptes = paiements.filter(p => (p as any).type_paiement === "acompte");
  const totalAcomptes = acomptes.reduce((s, p) => s + Number(p.montant), 0);

  // Mois en retard total sur toute l'histoire
  let totalMoisRetard = 0;
  let totalMoisContrat = 0;
  baux.forEach(bail => {
    const entree = new Date(bail.date_entree);
    const fin = bail.date_fin ? new Date(bail.date_fin) : today;
    const moisContrat = Math.max(1, Math.round((fin.getTime() - entree.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    totalMoisContrat += moisContrat;

    const paiesParMois = new Map<string, number>();
    paiements.filter(p => p.bail_id === bail.id).forEach(p => {
      const iso = p.mois_concerne.slice(0, 10);
      paiesParMois.set(iso, (paiesParMois.get(iso) ?? 0) + Number(p.montant));
    });

    let cursor = new Date(entree.getFullYear(), entree.getMonth(), 1);
    const moisCourant = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor <= moisCourant) {
      const iso = cursor.toISOString().slice(0, 10);
      const paye = paiesParMois.get(iso) ?? 0;
      if (paye < Number(bail.loyer_mensuel)) totalMoisRetard++;
      cursor.setMonth(cursor.getMonth() + 1);
    }
  });

  const tauxPonctualite = totalMoisContrat > 0 ? Math.round(((totalMoisContrat - totalMoisRetard) / totalMoisContrat) * 100) : 100;

  // Score
  const getScore = (): { label: string; color: string; bg: string; emoji: string; detail: string } => {
    if (tauxPonctualite >= 90 && meds.length === 0) return { label: "Excellent payeur", color: "#16a34a", bg: "#f0fdf4", emoji: "⭐", detail: "Paiements réguliers, aucun incident" };
    if (tauxPonctualite >= 75 && meds.length <= 1) return { label: "Bon payeur", color: "#0284c7", bg: "#f0f9ff", emoji: "👍", detail: "Quelques retards mineurs" };
    if (tauxPonctualite >= 50 || meds.length <= 2) return { label: "À surveiller", color: "#ca8a04", bg: "#fffbeb", emoji: "⚠️", detail: "Retards fréquents, vigilance requise" };
    return { label: "Payeur à risque", color: "#dc2626", bg: "#fef2f2", emoji: "🔴", detail: "Historique d'impayés sérieux" };
  };

  const score = getScore();

  const PROC_TYPE_LABEL: Record<string, string> = {
    commandement: "Commandement de payer",
    assignation: "Assignation",
    jugement: "Jugement",
    expulsion: "Expulsion",
    autre: "Autre",
  };

  const td: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #f3f4f6", fontSize: 13, verticalAlign: "middle" };

  // Timeline unifiée
  const evenements = [
    ...meds.map(m => ({ date: m.date_emission, type: "med", label: `MED n°${m.numero}`, detail: `${fmtFCFA(m.montant_du)} dû · ${m.nb_mois_retard} mois`, color: "#dc2626", emoji: "📄" })),
    ...procedures.map(p => ({ date: p.date_debut, type: "proc", label: PROC_TYPE_LABEL[p.type] ?? p.type, detail: p.juridiction ?? "", color: "#7c3aed", emoji: "⚖️" })),
    ...relances.map(r => ({ date: r.date_envoi, type: "relance", label: `Relance ${r.canal}`, detail: r.contenu_envoye.slice(0, 60) + "…", color: "#0284c7", emoji: r.canal === "whatsapp" ? "💬" : "📱" })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Score global */}
      <div style={{ background: score.bg, border: `1px solid ${score.color}30`, borderRadius: 14, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 36 }}>{score.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: score.color }}>{score.label}</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{score.detail}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: score.color }}>{tauxPonctualite}%</div>
          <div style={{ fontSize: 11, color: "#9ca3af" }}>ponctualité</div>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {[
          { label: "Mois en retard", value: String(totalMoisRetard), color: totalMoisRetard > 0 ? "#dc2626" : "#16a34a", emoji: "📅" },
          { label: "Relances reçues", value: String(relances.length), color: relances.length > 0 ? "#ca8a04" : "#16a34a", emoji: "📨" },
          { label: "MED reçues", value: String(meds.length), color: meds.length > 0 ? "#dc2626" : "#16a34a", emoji: "📄" },
          { label: "Procédures", value: String(procedures.length), color: procedures.length > 0 ? "#7c3aed" : "#16a34a", emoji: "⚖️" },
          { label: "Bails actifs", value: String(bailsActifs.length), color: "#0284c7", emoji: "🏠" },
          { label: "Total encaissé", value: fmtFCFA(paiements.reduce((s, p) => s + Number(p.montant), 0)), color: "#16a34a", emoji: "💰" },
        ].map(k => (
          <div key={k.label} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{k.emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barre de ponctualité */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
          <span style={{ color: "#374151" }}>Taux de ponctualité</span>
          <span style={{ color: score.color }}>{tauxPonctualite}% · {totalMoisContrat - totalMoisRetard}/{totalMoisContrat} mois payés à temps</span>
        </div>
        <div style={{ height: 10, background: "#f3f4f6", borderRadius: 5, overflow: "hidden" }}>
          <div style={{ width: `${tauxPonctualite}%`, height: "100%", background: score.color, borderRadius: 5, transition: "width .5s" }} />
        </div>
      </div>

      {/* Timeline événements */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 14 }}>
          Historique complet ({evenements.length} événements)
        </div>
        {evenements.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: "30px", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 13 }}>
            Aucun incident enregistré — locataire sans historique judiciaire
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {evenements.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: e.color + "15", border: `2px solid ${e.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>
                  {e.emoji}
                </div>
                <div style={{ flex: 1, background: "#f9fafb", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: e.color }}>{e.label}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDate(e.date)}</span>
                  </div>
                  {e.detail && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{e.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Page principale ──────────────────────────────────────────────────────────

export default function FicheLocataire() {
  const { id } = useParams();
  const { hasRole } = useAuth();
  const canSeeScore = hasRole("recouvrement") || hasRole("direction") || hasRole("admin");
  const [loc, setLoc] = useState<Locataire | null>(null);
  const [baux, setBaux] = useState<Bail[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [relances, setRelances] = useState<Relance[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pieces, setPieces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState<"bails" | "paiements" | "relances" | "documents">("bails");

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: l }, { data: bx }, { data: pc }] = await Promise.all([
      supabase.from("locataires").select("*").eq("id", id).maybeSingle(),
      supabase.from("baux")
        .select("*, biens!baux_bien_fk(id, reference, quartier, commune, proprietaire_id, proprietaires!biens_proprietaire_fk(id, nom))")
        .eq("locataire_id", id)
        .order("date_entree", { ascending: false }),
      supabase.from("pieces_locataire").select("*").eq("locataire_id", id).order("created_at", { ascending: false }),
    ]);

    setLoc(l as any);
    const bxArr = (bx ?? []) as Bail[];
    setBaux(bxArr);
    setPieces(pc ?? []);

    const bailIds = bxArr.map(b => b.id);
    if (bailIds.length) {
      const [{ data: pa }, { data: rl }, { data: docs }] = await Promise.all([
        supabase.from("paiements")
          .select("id, numero_quittance, montant, mois_concerne, date_paiement, mode, bail_id, type_paiement, baux!paiements_bail_fk(reference)")
          .in("bail_id", bailIds)
          .order("date_paiement", { ascending: false }),
        supabase.from("relances_envoyees").select("*").in("bail_id", bailIds).order("date_envoi", { ascending: false }),
        supabase.from("documents_locataire").select("*").eq("locataire_id", id).order("created_at", { ascending: false }),
      ]);
      setPaiements((pa ?? []) as any);
      setRelances((rl ?? []) as any);
      setDocuments((docs ?? []) as any);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) return (
    <div style={{ padding: "60px 32px", textAlign: "center", color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>
      Chargement de la fiche…
    </div>
  );
  if (!loc) return (
    <div style={{ padding: "60px 32px", textAlign: "center", color: "#dc2626", fontFamily: "system-ui, sans-serif" }}>
      Locataire introuvable.
    </div>
  );

  const nomComplet = loc.type_personne === "morale"
    ? loc.raison_sociale ?? loc.nom
    : `${loc.prenom ?? ""} ${loc.nom ?? ""}`.trim();

  const bailsActifs = baux.filter(b => b.statut === "actif");

  // Calcul du solde créditeur (acomptes non encore imputés)
  const acomptes = paiements.filter(p => (p as any).type_paiement === "acompte");
  const totalAcomptes = acomptes.reduce((s, p) => s + Number(p.montant), 0);
  const situations = baux.map(b => calculerSituation(b, paiements));
  const totalPaye = paiements.reduce((s, p) => s + Number(p.montant), 0);
  const totalDu = situations.filter(s => s.bail.statut === "actif").reduce((s, x) => s + x.montantDu, 0);
  const enRetard = situations.filter(s => !s.estAJour && s.bail.statut === "actif").length;

  const initiales = nomComplet.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Retour */}
      <Link to="/locataires" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280", textDecoration: "none", marginBottom: 20, fontWeight: 500 }}>
        <ArrowLeft size={14} /> Retour aux locataires
      </Link>

      {/* ── En-tête identité ── */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 18, marginBottom: 28 }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, flexShrink: 0 }}>
          {initiales}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-.02em" }}>{nomComplet}</h1>
            <span style={{ fontSize: 11, fontWeight: 700, background: loc.type_personne === "morale" ? "#ede9fe" : "#e0f2fe", color: loc.type_personne === "morale" ? "#7c3aed" : "#0369a1", borderRadius: 5, padding: "2px 8px" }}>
              {loc.type_personne === "morale" ? "Personne morale" : "Personne physique"}
            </span>
            {loc.reference && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#9ca3af", background: "#f3f4f6", borderRadius: 5, padding: "2px 7px" }}>{loc.reference}</span>}
          </div>
          <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap" }}>
            {loc.telephone && (
              <a href={`tel:${loc.telephone}`} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#374151", textDecoration: "none" }}>
                <Phone size={13} color="#9ca3af" /> {loc.telephone}
              </a>
            )}
            {loc.email && (
              <a href={`mailto:${loc.email}`} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#374151", textDecoration: "none" }}>
                <Mail size={13} color="#9ca3af" /> {loc.email}
              </a>
            )}
            {loc.employeur && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#6b7280" }}>
                <Building2 size={13} color="#9ca3af" /> {loc.employeur}
              </span>
            )}
          </div>
        </div>

        {/* Alerte retard */}
        {enRetard > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", flexShrink: 0 }}>
            <AlertTriangle size={16} color="#dc2626" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626" }}>{enRetard} bail{enRetard > 1 ? "s" : ""} en retard</div>
              <div style={{ fontSize: 11, color: "#ef4444" }}>{fmtFCFA(totalDu)} dû</div>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 28 }}>
        <KpiCard label="Bails actifs" value={String(bailsActifs.length)} sub={`sur ${baux.length} bail${baux.length > 1 ? "s" : ""} total`} accent="#0284c7" />
        <KpiCard label="Loyer mensuel" value={fmtFCFA(bailsActifs.reduce((s, b) => s + Number(b.loyer_mensuel), 0))} sub="total bails actifs" accent="#111827" />
        <KpiCard label="Total encaissé" value={fmtFCFA(totalPaye)} sub="depuis le début" accent="#16a34a" />
        <KpiCard label="Montant dû" value={totalDu > 0 ? fmtFCFA(totalDu) : "À jour"} sub={totalDu > 0 ? `${enRetard} bail${enRetard > 1 ? "s" : ""} en retard` : "Aucun retard"} accent={totalDu > 0 ? "#dc2626" : "#16a34a"} />
        <KpiCard label="Relances" value={String(relances.length)} sub="depuis le début" accent="#6b7280" />
        {totalAcomptes > 0 && (
          <KpiCard label="Solde créditeur" value={fmtFCFA(totalAcomptes)} sub="acomptes en attente" accent="#ca8a04" />
        )}
      </div>

      {/* ── Infos locataire (collapsible) ── */}
      <details style={{ border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 24, overflow: "hidden" }}>
        <summary style={{ padding: "14px 18px", cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#374151", background: "#f9fafb", listStyle: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <User size={14} /> Informations personnelles
        </summary>
        <div style={{ padding: "16px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
          <div>
            <InfoRow label="Pièce d'identité" value={loc.piece_identite} />
            <InfoRow label="N° pièce" value={loc.numero_piece} />
            <InfoRow label="Expiration pièce" value={loc.piece_date_expiration ? fmtDate(loc.piece_date_expiration) : null} />
            <InfoRow label="Revenus mensuels" value={loc.revenus_mensuels ? fmtFCFA(loc.revenus_mensuels) : null} />
          </div>
          <div>
            {loc.type_personne === "morale" ? (
              <InfoRow label="Raison sociale" value={loc.raison_sociale} />
            ) : (
              <>
                <InfoRow label="Garant" value={loc.garant_prenom} />
                <InfoRow label="Employeur garant" value={loc.garant_employeur} />
              </>
            )}
          </div>
        </div>
      </details>

      {/* ── Onglets ── */}
      <div style={{ display: "flex", gap: 2, borderBottom: "2px solid #e5e7eb", marginBottom: 20, overflowX: "auto" }}>
        <TabBtn active={onglet === "bails"} onClick={() => setOnglet("bails")}>
          <Building2 size={13} /> Bails ({baux.length})
        </TabBtn>
        <TabBtn active={onglet === "paiements"} onClick={() => setOnglet("paiements")}>
          <Receipt size={13} /> Paiements ({paiements.length})
        </TabBtn>
        <TabBtn active={onglet === "relances"} onClick={() => setOnglet("relances")}>
          <ScrollText size={13} /> Relances ({relances.length})
          {relances.length > 0 && <span style={{ background: "#dc2626", color: "white", borderRadius: 10, padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{relances.length}</span>}
        </TabBtn>
        <TabBtn active={onglet === "documents"} onClick={() => setOnglet("documents")}>
          <FileText size={13} /> Documents ({documents.length + pieces.length})
        </TabBtn>
        {canSeeScore && (
          <TabBtn active={onglet === "historique"} onClick={() => setOnglet("historique" as any)}>
            ⭐ Score & Historique
          </TabBtn>
        )}
      </div>

      {/* ── Contenu onglets ── */}
      {onglet === "bails" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {situations.length === 0 ? (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: "40px", border: "1px solid #e5e7eb", borderRadius: 12 }}>
              Aucun bail enregistré pour ce locataire
            </div>
          ) : (
            situations.map(s => <CarteBail key={s.bail.id} situation={s} />)
          )}
          {totalAcomptes > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18 }}>💰</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e" }}>Solde créditeur : {fmtFCFA(totalAcomptes)}</div>
                <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>
                  {acomptes.length} acompte(s) enregistré(s) — à déduire lors du prochain encaissement
                </div>
              </div>
            </div>
          )}
          {enRetard > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Link to="/recouvrement" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#dc2626", textDecoration: "none", fontWeight: 600, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 16px" }}>
                <AlertTriangle size={13} /> Voir dans le recouvrement <ChevronRight size={13} />
              </Link>
            </div>
          )}
        </div>
      )}

      {onglet === "paiements" && <TimelinePaiements paiements={paiements} baux={baux} />}
      {onglet === "relances" && <OngletRelances relances={relances} />}
      {onglet === "documents" && <OngletDocuments documents={documents} pieces={pieces} />}
      {(onglet as string) === "historique" && canSeeScore && (
        <OngletHistoriqueScore
          locataireId={id!}
          paiements={paiements}
          relances={relances}
          baux={baux}
        />
      )}

    </div>
  );
}