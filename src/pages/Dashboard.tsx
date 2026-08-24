import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtFCFA } from "@/lib/format";
import { Building2, Wallet, AlertTriangle, Home, UserCheck, Clock, FileWarning, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalBiens: 0, occupes: 0, vacants: 0,
    encaisseMois: 0, baux: 0, impayes: 0, montantImpayes: 0
  });
  const [alertes, setAlertes] = useState({ aJour: 0, enRetard: 0, bailRenouv: 0, docsRenouv: 0 });

  useEffect(() => {
    (async () => {
      const today = new Date();
      const debutMois = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);

      const [biens, baux, paiements] = await Promise.all([
        supabase.from("biens").select("id, statut"),
        supabase.from("baux").select("id, loyer_mensuel, jour_echeance, date_entree, statut").eq("statut", "actif"),
        supabase.from("paiements").select("montant, mois_concerne, bail_id").gte("date_paiement", debutMois),
      ]);

      const totalBiens = biens.data?.length ?? 0;
      const occupes = biens.data?.filter(b => b.statut === "occupe").length ?? 0;
      const vacants = biens.data?.filter(b => b.statut === "vacant").length ?? 0;
      const encaisseMois = paiements.data?.reduce((s, p: any) => s + Number(p.montant), 0) ?? 0;

      // Calcul impayés simple : pour chaque bail actif, vérifier paiement du mois
      const moisCourant = debutMois;
      const baillesActifs = baux.data ?? [];
      const paiesCeMois = new Set(
        (paiements.data ?? []).filter((p: any) => p.mois_concerne === moisCourant).map((p: any) => p.bail_id)
      );
      const impayesArr = baillesActifs.filter(b => !paiesCeMois.has(b.id));
      const montantImpayes = impayesArr.reduce((s, b: any) => s + Number(b.loyer_mensuel), 0);

      setStats({
        totalBiens, occupes, vacants,
        encaisseMois, baux: baillesActifs.length,
        impayes: impayesArr.length, montantImpayes
      });

      const { data: classif } = await supabase.from("v_locataires_classification" as any).select("statut_paiement,statut_bail,pieces_a_renouveler");
      const arr = (classif as any[]) || [];
      setAlertes({
        aJour: arr.filter((r) => r.statut_paiement === "a_jour").length,
        enRetard: arr.filter((r) => r.statut_paiement !== "a_jour").length,
        bailRenouv: arr.filter((r) => ["a_renouveler", "expire"].includes(r.statut_bail)).length,
        docsRenouv: arr.filter((r) => r.pieces_a_renouveler).length,
      });
    })();
  }, []);

  const tauxOccup = stats.totalBiens ? Math.round((stats.occupes / stats.totalBiens) * 100) : 0;

  const cards = [
    { label: "Biens en gestion", value: stats.totalBiens, sub: `${stats.occupes} occupés · ${stats.vacants} vacants`, icon: Building2 },
    { label: "Taux d'occupation", value: `${tauxOccup}%`, sub: "Cible > 95%", icon: Home, accent: tauxOccup >= 95 ? "text-success" : "text-warning" },
    { label: "Encaissé ce mois", value: fmtFCFA(stats.encaisseMois), sub: `${stats.baux} baux actifs`, icon: Wallet, accent: "text-success" },
    { label: "Impayés en cours", value: stats.impayes, sub: fmtFCFA(stats.montantImpayes), icon: AlertTriangle, accent: stats.impayes > 0 ? "text-destructive" : "" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm">Vue d'ensemble de l'agence — données temps réel</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${c.accent ?? ""}`}>{c.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><UserCheck className="h-5 w-5" />Alertes locataires</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "À jour", value: alertes.aJour, icon: CheckCircle2, color: "text-green-600" },
            { label: "En retard", value: alertes.enRetard, icon: AlertTriangle, color: "text-destructive" },
            { label: "Bail à renouveler", value: alertes.bailRenouv, icon: Clock, color: "text-amber-500" },
            { label: "Docs à renouveler", value: alertes.docsRenouv, icon: FileWarning, color: "text-amber-500" },
          ].map((a, i) => (
            <Link key={i} to="/suivi-locataires">
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{a.label}</CardTitle>
                  <a.icon className={`h-4 w-4 ${a.color}`} />
                </CardHeader>
                <CardContent><div className={`text-2xl font-bold ${a.color}`}>{a.value}</div></CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Conformité légale appliquée</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>⚖️ <strong>Loi 2018-575 art. 22</strong> — Caution plafonnée à 2 mois de loyer (bloqué automatiquement à la création du bail).</div>
          <div>⚖️ <strong>Avance loyer</strong> — Maximum 2 mois (validation système).</div>
          <div>⚖️ <strong>Date d'échéance</strong> — Le 5 du mois par défaut, ou prorata temporis selon date d'entrée.</div>
        </CardContent>
      </Card>
    </div>
  );
}
