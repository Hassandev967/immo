import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { exportToExcel, formatXOF } from "@/lib/io";
import { toast } from "sonner";
import { Calendar, CalendarDays, CalendarRange, Download } from "lucide-react";

export default function Exports() {
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [busy, setBusy] = useState<string | null>(null);

  const fetchAll = async (start: string, end: string) => {
    const [paiements, factures, med, procs, frais, prospects, visites, candidatures, reversements, classification] = await Promise.all([
      supabase.from("paiements").select("*, baux(reference, locataires(nom, prenom))").gte("date_paiement", start).lte("date_paiement", end),
      supabase.from("factures_entree").select("*").gte("date_emission", start).lte("date_emission", end),
      supabase.from("mises_en_demeure").select("*").gte("date_emission", start).lte("date_emission", end),
      supabase.from("procedures").select("*").gte("date_debut", start).lte("date_debut", end),
      supabase.from("frais_juridiques").select("*").gte("date_frais", start).lte("date_frais", end),
      supabase.from("prospects").select("*").gte("created_at", start).lte("created_at", end + "T23:59:59"),
      supabase.from("visites").select("*").gte("date_visite", start).lte("date_visite", end + "T23:59:59"),
      supabase.from("candidatures").select("*").gte("created_at", start).lte("created_at", end + "T23:59:59"),
      supabase.from("reversements").select("*, proprietaires(nom)").gte("mois_concerne", start).lte("mois_concerne", end),
      supabase.from("v_locataires_classification" as any).select("*"),
    ]);
    return { paiements: paiements.data || [], factures: factures.data || [], med: med.data || [], procs: procs.data || [], frais: frais.data || [], prospects: prospects.data || [], visites: visites.data || [], candidatures: candidatures.data || [], reversements: reversements.data || [], classification: (classification.data as any[]) || [] };
  };

  const generate = async (kind: "jour" | "mois" | "annee") => {
    setBusy(kind);
    try {
      let start: string, end: string, label: string;
      if (kind === "jour") { start = day; end = day; label = `journalier_${day}`; }
      else if (kind === "mois") {
        const [y, m] = month.split("-");
        start = `${month}-01`;
        const last = new Date(Number(y), Number(m), 0).getDate();
        end = `${month}-${String(last).padStart(2, "0")}`;
        label = `mensuel_${month}`;
      } else {
        start = `${year}-01-01`; end = `${year}-12-31`; label = `annuel_${year}`;
      }

      const d = await fetchAll(start, end);
      const totalEnc = d.paiements.reduce((s: number, p: any) => s + Number(p.montant), 0);
      const totalFrais = d.frais.reduce((s: number, p: any) => s + Number(p.montant), 0);
      const totalReversements = d.reversements.reduce((s: number, p: any) => s + Number(p.net_a_reverser), 0);

      exportToExcel([
        { name: "Synthèse", rows: [
          { Indicateur: "Période", Valeur: `${start} → ${end}` },
          { Indicateur: "Encaissements (XOF)", Valeur: totalEnc },
          { Indicateur: "Nb paiements", Valeur: d.paiements.length },
          { Indicateur: "Factures d'entrée", Valeur: d.factures.length },
          { Indicateur: "Mises en demeure", Valeur: d.med.length },
          { Indicateur: "Procédures", Valeur: d.procs.length },
          { Indicateur: "Frais juridiques (XOF)", Valeur: totalFrais },
          { Indicateur: "Prospects", Valeur: d.prospects.length },
          { Indicateur: "Visites", Valeur: d.visites.length },
          { Indicateur: "Candidatures", Valeur: d.candidatures.length },
          { Indicateur: "Reversements (XOF)", Valeur: totalReversements },
          { Indicateur: "Locataires en retard", Valeur: d.classification.filter((r: any) => r.statut_paiement !== "a_jour").length },
        ]},
        { name: "Encaissements", rows: d.paiements.map((p: any) => ({
          Date: p.date_paiement, Quittance: p.numero_quittance, Bail: p.baux?.reference,
          Locataire: p.baux?.locataires ? `${p.baux.locataires.nom} ${p.baux.locataires.prenom ?? ""}` : "",
          Montant: Number(p.montant), Mode: p.mode, "Mois concerné": p.mois_concerne, Réf: p.reference_externe,
        })) },
        { name: "Factures entrée", rows: d.factures.map((f: any) => ({ Numéro: f.numero, Date: f.date_emission, Total: Number(f.total), Statut: f.statut })) },
        { name: "Impayés", rows: d.classification.filter((r: any) => r.statut_paiement !== "a_jour").map((r: any) => ({
          Locataire: `${r.locataire_nom} ${r.locataire_prenom ?? ""}`, Bien: r.bien_reference, Loyer: Number(r.loyer_mensuel), "Solde dû": Number(r.solde_du), "Mois écoulés": r.nb_mois_ecoules,
        })) },
        { name: "Mises en demeure", rows: d.med.map((m: any) => ({ Numéro: m.numero, Date: m.date_emission, "Montant dû": Number(m.montant_du), "Mois retard": m.nb_mois_retard, Statut: m.statut })) },
        { name: "Procédures", rows: d.procs.map((p: any) => ({ Type: p.type, "Date début": p.date_debut, Statut: p.statut, Juridiction: p.juridiction, Avocat: p.avocat, Huissier: p.huissier })) },
        { name: "Frais juridiques", rows: d.frais.map((f: any) => ({ Date: f.date_frais, Type: f.type, Libellé: f.libelle, Montant: Number(f.montant), Payé: f.paye ? "Oui" : "Non" })) },
        { name: "Commercial — Prospects", rows: d.prospects.map((p: any) => ({ Nom: `${p.nom} ${p.prenom ?? ""}`, Téléphone: p.telephone, Statut: p.statut, "Type recherché": p.type_recherche, Commune: p.commune_recherche, Budget: Number(p.budget_max || 0), Date: p.created_at })) },
        { name: "Commercial — Visites", rows: d.visites.map((v: any) => ({ Date: v.date_visite, Statut: v.statut, Commentaire: v.commentaire })) },
        { name: "Commercial — Candidatures", rows: d.candidatures.map((c: any) => ({ Statut: c.statut, "Revenus mensuels": Number(c.revenus_mensuels || 0), Employeur: c.employeur, Garant: c.garant_nom })) },
        { name: "Reversements", rows: d.reversements.map((r: any) => ({ Mois: r.mois_concerne, Propriétaire: r.proprietaires?.nom, Encaissé: Number(r.total_encaisse), Honoraires: Number(r.honoraires), Charges: Number(r.charges_deduites), "Net à reverser": Number(r.net_a_reverser), Statut: r.statut })) },
      ], `rapport_${label}`);
      toast.success("Rapport généré");
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rapports & Exports</h1>
        <p className="text-muted-foreground">Pack complet : caisse, impayés, juridique, commercial, reversements</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Rapport journalier</CardTitle>
            <CardDescription>Activité d'une journée</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Date</Label>
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            <Button className="w-full" disabled={busy === "jour"} onClick={() => generate("jour")}>
              <Download className="h-4 w-4 mr-2" />{busy === "jour" ? "Génération…" : "Générer"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5" />Rapport mensuel</CardTitle>
            <CardDescription>Synthèse du mois</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Mois</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <Button className="w-full" disabled={busy === "mois"} onClick={() => generate("mois")}>
              <Download className="h-4 w-4 mr-2" />{busy === "mois" ? "Génération…" : "Générer"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarRange className="h-5 w-5" />Rapport annuel</CardTitle>
            <CardDescription>Bilan de l'année</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Année</Label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} min="2020" max="2100" />
            <Button className="w-full" disabled={busy === "annee"} onClick={() => generate("annee")}>
              <Download className="h-4 w-4 mr-2" />{busy === "annee" ? "Génération…" : "Générer"}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Contenu des rapports</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li>Synthèse globale (KPIs)</li>
            <li>Encaissements détaillés (caisse)</li>
            <li>Factures d'entrée</li>
            <li>Impayés (locataires en retard avec solde dû)</li>
            <li>Mises en demeure et procédures juridiques</li>
            <li>Frais juridiques</li>
            <li>Pipeline commercial (prospects, visites, candidatures)</li>
            <li>Reversements aux propriétaires</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
