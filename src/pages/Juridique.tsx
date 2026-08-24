import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { fmtFCFA, fmtDate } from "@/lib/format";
import { Plus, Scale, Gavel, Download } from "lucide-react";
import { downloadMEDPDF } from "@/lib/pdf";

export default function Juridique() {
  const [meds, setMeds] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [frais, setFrais] = useState<any[]>([]);
  const [bauxRetard, setBauxRetard] = useState<any[]>([]);
  const [baux, setBaux] = useState<any[]>([]);

  const [openMed, setOpenMed] = useState(false);
  const [openProc, setOpenProc] = useState(false);
  const [openFrais, setOpenFrais] = useState(false);

  const [medForm, setMedForm] = useState({ bail_id: "", montant_du: "", nb_mois_retard: "2", delai_jours: "15" });
  const [procForm, setProcForm] = useState({ bail_id: "", med_id: "", type: "commandement", juridiction: "", reference_dossier: "", avocat: "", huissier: "" });
  const [fraisForm, setFraisForm] = useState({ bail_id: "", procedure_id: "", type: "huissier", libelle: "", montant: "", imputable_locataire: true });

  const load = async () => {
    const [{ data: m }, { data: pr }, { data: f }, { data: b }] = await Promise.all([
      supabase.from("mises_en_demeure").select("*, baux(reference, locataires(nom,prenom), biens(reference,quartier))").order("created_at", { ascending: false }),
      supabase.from("procedures").select("*, baux(reference, locataires(nom,prenom))").order("created_at", { ascending: false }),
      supabase.from("frais_juridiques").select("*, baux(reference, locataires(nom,prenom))").order("date_frais", { ascending: false }),
      supabase.from("baux").select("id, reference, loyer_mensuel, date_entree, locataires(nom,prenom), biens(reference,quartier)").eq("statut", "actif"),
    ]);
    setMeds(m ?? []); setProcedures(pr ?? []); setFrais(f ?? []); setBaux(b ?? []);

    // Calcul des baux en retard ≥ 2 mois
    const { data: pays } = await supabase.from("paiements").select("bail_id, mois_concerne, montant");
    const today = new Date();
    const retards = (b ?? []).map((bail: any) => {
      const start = new Date(bail.date_entree);
      const monthsDue = Math.max(0, (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth()) + 1);
      const totalDu = monthsDue * Number(bail.loyer_mensuel);
      const totalPaye = (pays ?? []).filter((p: any) => p.bail_id === bail.id).reduce((s: number, p: any) => s + Number(p.montant), 0);
      const arriere = totalDu - totalPaye;
      const moisRetard = arriere > 0 ? Math.floor(arriere / Number(bail.loyer_mensuel)) : 0;
      return { ...bail, arriere, moisRetard };
    }).filter((x: any) => x.moisRetard >= 2);
    setBauxRetard(retards);
  };
  useEffect(() => { load(); }, []);

  const ouvrirMedDepuisRetard = (bail: any) => {
    setMedForm({
      bail_id: bail.id,
      montant_du: String(bail.arriere),
      nb_mois_retard: String(bail.moisRetard),
      delai_jours: "15",
    });
    setOpenMed(true);
  };

  const submitMed = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("mises_en_demeure").insert({
      bail_id: medForm.bail_id,
      montant_du: Number(medForm.montant_du),
      nb_mois_retard: Number(medForm.nb_mois_retard),
      delai_jours: Number(medForm.delai_jours),
      statut: "envoyee",
      date_envoi: new Date().toISOString().slice(0, 10),
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Mise en demeure générée"); setOpenMed(false);
    setMedForm({ bail_id: "", montant_du: "", nb_mois_retard: "2", delai_jours: "15" });
    load();
  };

  const updateMedStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("mises_en_demeure").update({ statut: statut as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour"); load();
  };

  const submitProc = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("procedures").insert({
      bail_id: procForm.bail_id,
      med_id: procForm.med_id || null,
      type: procForm.type as any,
      juridiction: procForm.juridiction || null,
      reference_dossier: procForm.reference_dossier || null,
      avocat: procForm.avocat || null,
      huissier: procForm.huissier || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Procédure ouverte"); setOpenProc(false);
    setProcForm({ bail_id: "", med_id: "", type: "commandement", juridiction: "", reference_dossier: "", avocat: "", huissier: "" });
    load();
  };

  const submitFrais = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("frais_juridiques").insert({
      bail_id: fraisForm.bail_id,
      procedure_id: fraisForm.procedure_id || null,
      type: fraisForm.type as any,
      libelle: fraisForm.libelle,
      montant: Number(fraisForm.montant),
      imputable_locataire: fraisForm.imputable_locataire,
    });
    if (error) return toast.error(error.message);
    toast.success("Frais enregistré"); setOpenFrais(false);
    setFraisForm({ bail_id: "", procedure_id: "", type: "huissier", libelle: "", montant: "", imputable_locataire: true });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Service Juridique</h1>
        <p className="text-muted-foreground">Mises en demeure · procédures · frais</p>
      </div>

      <Tabs defaultValue="med">
        <TabsList>
          <TabsTrigger value="med">Mises en demeure</TabsTrigger>
          <TabsTrigger value="procedures">Procédures</TabsTrigger>
          <TabsTrigger value="frais">Frais</TabsTrigger>
        </TabsList>

        {/* MED */}
        <TabsContent value="med" className="space-y-4">
          {bauxRetard.length > 0 && (
            <Card className="border-destructive">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Scale className="h-4 w-4" />Locataires en retard ≥ 2 mois ({bauxRetard.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>Locataire</TableHead><TableHead>Bien</TableHead><TableHead>Mois retard</TableHead><TableHead className="text-right">Arriéré</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {bauxRetard.map(b => (
                      <TableRow key={b.id}>
                        <TableCell>{b.locataires?.nom} {b.locataires?.prenom}</TableCell>
                        <TableCell>{b.biens?.reference} — {b.biens?.quartier}</TableCell>
                        <TableCell><Badge variant="destructive">{b.moisRetard} mois</Badge></TableCell>
                        <TableCell className="text-right font-medium">{fmtFCFA(b.arriere)}</TableCell>
                        <TableCell className="text-right"><Button size="sm" onClick={() => ouvrirMedDepuisRetard(b)}>Émettre MED</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Dialog open={openMed} onOpenChange={setOpenMed}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />Nouvelle MED manuelle</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Mise en demeure</DialogTitle></DialogHeader>
                <form onSubmit={submitMed} className="space-y-3">
                  <div><Label>Bail *</Label>
                    <Select value={medForm.bail_id} onValueChange={(v) => setMedForm({ ...medForm, bail_id: v })} required>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{baux.map(b => <SelectItem key={b.id} value={b.id}>{b.reference} — {b.locataires?.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label>Montant dû *</Label><Input type="number" required value={medForm.montant_du} onChange={e => setMedForm({ ...medForm, montant_du: e.target.value })} /></div>
                    <div><Label>Mois retard</Label><Input type="number" value={medForm.nb_mois_retard} onChange={e => setMedForm({ ...medForm, nb_mois_retard: e.target.value })} /></div>
                    <div><Label>Délai (jours)</Label><Input type="number" value={medForm.delai_jours} onChange={e => setMedForm({ ...medForm, delai_jours: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button type="submit">Émettre</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Date envoi</TableHead><TableHead>Locataire</TableHead><TableHead>Bien</TableHead><TableHead className="text-right">Montant</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">PDF</TableHead></TableRow></TableHeader>
              <TableBody>
                {meds.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.numero}</TableCell>
                    <TableCell>{fmtDate(m.date_envoi || m.date_emission)}</TableCell>
                    <TableCell>{m.baux?.locataires?.nom} {m.baux?.locataires?.prenom}</TableCell>
                    <TableCell>{m.baux?.biens?.reference}</TableCell>
                    <TableCell className="text-right">{fmtFCFA(m.montant_du)}</TableCell>
                    <TableCell>
                      <Select value={m.statut} onValueChange={(v) => updateMedStatut(m.id, v)}>
                        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="brouillon">Brouillon</SelectItem>
                          <SelectItem value="envoyee">Envoyée</SelectItem>
                          <SelectItem value="recue">Reçue</SelectItem>
                          <SelectItem value="sans_reponse">Sans réponse</SelectItem>
                          <SelectItem value="regularisee">Régularisée</SelectItem>
                          <SelectItem value="escaladee">Escaladée</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => downloadMEDPDF(m)}><Download className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {meds.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucune mise en demeure</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* PROCEDURES */}
        <TabsContent value="procedures" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openProc} onOpenChange={setOpenProc}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouvelle procédure</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Ouvrir une procédure</DialogTitle></DialogHeader>
                <form onSubmit={submitProc} className="space-y-3">
                  <div><Label>Bail *</Label>
                    <Select value={procForm.bail_id} onValueChange={(v) => setProcForm({ ...procForm, bail_id: v })} required>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{baux.map(b => <SelectItem key={b.id} value={b.id}>{b.reference} — {b.locataires?.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>MED associée (optionnel)</Label>
                    <Select value={procForm.med_id || "_none"} onValueChange={(v) => setProcForm({ ...procForm, med_id: v === "_none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Aucune</SelectItem>
                        {meds.filter(m => m.bail_id === procForm.bail_id).map(m => <SelectItem key={m.id} value={m.id}>{m.numero}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Type *</Label>
                      <Select value={procForm.type} onValueChange={(v) => setProcForm({ ...procForm, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="commandement">Commandement</SelectItem>
                          <SelectItem value="assignation">Assignation</SelectItem>
                          <SelectItem value="jugement">Jugement</SelectItem>
                          <SelectItem value="expulsion">Expulsion</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Juridiction</Label><Input value={procForm.juridiction} onChange={e => setProcForm({ ...procForm, juridiction: e.target.value })} /></div>
                    <div><Label>Référence dossier</Label><Input value={procForm.reference_dossier} onChange={e => setProcForm({ ...procForm, reference_dossier: e.target.value })} /></div>
                    <div><Label>Avocat</Label><Input value={procForm.avocat} onChange={e => setProcForm({ ...procForm, avocat: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Huissier</Label><Input value={procForm.huissier} onChange={e => setProcForm({ ...procForm, huissier: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button type="submit">Ouvrir</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Locataire</TableHead><TableHead>Bail</TableHead><TableHead>Début</TableHead><TableHead>Audience</TableHead><TableHead>Réf.</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {procedures.map(p => (
                  <TableRow key={p.id}>
                    <TableCell><Badge variant="outline"><Gavel className="h-3 w-3 mr-1" />{p.type}</Badge></TableCell>
                    <TableCell>{p.baux?.locataires?.nom} {p.baux?.locataires?.prenom}</TableCell>
                    <TableCell>{p.baux?.reference}</TableCell>
                    <TableCell>{fmtDate(p.date_debut)}</TableCell>
                    <TableCell>{p.date_audience ? fmtDate(p.date_audience) : "—"}</TableCell>
                    <TableCell className="text-xs">{p.reference_dossier || "—"}</TableCell>
                    <TableCell><Badge variant={p.statut === "close_favorable" ? "default" : p.statut === "close_defavorable" ? "destructive" : "secondary"}>{p.statut}</Badge></TableCell>
                  </TableRow>
                ))}
                {procedures.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucune procédure</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* FRAIS */}
        <TabsContent value="frais" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openFrais} onOpenChange={setOpenFrais}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouveau frais</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Frais juridique</DialogTitle></DialogHeader>
                <form onSubmit={submitFrais} className="space-y-3">
                  <div><Label>Bail *</Label>
                    <Select value={fraisForm.bail_id} onValueChange={(v) => setFraisForm({ ...fraisForm, bail_id: v })} required>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{baux.map(b => <SelectItem key={b.id} value={b.id}>{b.reference} — {b.locataires?.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Procédure (optionnel)</Label>
                    <Select value={fraisForm.procedure_id || "_none"} onValueChange={(v) => setFraisForm({ ...fraisForm, procedure_id: v === "_none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Aucune</SelectItem>
                        {procedures.filter(p => p.bail_id === fraisForm.bail_id).map(p => <SelectItem key={p.id} value={p.id}>{p.type} — {fmtDate(p.date_debut)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Type *</Label>
                      <Select value={fraisForm.type} onValueChange={(v) => setFraisForm({ ...fraisForm, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="huissier">Huissier</SelectItem>
                          <SelectItem value="avocat">Avocat</SelectItem>
                          <SelectItem value="greffe">Greffe</SelectItem>
                          <SelectItem value="autre">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Montant *</Label><Input type="number" required value={fraisForm.montant} onChange={e => setFraisForm({ ...fraisForm, montant: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Libellé *</Label><Input required value={fraisForm.libelle} onChange={e => setFraisForm({ ...fraisForm, libelle: e.target.value })} /></div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={fraisForm.imputable_locataire} onChange={e => setFraisForm({ ...fraisForm, imputable_locataire: e.target.checked })} />
                    Imputable au locataire
                  </label>
                  <DialogFooter><Button type="submit">Enregistrer</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Libellé</TableHead><TableHead>Locataire</TableHead><TableHead className="text-right">Montant</TableHead><TableHead>Imputable</TableHead></TableRow></TableHeader>
              <TableBody>
                {frais.map(f => (
                  <TableRow key={f.id}>
                    <TableCell>{fmtDate(f.date_frais)}</TableCell>
                    <TableCell><Badge variant="outline">{f.type}</Badge></TableCell>
                    <TableCell>{f.libelle}</TableCell>
                    <TableCell>{f.baux?.locataires?.nom}</TableCell>
                    <TableCell className="text-right font-medium">{fmtFCFA(f.montant)}</TableCell>
                    <TableCell>{f.imputable_locataire ? <Badge>Locataire</Badge> : <Badge variant="secondary">Agence</Badge>}</TableCell>
                  </TableRow>
                ))}
                {frais.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucun frais</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
