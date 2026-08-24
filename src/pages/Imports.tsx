import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseFile } from "@/lib/io";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Building2, Users, UserCheck, Wallet, Banknote, CheckCircle, XCircle } from "lucide-react";

type Entity = "locataires" | "biens" | "proprietaires" | "paiements" | "bancaire";

// ─── Normalisation des noms de colonnes ──────────────────────────────────────
const norm = (s: string) =>
  s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

// ─── Mapping colonnes Excel → champs Supabase ─────────────────────────────────
const FIELD_MAP: Record<string, Record<string, string>> = {
  locataires: {
    nom: "nom", name: "nom", last_name: "nom", lastname: "nom",
    prenom: "prenom", firstname: "prenom", first_name: "prenom",
    telephone: "telephone", tel: "telephone", phone: "telephone", mobile: "telephone",
    email: "email", mail: "email",
    piece_identite: "piece_identite", piece_d_identite: "piece_identite",
    type_piece: "piece_identite", piece: "piece_identite",
    numero_piece: "numero_piece", numero_de_piece: "numero_piece", num_piece: "numero_piece",
    employeur: "employeur", activite: "employeur", profession: "employeur", societe: "employeur",
    revenus_mensuels: "revenus_mensuels", revenus: "revenus_mensuels", salaire: "revenus_mensuels",
    rccm: "rccm", nif: "nif",
    raison_sociale: "raison_sociale",
  },
  biens: {
    type: "type", type_bien: "type", type_de_bien: "type",
    commune: "commune", ville: "commune",
    quartier: "quartier",
    adresse: "adresse",
    pieces: "pieces", nb_pieces: "pieces", chambres: "pieces",
    loyer_mensuel: "loyer_mensuel", loyer: "loyer_mensuel", montant_loyer: "loyer_mensuel",
    loyer_mensuel_fcfa_: "loyer_mensuel", loyer_mensuel_fcfa: "loyer_mensuel",
    loyer_fcfa: "loyer_mensuel", montant_fcfa: "loyer_mensuel",
    charges: "charges", charges_fcfa_: "charges", charges_fcfa: "charges",
    statut: "_statut_raw",
    proprietaire: "_proprio_nom", nom_proprietaire: "_proprio_nom",
    proprietaire_nom: "_proprio_nom", id_proprietaire: "_proprio_ref",
  },
  proprietaires: {
    nom: "nom", name: "nom", raison_sociale: "nom",
    type_personne: "type_personne", type: "type_personne",
    telephone: "telephone", tel: "telephone",
    email: "email",
    adresse: "adresse",
    rib: "rib",
    taux_honoraires: "taux_honoraires", taux: "taux_honoraires", honoraires: "taux_honoraires",
  },
};

const TEMPLATES: Record<Entity, { fields: string[]; sample: any }> = {
  locataires: {
    fields: ["nom", "prenom", "telephone", "email", "piece_identite", "numero_piece", "employeur"],
    sample: { nom: "KONE", prenom: "Fatim", telephone: "0700000000", email: "fatim@gmail.com" }
  },
  biens: {
    fields: ["type", "commune", "quartier", "adresse", "loyer_mensuel", "charges", "statut", "pieces"],
    sample: { type: "appartement", commune: "Cocody", loyer_mensuel: 150000, charges: 10000, statut: "vacant" }
  },
  proprietaires: {
    fields: ["nom", "type_personne", "telephone", "email", "taux_honoraires"],
    sample: { nom: "SCI Exemple", type_personne: "morale", taux_honoraires: 10 }
  },
  paiements: {
    fields: ["bail_reference", "montant", "mode", "date_paiement", "mois_concerne"],
    sample: { bail_reference: "BAIL-2026-0001", montant: 150000, mode: "especes", mois_concerne: "2025-01-01" }
  },
  bancaire: {
    fields: ["date", "libelle", "montant", "reference"],
    sample: { date: "2025-01-15", libelle: "Vir KONE F", montant: 150000 }
  },
};

