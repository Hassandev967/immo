import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtFCFA, monthLabel } from "@/lib/format";
import { ArrowLeft, Building2, Mail, Phone, Receipt, ScrollText, Wallet } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

export default function FicheProprietaire() {
  const { id } = useParams();
  const { fieldPerm } = usePermissions();
  const showHonoraires = fieldPerm("proprietaires", "taux_honoraires").visible;
  const [prop, setProp] = useState<any>(null);
  const [biens, setBiens] = useState<any[]>([]);
  const [reversements, setReversements] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: p }, { data: bi }, { data: rv }] = await Promise.all([
        supabase.from("proprietaires").select("*").eq("id", id).maybeSingle(),
        supabase.from("biens").select("*, baux(id, reference, statut, loyer_mensuel, locataires(id, nom, prenom, raison_sociale, type_personne))").eq("proprietaire_id", id).order("created_at", { ascending: false }),
        supabase.from("reversements").select("*").eq("proprietaire_id", id).order("mois_concerne", { ascending: false }),
      ]);
      setProp(p); setBiens(bi ?? []); setReversements(rv ?? []);

      const bailIds = (bi ?? []).flatMap((b: any) => (b.baux ?? []).map((x: any) => x.id));
      if (bailIds.length) {
        const { data: pa } = await supabase.from("paiements").select("*, baux(reference, locataires(nom, prenom, raison_sociale, type_personne))").in("bail_id", bailIds).order("date_paiement", { ascending: false }).limit(50);
        setPaiements(pa ?? []);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-6 text-muted-foreground">Chargement…</div>;
  if (!prop) return <div className="p-6 text-muted-foreground">Propriétaire introuvable.</div>;

  const totalBiens = biens.length;
  const biensLoues = biens.filter(b => b.statut === "occupe").length;
  const revenuMensuel = biens.flatMap(b => b.baux ?? []).filter((x: any) => x.statut === "actif").reduce((s, x: any) => s + Number(x.loyer_mensuel), 0);
  const totalReverse = reversements.reduce((s, r) => s + Number(r.net_a_reverser), 0);

  const nomLoc = (l: any) => l?.type_personne === "morale" ? l?.raison_sociale : `${l?.prenom ?? ""} ${l?.nom ?? ""}`.trim();

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild><Link to="/proprietaires"><ArrowLeft className="h-4 w-4 mr-1" />Propriétaires</Link></Button>

      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{prop.nom}</h1>
          <Badge variant="outline">{prop.type_personne === "morale" ? "Personne morale" : "Personne physique"}</Badge>
        </div>
        <div className="text-sm text-muted-foreground mt-1 font-mono">{prop.numero_gestion}</div>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
          {prop.telephone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{prop.telephone}</span>}
          {prop.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{prop.email}</span>}
          {showHonoraires && <span>Honoraires : <strong>{prop.taux_honoraires}%</strong></span>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Biens</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">{totalBiens}</div><div className="text-xs text-muted-foreground">{biensLoues} loué(s)</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Revenu mensuel brut</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">{fmtFCFA(revenuMensuel)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Total reversé</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold text-success">{fmtFCFA(totalReverse)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Reversements</CardDescription></CardHeader><CardContent><div className="text-2xl font-bold">{reversements.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="biens">
        <TabsList>
          <TabsTrigger value="biens"><Building2 className="h-4 w-4 mr-1" />Biens ({biens.length})</TabsTrigger>
          <TabsTrigger value="encaissements"><Receipt className="h-4 w-4 mr-1" />Encaissements ({paiements.length})</TabsTrigger>
          <TabsTrigger value="reversements"><Wallet className="h-4 w-4 mr-1" />Reversements ({reversements.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="biens">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Référence</TableHead><TableHead>Type</TableHead><TableHead>Quartier</TableHead><TableHead>Locataire actif</TableHead><TableHead className="text-right">Loyer</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {biens.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun bien</TableCell></TableRow>}
                {biens.map(b => {
                  const bailActif = (b.baux ?? []).find((x: any) => x.statut === "actif");
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.reference}</TableCell>
                      <TableCell>{b.type}</TableCell>
                      <TableCell className="text-muted-foreground">{b.quartier}</TableCell>
                      <TableCell>{bailActif?.locataires ? <Link className="text-primary hover:underline" to={`/locataires/${bailActif.locataires.id}`}>{nomLoc(bailActif.locataires)}</Link> : <span className="text-muted-foreground italic">vacant</span>}</TableCell>
                      <TableCell className="text-right">{fmtFCFA(b.loyer_mensuel)}</TableCell>
                      <TableCell><Badge variant={b.statut === "occupe" ? "default" : "secondary"}>{b.statut}</Badge></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="encaissements">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Quittance</TableHead><TableHead>Date</TableHead><TableHead>Locataire</TableHead><TableHead>Mois</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
              <TableBody>
                {paiements.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun encaissement</TableCell></TableRow>}
                {paiements.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.numero_quittance}</TableCell>
                    <TableCell>{fmtDate(p.date_paiement)}</TableCell>
                    <TableCell>{nomLoc(p.baux?.locataires)}</TableCell>
                    <TableCell>{monthLabel(p.mois_concerne)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmtFCFA(p.montant)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="reversements">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow><TableHead>Mois</TableHead><TableHead className="text-right">Encaissé</TableHead><TableHead className="text-right">Honoraires</TableHead><TableHead className="text-right">Charges</TableHead><TableHead className="text-right">Net</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {reversements.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun reversement</TableCell></TableRow>}
                {reversements.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{monthLabel(r.mois_concerne)}</TableCell>
                    <TableCell className="text-right">{fmtFCFA(r.total_encaisse)}</TableCell>
                    <TableCell className="text-right">{fmtFCFA(r.honoraires)}</TableCell>
                    <TableCell className="text-right">{fmtFCFA(r.charges_deduites)}</TableCell>
                    <TableCell className="text-right font-bold text-success">{fmtFCFA(r.net_a_reverser)}</TableCell>
                    <TableCell><Badge>{r.statut}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
