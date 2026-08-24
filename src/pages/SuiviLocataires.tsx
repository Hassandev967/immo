import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fmtFCFA, fmtDate } from "@/lib/format";
import { RefreshCw, AlertTriangle, CheckCircle, FileText, Download, Bell } from "lucide-react";

type BailSuivi = {
  id: string;
  reference: string;
  statut: string;
  date_entree: string;
  date_fin: string | null;
  date_renouvellement_prevue: string | null;
  loyer_mensuel: number;
  notes_renouvellement: string | null;
  locataire_id: string;
  locataires?: { id: string; nom: string; prenom: string | null; telephone: string | null };
  biens?: { reference: string; quartier: string | null; commune: string | null };
};

type Onglet = "renouvellement" | "retard" | "documents";

const MOIS_FR = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

function joursRestants(date: string): number {
  const d = new Date(date);
  const today = new Date();
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function alerteColor(jours: number): { color: string; bg: string; label: string } {
  if (jours < 0)  return { color: "#dc2626", bg: "#fef2f2", label: "Expiré" };
  if (jours < 30) return { color: "#dc2626", bg: "#fef2f2", label: `${jours}j` };
  if (jours < 60) return { color: "#ea580c", bg: "#fff7ed", label: `${jours}j` };
  return { color: "#ca8a04", bg: "#fffbeb", label: `${jours}j` };
}

export default function SuiviLocataires() {
  const [onglet, setOnglet] = useState<Onglet>("renouvellement");
  const [baux, setBaux] = useState<BailSuivi[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [search, setSearch] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setSpinning(true);
    const { data } = await supabase
      .from("baux")
      .select("id, reference, statut, date_entree, date_fin, date_renouvellement_prevue, loyer_mensuel, notes_renouvellement, locataire_id, locataires!baux_locataire_id_fkey(id, nom, prenom, telephone), biens!baux_bien_fk(reference, quartier, commune)")
      .eq("statut", "actif")
      .order("date_fin", { ascending: true, nullsFirst: false });
    setBaux((data ?? []) as any);
    setLoading(false);
    setTimeout(() => setSpinning(false), 600);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date();
  const in90 = new Date(today); in90.setDate(today.getDate() + 90);
  const in30 = new Date(today); in30.setDate(today.getDate() + 30);

  // Baux qui expirent dans 90 jours
  const aRenouveler = baux.filter(b => {
    const d = b.date_fin ? new Date(b.date_fin) : null;
    return d && d <= in90;
  });

  // Baux sans date de fin (CDI / indéterminé)
  const sansFin = baux.filter(b => !b.date_fin);

  // Filtre recherche
  const filtrer = (liste: BailSuivi[]) => {
    if (!search) return liste;
    const q = search.toLowerCase();
    return liste.filter(b => {
      const nom = `${b.locataires?.prenom ?? ""} ${b.locataires?.nom ?? ""}`.toLowerCase();
      return nom.includes(q) || (b.reference ?? "").toLowerCase().includes(q) || (b.biens?.reference ?? "").toLowerCase().includes(q);
    });
  };

  // Export CSV renouvellement
  const exportCSV = () => {
    const liste = filtrer(aRenouveler);
    const rows = [
      ["Référence bail", "Locataire", "Téléphone", "Bien", "Date fin", "Jours restants", "Loyer", "Notes"],
      ...liste.map(b => {
        const jours = b.date_fin ? joursRestants(b.date_fin) : 0;
        return [
          b.reference ?? "",
          `${b.locataires?.prenom ?? ""} ${b.locataires?.nom ?? ""}`.trim(),
          b.locataires?.telephone ?? "",
          `${b.biens?.reference ?? ""} ${b.biens?.quartier ? "· " + b.biens.quartier : ""}`.trim(),
          b.date_fin ? fmtDate(b.date_fin) : "—",
          String(jours),
          String(b.loyer_mensuel),
          b.notes_renouvellement ?? "",
        ];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `renouvellement_baux_${today.toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e5e7eb" };
  const td: React.CSSProperties = { padding: "12px 14px", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle", fontSize: 13 };

  const TabBtn = ({ k, label, count, color }: { k: Onglet; label: string; count?: number; color?: string }) => (
    <button onClick={() => setOnglet(k)} style={{
      display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
      border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
      color: onglet === k ? "#111827" : "#6b7280",
      borderBottom: onglet === k ? "2px solid #111827" : "2px solid transparent",
      marginBottom: -2,
    }}>
      {label}
      {count !== undefined && count > 0 && (
        <span style={{ background: color ?? "#dc2626", color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{count}</span>
      )}
    </button>
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto", fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: 0 }}>Suivi locataires</h1>
          <p style={{ fontSize: 13, color: "#9ca3af", margin: "5px 0 0" }}>Renouvellements · Alertes · Documents</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadData} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #e5e7eb", background: "white", color: "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
            <RefreshCw size={14} style={{ animation: spinning ? "spin 1s linear infinite" : "none" }} /> Actualiser
          </button>
          {onglet === "renouvellement" && (
            <button onClick={exportCSV} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #e5e7eb", background: "white", color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 500 }}>
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Expirent < 30 jours", value: String(baux.filter(b => b.date_fin && joursRestants(b.date_fin) < 30 && joursRestants(b.date_fin) >= 0).length), emoji: "🔴", accent: "#dc2626" },
          { label: "Expirent < 90 jours", value: String(aRenouveler.length), emoji: "⚠️", accent: "#ca8a04" },
          { label: "Sans date de fin", value: String(sansFin.length), emoji: "📋", accent: "#0284c7" },
          { label: "Baux actifs total", value: String(baux.length), emoji: "🏠", accent: "#16a34a" },
        ].map(k => (
          <div key={k.label} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{k.emoji}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.accent }}>{k.value}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Barre de recherche */}
      <input
        style={{ width: "100%", padding: "10px 14px", borderRadius: 9, border: "1px solid #e5e7eb", background: "white", fontSize: 13, outline: "none", marginBottom: 20, boxSizing: "border-box" }}
        placeholder="🔍 Rechercher par nom, référence bail ou bien…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Onglets */}
      <div style={{ display: "flex", gap: 2, borderBottom: "2px solid #e5e7eb", marginBottom: 24 }}>
        <TabBtn k="renouvellement" label="Renouvellements" count={aRenouveler.length} color="#ca8a04" />
        <TabBtn k="retard" label="Sans date de fin" count={sansFin.length} color="#0284c7" />
        <TabBtn k="documents" label="Tous les baux actifs" />
      </div>

      {/* ── Onglet Renouvellement ── */}
      {onglet === "renouvellement" && (
        <div>
          {filtrer(aRenouveler).length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", border: "1px solid #e5e7eb", borderRadius: 12, color: "#9ca3af" }}>
              <CheckCircle size={32} color="#16a34a" style={{ marginBottom: 12 }} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>Aucun bail à renouveler dans les 90 prochains jours</div>
            </div>
          ) : (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
              <div style={{ padding: "12px 16px", background: "#fffbeb", borderBottom: "1px solid #fcd34d", display: "flex", alignItems: "center", gap: 8 }}>
                <Bell size={14} color="#ca8a04" />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e" }}>
                  {filtrer(aRenouveler).filter(b => b.date_fin && joursRestants(b.date_fin) < 30).length} bail(s) expirent dans moins de 30 jours — action urgente requise
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "#f9fafb" }}>
                  <tr>
                    <th style={th}>Locataire</th>
                    <th style={th}>Bail / Bien</th>
                    <th style={th}>Date fin</th>
                    <th style={{ ...th, textAlign: "center" }}>Délai</th>
                    <th style={{ ...th, textAlign: "right" }}>Loyer</th>
                    <th style={th}>Notes</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrer(aRenouveler).map(b => {
                    const jours = b.date_fin ? joursRestants(b.date_fin) : 0;
                    const alerte = alerteColor(jours);
                    return (
                      <tr key={b.id}>
                        <td style={td}>
                          <Link to={`/locataires/${b.locataires?.id}`} style={{ fontWeight: 600, color: "#0284c7", textDecoration: "none" }}>
                            {b.locataires?.prenom} {b.locataires?.nom}
                          </Link>
                          {b.locataires?.telephone && <div style={{ fontSize: 11, color: "#9ca3af" }}>{b.locataires.telephone}</div>}
                        </td>
                        <td style={td}>
                          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{b.reference}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{b.biens?.reference} {b.biens?.quartier ? "· " + b.biens.quartier : ""}</div>
                        </td>
                        <td style={td}>
                          <span style={{ fontWeight: 600, color: jours < 30 ? "#dc2626" : "#374151" }}>
                            {b.date_fin ? fmtDate(b.date_fin) : "—"}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <span style={{ background: alerte.bg, color: alerte.color, border: `1px solid ${alerte.color}30`, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                            {jours < 0 ? "Expiré" : alerte.label}
                          </span>
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtFCFA(b.loyer_mensuel)}</td>
                        <td style={{ ...td, fontSize: 12, color: "#6b7280", maxWidth: 180 }}>
                          {b.notes_renouvellement ? (
                            <span style={{ fontStyle: "italic" }}>{b.notes_renouvellement}</span>
                          ) : "—"}
                        </td>
                        <td style={td}>
                          <Link to={`/locataires/${b.locataires?.id}`} style={{ fontSize: 12, color: "#0284c7", textDecoration: "none", fontWeight: 600, whiteSpace: "nowrap" }}>
                            Voir fiche →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Onglet Sans date de fin ── */}
      {onglet === "retard" && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th style={th}>Locataire</th>
                <th style={th}>Bail</th>
                <th style={th}>Date d'entrée</th>
                <th style={{ ...th, textAlign: "right" }}>Loyer</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtrer(sansFin).length === 0 ? (
                <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "40px" }}>Aucun bail sans date de fin</td></tr>
              ) : filtrer(sansFin).map(b => (
                <tr key={b.id}>
                  <td style={td}>
                    <Link to={`/locataires/${b.locataires?.id}`} style={{ fontWeight: 600, color: "#0284c7", textDecoration: "none" }}>
                      {b.locataires?.prenom} {b.locataires?.nom}
                    </Link>
                  </td>
                  <td style={td}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{b.reference}</span>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{b.biens?.reference}</div>
                  </td>
                  <td style={td}>{fmtDate(b.date_entree)}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtFCFA(b.loyer_mensuel)}</td>
                  <td style={td}>
                    <Link to={`/locataires/${b.locataires?.id}`} style={{ fontSize: 12, color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>
                      Voir fiche →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Onglet Tous les baux ── */}
      {onglet === "documents" && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", background: "white" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f9fafb" }}>
              <tr>
                <th style={th}>Locataire</th>
                <th style={th}>Bail</th>
                <th style={th}>Entrée</th>
                <th style={th}>Fin</th>
                <th style={{ ...th, textAlign: "right" }}>Loyer</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {filtrer(baux).length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#9ca3af", padding: "40px" }}>
                  {loading ? "Chargement…" : "Aucun bail actif"}
                </td></tr>
              ) : filtrer(baux).map(b => {
                const jours = b.date_fin ? joursRestants(b.date_fin) : null;
                const alerte = jours !== null && jours < 90 ? alerteColor(jours) : null;
                return (
                  <tr key={b.id}>
                    <td style={td}>
                      <Link to={`/locataires/${b.locataires?.id}`} style={{ fontWeight: 600, color: "#0284c7", textDecoration: "none" }}>
                        {b.locataires?.prenom} {b.locataires?.nom}
                      </Link>
                      {b.locataires?.telephone && <div style={{ fontSize: 11, color: "#9ca3af" }}>{b.locataires.telephone}</div>}
                    </td>
                    <td style={td}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>{b.reference}</span>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{b.biens?.reference} {b.biens?.quartier ? "· " + b.biens.quartier : ""}</div>
                    </td>
                    <td style={td}>{fmtDate(b.date_entree)}</td>
                    <td style={td}>
                      {b.date_fin ? (
                        <span style={{ color: alerte ? alerte.color : "#374151", fontWeight: alerte ? 600 : 400 }}>
                          {fmtDate(b.date_fin)}
                          {alerte && <span style={{ marginLeft: 6, fontSize: 10, background: alerte.bg, color: alerte.color, borderRadius: 4, padding: "1px 5px" }}>{alerte.label}</span>}
                        </span>
                      ) : <span style={{ color: "#0284c7", fontSize: 11 }}>Indéterminée</span>}
                    </td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmtFCFA(b.loyer_mensuel)}</td>
                    <td style={td}>
                      <Link to={`/locataires/${b.locataires?.id}`} style={{ fontSize: 12, color: "#0284c7", textDecoration: "none", fontWeight: 600 }}>
                        Voir →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}