// ─── Normalisation statut bien ────────────────────────────────────────────────
function normalizeStatut(raw: string): string {
  const s = String(raw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes("occup")) return "occupe";
  if (s.includes("travaux") || s.includes("renov")) return "travaux";
  return "vacant";
}

// ─── Normalisation type bien ──────────────────────────────────────────────────
function normalizeType(raw: string): string {
  const t = String(raw).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (t.includes("magasin") || t.includes("commercial") || t.includes("local")) return "local_commercial";
  if (t.includes("bureau")) return "bureau";
  if (t.includes("villa")) return "villa";
  if (t.includes("studio")) return "studio";
  if (t.includes("terrain")) return "terrain";
  return "appartement";
}

// ─── Mapper une ligne Excel → champs Supabase ─────────────────────────────────
function mapRow(row: any, entity: Entity): any {
  if (entity === "paiements" || entity === "bancaire") return row;
  const map = FIELD_MAP[entity] ?? {};
  const result: any = {};

  for (const [rawKey, val] of Object.entries(row)) {
    const normalized = norm(rawKey);
    const supabaseField = map[normalized];
    if (supabaseField && val !== undefined && val !== null && String(val).trim() !== "") {
      let cleaned = String(val).trim();
      // Nettoyer les nombres
      const numFields = ["loyer_mensuel", "revenus_mensuels", "taux_honoraires", "pieces", "charges"];
      if (numFields.includes(supabaseField)) {
        cleaned = cleaned.replace(/\s/g, "").replace(",", ".");
      }
      result[supabaseField] = cleaned;
    }
  }

  // ── Locataires ──
  if (entity === "locataires") {
    result.type_personne = (result.rccm || result.raison_sociale) ? "morale" : "physique";
  }

  // ── Propriétaires ──
  if (entity === "proprietaires" && !result.taux_honoraires) {
    result.taux_honoraires = 10;
  }

  // ── Biens ──
  if (entity === "biens") {
    // Normaliser statut
    result.statut = result._statut_raw ? normalizeStatut(result._statut_raw) : "vacant";
    delete result._statut_raw;
    // Normaliser type
    if (result.type) result.type = normalizeType(result.type);
    else result.type = "appartement";
    // Charges par défaut
    if (!result.charges) result.charges = "0";
    // Loyer : nettoyer
    if (result.loyer_mensuel) {
      result.loyer_mensuel = String(result.loyer_mensuel).replace(/\s/g, "").replace(",", ".");
    }
  }

  return result;
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateRow(row: any, entity: Entity): string | null {
  if (entity === "locataires" && (!row.nom || row.nom.trim() === "")) return "nom manquant";
  if (entity === "proprietaires" && (!row.nom || row.nom.trim() === "")) return "nom manquant";
  if (entity === "biens") {
    const loyer = String(row.loyer_mensuel || "").replace(/\s/g, "").replace(",", ".");
    if (!loyer || isNaN(Number(loyer)) || Number(loyer) <= 0) return "loyer_mensuel invalide";
  }
  return null;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Imports() {
  const [entity, setEntity] = useState<Entity>("locataires");
  const [rows, setRows] = useState<any[]>([]);
  const [mapped, setMapped] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ line: number; msg: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; err: number } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setResult(null);
    try {
      const data = await parseFile(f);
      setRows(data.slice(0, 1000));
      const mappedRows = data.slice(0, 1000).map(r => mapRow(r, entity));
      const errs: { line: number; msg: string }[] = [];
      mappedRows.forEach((r, i) => {
        const err = validateRow(r, entity);
        if (err) errs.push({ line: i + 2, msg: err });
      });
      setMapped(mappedRows);
      setErrors(errs);
      toast.success(`${data.length} lignes lues — ${errs.length} erreur(s)`);
    } catch (err: any) { toast.error(err.message); }
  };

  const downloadTemplate = () => {
    const headers = TEMPLATES[entity].fields.join(",");
    const sample = TEMPLATES[entity].fields.map(f => (TEMPLATES[entity].sample as any)[f] ?? "").join(",");
    const blob = new Blob([headers + "\n" + sample + "\n"], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `template_${entity}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const importNow = async () => {
    if (!mapped.length) return;
    setBusy(true); setResult(null);
    try {
      if (entity === "bancaire") {
        let ok = 0;
        for (const r of mapped) {
          const ref = (r.reference || r.libelle || "").toString();
          const montant = Number(r.montant);
          if (!montant) continue;
          const { data: bail } = await supabase.from("baux").select("id").ilike("reference", `%${ref.split(" ").pop()}%`).maybeSingle();
          if (bail) {
            await supabase.from("paiements").insert({ bail_id: bail.id, montant, mode: "virement", date_paiement: r.date || new Date().toISOString().slice(0, 10), mois_concerne: r.date || new Date().toISOString().slice(0, 10), reference_externe: ref, numero_quittance: "" });
            ok++;
          }
        }
        setResult({ ok, err: mapped.length - ok });

      } else if (entity === "paiements") {
        let ok = 0, err = 0;
        for (const r of rows) {
          const { data: bail } = await supabase.from("baux").select("id").eq("reference", r.bail_reference).maybeSingle();
          if (!bail) { err++; continue; }
          const { error } = await supabase.from("paiements").insert({ bail_id: bail.id, montant: Number(r.montant), mode: r.mode || "especes", date_paiement: r.date_paiement || new Date().toISOString().slice(0, 10), mois_concerne: r.mois_concerne, numero_quittance: "" });
          error ? err++ : ok++;
        }
        setResult({ ok, err });

      } else if (entity === "biens") {
        // Résolution proprietaire_id par nom
        const validRows = mapped.filter(r => !validateRow(r, entity));
        let ok = 0, err = 0;

        for (const row of validRows) {
          const finalRow: any = { ...row };
          const nomProp = finalRow._proprio_nom;
          delete finalRow._proprio_nom;
          delete finalRow._proprio_ref;

          if (nomProp) {
            const { data: prop } = await supabase.from("proprietaires").select("id").ilike("nom", `%${nomProp}%`).limit(1).maybeSingle();
            if (prop) finalRow.proprietaire_id = prop.id;
          }

          if (!finalRow.proprietaire_id) {
            const { data: first } = await supabase.from("proprietaires").select("id").limit(1).maybeSingle();
            if (first) finalRow.proprietaire_id = first.id;
          }

          const { error } = await supabase.from("biens").insert(finalRow);
          if (error) {
            console.error("Erreur bien:", error.message, finalRow);
            err++;
          } else ok++;
        }
        setResult({ ok, err });
        if (ok > 0) toast.success(`${ok} biens importés`);
        if (err > 0) toast.error(`${err} lignes échouées`);

      } else {
        const validRows = mapped.filter(r => !validateRow(r, entity));
        let ok = 0, err = 0;
        const batchSize = 50;
        for (let i = 0; i < validRows.length; i += batchSize) {
          const batch = validRows.slice(i, i + batchSize);
          const { error } = await supabase.from(entity as any).insert(batch);
          if (error) {
            for (const row of batch) {
              const { error: e2 } = await supabase.from(entity as any).insert(row);
              e2 ? err++ : ok++;
            }
          } else ok += batch.length;
        }
        setResult({ ok, err });
        if (ok > 0) toast.success(`${ok} ${entity} importés`);
        if (err > 0) toast.error(`${err} lignes ignorées`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally { setBusy(false); }
  };

  const cards: { key: Entity; icon: any; label: string; desc: string }[] = [
    { key: "locataires", icon: Users, label: "Locataires", desc: "Importer une base de locataires" },
    { key: "biens", icon: Building2, label: "Biens", desc: "Catalogue de biens" },
    { key: "proprietaires", icon: UserCheck, label: "Propriétaires", desc: "Liste des propriétaires" },
    { key: "paiements", icon: Wallet, label: "Paiements", desc: "Historique de loyers" },
    { key: "bancaire", icon: Banknote, label: "Relevé bancaire", desc: "Rapprochement automatique" },
  ];

  const validCount = mapped.filter(r => !validateRow(r, entity)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Imports</h1>
        <p className="text-muted-foreground">Excel, CSV — colonnes détectées automatiquement</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {cards.map((c) => (
          <button key={c.key} onClick={() => { setEntity(c.key); setRows([]); setMapped([]); setErrors([]); setResult(null); }}
            className={`text-left p-4 rounded-lg border transition-colors ${entity === c.key ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
            <c.icon className="h-5 w-5 mb-2" />
            <div className="font-medium">{c.label}</div>
            <div className="text-xs text-muted-foreground">{c.desc}</div>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" />Import {entity}</CardTitle>
          <CardDescription>Colonnes reconnues automatiquement. Télécharge le modèle CSV si besoin.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap items-end">
            <Button variant="outline" onClick={downloadTemplate}>📄 Modèle CSV</Button>
            <div>
              <Label htmlFor="f" className="text-xs text-muted-foreground block mb-1">Fichier Excel ou CSV</Label>
              <Input id="f" type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} />
            </div>
            {mapped.length > 0 && (
              <Button onClick={importNow} disabled={busy || validCount === 0}>
                <Upload className="h-4 w-4 mr-2" />
                {busy ? "Import en cours…" : `Importer ${validCount} lignes valides`}
              </Button>
            )}
          </div>

          {result && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#15803d" }}>
                <CheckCircle size={14} /> {result.ok} importés
              </div>
              {result.err > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#dc2626" }}>
                  <XCircle size={14} /> {result.err} ignorés
                </div>
              )}
            </div>
          )}

          {errors.length > 0 && (
            <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6 }}>
                ⚠️ {errors.length} ligne(s) avec erreurs — ignorées à l'import
              </div>
              {errors.slice(0, 5).map(e => (
                <div key={e.line} style={{ fontSize: 12, color: "#b45309" }}>Ligne {e.line} : {e.msg}</div>
              ))}
              {errors.length > 5 && <div style={{ fontSize: 12, color: "#9ca3af" }}>… et {errors.length - 5} autres</div>}
            </div>
          )}

          {mapped.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>
                Aperçu ({validCount} valides sur {mapped.length})
              </div>
              <div className="border rounded-md max-h-80 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead style={{ width: 40 }}>#</TableHead>
                      <TableHead style={{ width: 60 }}>Statut</TableHead>
                      {Object.keys(mapped[0] ?? {}).filter(k => !k.startsWith("_")).map(k => <TableHead key={k}>{k}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mapped.slice(0, 50).map((r, i) => {
                      const err = validateRow(r, entity);
                      return (
                        <TableRow key={i} style={{ background: err ? "#fef2f2" : "transparent" }}>
                          <TableCell style={{ color: "#9ca3af", fontSize: 11 }}>{i + 2}</TableCell>
                          <TableCell>
                            {err
                              ? <span style={{ fontSize: 10, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 4, padding: "1px 5px" }}>⚠️ {err}</span>
                              : <span style={{ fontSize: 10, background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", borderRadius: 4, padding: "1px 5px" }}>✓</span>
                            }
                          </TableCell>
                          {Object.keys(mapped[0]).filter(k => !k.startsWith("_")).map(k => (
                            <TableCell key={k} style={{ fontSize: 12 }}>{String(r[k] ?? "")}</TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {mapped.length > 50 && (
                  <div className="p-2 text-xs text-muted-foreground text-center">… {mapped.length - 50} lignes supplémentaires</div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}