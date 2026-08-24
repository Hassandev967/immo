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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { fmtFCFA, fmtDate } from "@/lib/format";
import { Plus, AlertCircle, FileText, ArrowRight, Download } from "lucide-react";
import { downloadFactureEntreePDF } from "@/lib/pdf";

const PROSPECT_STATUTS = [
  { v: "nouveau", label: "Nouveau" },
  { v: "contacte", label: "Contacté" },
  { v: "visite_planifiee", label: "Visite planifiée" },
  { v: "visite_effectuee", label: "Visite effectuée" },
  { v: "candidature", label: "Candidature" },
  { v: "accepte", label: "Accepté" },
  { v: "refuse", label: "Refusé" },
  { v: "perdu", label: "Perdu" },
];

const statutColor = (s: string) => {
  if (["accepte"].includes(s)) return "default";
  if (["refuse", "perdu"].includes(s)) return "destructive";
  if (["candidature", "visite_effectuee"].includes(s)) return "secondary";
  return "outline";
};

export default function Commercial() {
  const [prospects, setProspects] = useState<any[]>([]);
  const [visites, setVisites] = useState<any[]>([]);
  const [candidatures, setCandidatures] = useState<any[]>([]);
  const [factures, setFactures] = useState<any[]>([]);
  const [biens, setBiens] = useState<any[]>([]);

  const [openProspect, setOpenProspect] = useState(false);
  const [openVisite, setOpenVisite] = useState(false);
  const [openCand, setOpenCand] = useState(false);
  const [openFact, setOpenFact] = useState(false);

  const [pForm, setPForm] = useState({ nom: "", prenom: "", telephone: "", email: "", budget_max: "", type_recherche: "", commune_recherche: "", source: "" });
  const [vForm, setVForm] = useState({ prospect_id: "", bien_id: "", date_visite: "", commentaire: "" });
  const [cForm, setCForm] = useState({ prospect_id: "", bien_id: "", revenus_mensuels: "", employeur: "", garant_nom: "", garant_telephone: "" });
  const [fForm, setFForm] = useState({ candidature_id: "", bien_id: "", loyer_mensuel: "", caution: "", avance_loyer: "", commission_agence: "" });

  const load = async () => {
    const [{ data: p }, { data: v }, { data: c }, { data: f }, { data: b }] = await Promise.all([
      supabase.from("prospects").select("*").order("created_at", { ascending: false }),
      supabase.from("visites").select("*, prospects(nom,prenom), biens(reference,quartier)").order("date_visite", { ascending: false }),
      supabase.from("candidatures").select("*, prospects(nom,prenom), biens(reference,quartier,loyer_mensuel)").order("created_at", { ascending: false }),
      supabase.from("factures_entree").select("*, biens(reference,quartier)").order("created_at", { ascending: false }),
      supabase.from("biens").select("id, reference, quartier, loyer_mensuel, statut"),
    ]);
    setProspects(p ?? []); setVisites(v ?? []); setCandidatures(c ?? []); setFactures(f ?? []); setBiens(b ?? []);
  };
  useEffect(() => { load(); }, []);

  const updateProspectStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("prospects").update({ statut: statut as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour"); load();
  };

  const submitProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("prospects").insert({
      ...pForm,
      budget_max: pForm.budget_max ? Number(pForm.budget_max) : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Prospect créé"); setOpenProspect(false);
    setPForm({ nom: "", prenom: "", telephone: "", email: "", budget_max: "", type_recherche: "", commune_recherche: "", source: "" });
    load();
  };

  const submitVisite = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("visites").insert({
      prospect_id: vForm.prospect_id, bien_id: vForm.bien_id,
      date_visite: vForm.date_visite, commentaire: vForm.commentaire || null,
    });
    if (error) return toast.error(error.message);
    await supabase.from("prospects").update({ statut: "visite_planifiee" }).eq("id", vForm.prospect_id);
    toast.success("Visite planifiée"); setOpenVisite(false);
    setVForm({ prospect_id: "", bien_id: "", date_visite: "", commentaire: "" });
    load();
  };

  const submitCandidature = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("candidatures").insert({
      prospect_id: cForm.prospect_id, bien_id: cForm.bien_id,
      revenus_mensuels: cForm.revenus_mensuels ? Number(cForm.revenus_mensuels) : null,
      employeur: cForm.employeur || null,
      garant_nom: cForm.garant_nom || null,
      garant_telephone: cForm.garant_telephone || null,
    });
    if (error) return toast.error(error.message);
    await supabase.from("prospects").update({ statut: "candidature" }).eq("id", cForm.prospect_id);
    toast.success("Candidature enregistrée"); setOpenCand(false);
    setCForm({ prospect_id: "", bien_id: "", revenus_mensuels: "", employeur: "", garant_nom: "", garant_telephone: "" });
    load();
  };

  const decideCandidature = async (id: string, accept: boolean) => {
    const { error } = await supabase.from("candidatures").update({ statut: accept ? "acceptee" : "refusee" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(accept ? "Candidature acceptée" : "Candidature refusée"); load();
  };

  const onBienFactChange = (id: string) => {
    const b = biens.find(x => x.id === id);
    if (b) setFForm(f => ({ ...f, bien_id: id, loyer_mensuel: String(b.loyer_mensuel) }));
  };

  const openFactureFromCand = (cand: any) => {
    setFForm({
      candidature_id: cand.id,
      bien_id: cand.bien_id,
      loyer_mensuel: String(cand.biens?.loyer_mensuel ?? ""),
      caution: String(Number(cand.biens?.loyer_mensuel ?? 0) * 2),
      avance_loyer: String(Number(cand.biens?.loyer_mensuel ?? 0) * 2),
      commission_agence: String(cand.biens?.loyer_mensuel ?? 0),
    });
    setOpenFact(true);
  };

  const submitFacture = async (e: React.FormEvent) => {
    e.preventDefault();
    const loyer = Number(fForm.loyer_mensuel);
    const caution = Number(fForm.caution);
    const avance = Number(fForm.avance_loyer);
    const commission = Number(fForm.commission_agence);
    if (caution > loyer * 2) return toast.error("Caution > 2 mois (Loi 2018-575)");
    if (avance > loyer * 2) return toast.error("Avance > 2 mois");
    if (commission > loyer) return toast.error("Commission > 1 mois");

    const total = caution + avance + commission;
    const cand = candidatures.find(c => c.id === fForm.candidature_id);
    const { error } = await supabase.from("factures_entree").insert({
      candidature_id: fForm.candidature_id || null,
      prospect_id: cand?.prospect_id || null,
      bien_id: fForm.bien_id,
      loyer_mensuel: loyer, caution, avance_loyer: avance, commission_agence: commission,
      total, statut: "emise",
    } as any);
    if (error) return toast.error(error.message);
    toast.success("Facture d'entrée émise"); setOpenFact(false);
    setFForm({ candidature_id: "", bien_id: "", loyer_mensuel: "", caution: "", avance_loyer: "", commission_agence: "" });
    load();
  };

  const totalFact = Number(fForm.caution || 0) + Number(fForm.avance_loyer || 0) + Number(fForm.commission_agence || 0);

  // KPIs Kanban
  const byStatut = (s: string) => prospects.filter(p => p.statut === s);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Service Commercial</h1>
        <p className="text-muted-foreground">Pipeline prospects · visites · candidatures · facture d'entrée</p>
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="visites">Visites</TabsTrigger>
          <TabsTrigger value="candidatures">Candidatures</TabsTrigger>
          <TabsTrigger value="factures">Factures d'entrée</TabsTrigger>
        </TabsList>

        {/* PIPELINE */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex justify-between">
            <p className="text-sm text-muted-foreground">{prospects.length} prospects</p>
            <Dialog open={openProspect} onOpenChange={setOpenProspect}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouveau prospect</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau prospect</DialogTitle></DialogHeader>
                <form onSubmit={submitProspect} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Nom *</Label><Input required value={pForm.nom} onChange={e => setPForm({ ...pForm, nom: e.target.value })} /></div>
                    <div><Label>Prénom</Label><Input value={pForm.prenom} onChange={e => setPForm({ ...pForm, prenom: e.target.value })} /></div>
                    <div><Label>Téléphone</Label><Input value={pForm.telephone} onChange={e => setPForm({ ...pForm, telephone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={pForm.email} onChange={e => setPForm({ ...pForm, email: e.target.value })} /></div>
                    <div><Label>Budget max (FCFA)</Label><Input type="number" value={pForm.budget_max} onChange={e => setPForm({ ...pForm, budget_max: e.target.value })} /></div>
                    <div><Label>Type recherché</Label><Input placeholder="ex: 3 pièces" value={pForm.type_recherche} onChange={e => setPForm({ ...pForm, type_recherche: e.target.value })} /></div>
                    <div><Label>Commune</Label><Input value={pForm.commune_recherche} onChange={e => setPForm({ ...pForm, commune_recherche: e.target.value })} /></div>
                    <div><Label>Source</Label><Input placeholder="ex: WhatsApp" value={pForm.source} onChange={e => setPForm({ ...pForm, source: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button type="submit">Créer</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {PROSPECT_STATUTS.map(s => (
              <Card key={s.v}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex justify-between">
                    <span>{s.label}</span>
                    <Badge variant="outline">{byStatut(s.v).length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                  {byStatut(s.v).map(p => (
                    <div key={p.id} className="border rounded-md p-2 text-sm space-y-1">
                      <div className="font-medium">{p.nom} {p.prenom}</div>
                      <div className="text-xs text-muted-foreground">{p.telephone}</div>
                      {p.budget_max && <div className="text-xs">Budget: {fmtFCFA(p.budget_max)}</div>}
                      <Select value={p.statut} onValueChange={(val) => updateProspectStatut(p.id, val)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROSPECT_STATUTS.map(x => <SelectItem key={x.v} value={x.v}>{x.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {byStatut(s.v).length === 0 && <div className="text-xs text-muted-foreground italic">—</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* VISITES */}
        <TabsContent value="visites" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openVisite} onOpenChange={setOpenVisite}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Planifier visite</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Planifier une visite</DialogTitle></DialogHeader>
                <form onSubmit={submitVisite} className="space-y-3">
                  <div><Label>Prospect *</Label>
                    <Select value={vForm.prospect_id} onValueChange={(v) => setVForm({ ...vForm, prospect_id: v })} required>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{prospects.map(p => <SelectItem key={p.id} value={p.id}>{p.nom} {p.prenom}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Bien *</Label>
                    <Select value={vForm.bien_id} onValueChange={(v) => setVForm({ ...vForm, bien_id: v })} required>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{biens.map(b => <SelectItem key={b.id} value={b.id}>{b.reference} — {b.quartier}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date / heure *</Label><Input type="datetime-local" required value={vForm.date_visite} onChange={e => setVForm({ ...vForm, date_visite: e.target.value })} /></div>
                  <div><Label>Commentaire</Label><Textarea value={vForm.commentaire} onChange={e => setVForm({ ...vForm, commentaire: e.target.value })} /></div>
                  <DialogFooter><Button type="submit">Planifier</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Prospect</TableHead><TableHead>Bien</TableHead><TableHead>Statut</TableHead><TableHead>Commentaire</TableHead></TableRow></TableHeader>
              <TableBody>
                {visites.map(v => (
                  <TableRow key={v.id}>
                    <TableCell>{fmtDate(v.date_visite)}</TableCell>
                    <TableCell>{v.prospects?.nom} {v.prospects?.prenom}</TableCell>
                    <TableCell>{v.biens?.reference} — {v.biens?.quartier}</TableCell>
                    <TableCell><Badge variant="outline">{v.statut}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.commentaire || "—"}</TableCell>
                  </TableRow>
                ))}
                {visites.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucune visite</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* CANDIDATURES */}
        <TabsContent value="candidatures" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openCand} onOpenChange={setOpenCand}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouvelle candidature</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Dossier de candidature</DialogTitle></DialogHeader>
                <form onSubmit={submitCandidature} className="space-y-3">
                  <div><Label>Prospect *</Label>
                    <Select value={cForm.prospect_id} onValueChange={(v) => setCForm({ ...cForm, prospect_id: v })} required>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{prospects.map(p => <SelectItem key={p.id} value={p.id}>{p.nom} {p.prenom}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Bien *</Label>
                    <Select value={cForm.bien_id} onValueChange={(v) => setCForm({ ...cForm, bien_id: v })} required>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{biens.filter(b => b.statut === "vacant").map(b => <SelectItem key={b.id} value={b.id}>{b.reference} — {b.quartier} — {fmtFCFA(b.loyer_mensuel)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Revenus mensuels</Label><Input type="number" value={cForm.revenus_mensuels} onChange={e => setCForm({ ...cForm, revenus_mensuels: e.target.value })} /></div>
                    <div><Label>Employeur</Label><Input value={cForm.employeur} onChange={e => setCForm({ ...cForm, employeur: e.target.value })} /></div>
                    <div><Label>Garant (nom)</Label><Input value={cForm.garant_nom} onChange={e => setCForm({ ...cForm, garant_nom: e.target.value })} /></div>
                    <div><Label>Garant (téléphone)</Label><Input value={cForm.garant_telephone} onChange={e => setCForm({ ...cForm, garant_telephone: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button type="submit">Enregistrer</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Prospect</TableHead><TableHead>Bien</TableHead><TableHead>Revenus</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {candidatures.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{c.prospects?.nom} {c.prospects?.prenom}</TableCell>
                    <TableCell>{c.biens?.reference} — {c.biens?.quartier}</TableCell>
                    <TableCell>{fmtFCFA(c.revenus_mensuels)}</TableCell>
                    <TableCell><Badge variant={statutColor(c.statut) as any}>{c.statut}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      {c.statut === "en_etude" && (<>
                        <Button size="sm" variant="outline" onClick={() => decideCandidature(c.id, false)}>Refuser</Button>
                        <Button size="sm" onClick={() => decideCandidature(c.id, true)}>Accepter</Button>
                      </>)}
                      {c.statut === "acceptee" && (
                        <Button size="sm" onClick={() => openFactureFromCand(c)}><FileText className="h-4 w-4 mr-1" />Émettre facture</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {candidatures.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucune candidature</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* FACTURES */}
        <TabsContent value="factures" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openFact} onOpenChange={setOpenFact}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouvelle facture</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Facture d'entrée</DialogTitle></DialogHeader>
                <Alert className="mb-2"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-xs">
                  Loi 2018-575 : caution ≤ 2 mois, avance ≤ 2 mois. Commission agence ≤ 1 mois. Total max : 5 mois.
                </AlertDescription></Alert>
                <form onSubmit={submitFacture} className="space-y-3">
                  <div><Label>Bien *</Label>
                    <Select value={fForm.bien_id} onValueChange={onBienFactChange} required>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{biens.map(b => <SelectItem key={b.id} value={b.id}>{b.reference} — {b.quartier}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Loyer mensuel *</Label><Input type="number" required value={fForm.loyer_mensuel} onChange={e => setFForm({ ...fForm, loyer_mensuel: e.target.value })} /></div>
                    <div><Label>Caution (≤ 2 mois)</Label><Input type="number" value={fForm.caution} onChange={e => setFForm({ ...fForm, caution: e.target.value })} /></div>
                    <div><Label>Avance loyer (≤ 2 mois)</Label><Input type="number" value={fForm.avance_loyer} onChange={e => setFForm({ ...fForm, avance_loyer: e.target.value })} /></div>
                    <div><Label>Commission agence (≤ 1 mois)</Label><Input type="number" value={fForm.commission_agence} onChange={e => setFForm({ ...fForm, commission_agence: e.target.value })} /></div>
                  </div>
                  <div className="bg-muted rounded-md p-3 flex justify-between font-medium">
                    <span>Total facture</span><span>{fmtFCFA(totalFact)}</span>
                  </div>
                  <DialogFooter><Button type="submit">Émettre</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>N°</TableHead><TableHead>Date</TableHead><TableHead>Bien</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">PDF</TableHead></TableRow></TableHeader>
              <TableBody>
                {factures.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-xs">{f.numero}</TableCell>
                    <TableCell>{fmtDate(f.date_emission)}</TableCell>
                    <TableCell>{f.biens?.reference} — {f.biens?.quartier}</TableCell>
                    <TableCell className="text-right font-medium">{fmtFCFA(f.total)}</TableCell>
                    <TableCell><Badge variant={f.statut === "payee" ? "default" : "outline"}>{f.statut}</Badge></TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => downloadFactureEntreePDF(f)}><Download className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {factures.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucune facture</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
