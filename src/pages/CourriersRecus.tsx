import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Inbox, Reply, Eye } from "lucide-react";
import { Link } from "react-router-dom";

const CATEGORIES = [
  { value: "preavis_depart", label: "Préavis de départ" },
  { value: "reclamation", label: "Réclamation" },
  { value: "demande_travaux", label: "Demande de travaux" },
  { value: "demande_information", label: "Demande d'information" },
  { value: "contestation", label: "Contestation" },
  { value: "autre", label: "Autre" },
];

const STATUTS = [
  { value: "recu", label: "Reçu", variant: "secondary" as const },
  { value: "en_traitement", label: "En traitement", variant: "default" as const },
  { value: "reponse_envoyee", label: "Réponse envoyée", variant: "default" as const },
  { value: "clos", label: "Clos", variant: "outline" as const },
];

const emptyForm = {
  bail_id: "", locataire_id: "", categorie: "reclamation",
  objet: "", contenu: "", date_reception: new Date().toISOString().slice(0, 10),
  date_effet: "", notes: "",
};

export default function CourriersRecus() {
  const [list, setList] = useState<any[]>([]);
  const [baux, setBaux] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<any>(null);
  const [view, setView] = useState<any>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    const { data } = await supabase
      .from("courriers_recus")
      .select("*, locataires(nom, prenom, telephone, email), baux(reference, biens(reference, adresse))")
      .order("date_reception", { ascending: false });
    setList(data ?? []);
  };

  const loadBaux = async () => {
    const { data } = await supabase
      .from("baux")
      .select("id, reference, locataire_id, locataires(nom, prenom)")
      .eq("statut", "actif");
    setBaux(data ?? []);
  };

  useEffect(() => { load(); loadBaux(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bail = baux.find(b => b.id === form.bail_id);
    const payload: any = {
      bail_id: form.bail_id || null,
      locataire_id: bail?.locataire_id || form.locataire_id || null,
      categorie: form.categorie,
      objet: form.objet,
      contenu: form.contenu || null,
      date_reception: form.date_reception,
      date_effet: form.date_effet || null,
      notes: form.notes || null,
    };
    if (editing) {
      const { error } = await supabase.from("courriers_recus").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Courrier mis à jour");
    } else {
      const { error } = await supabase.from("courriers_recus").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Courrier enregistré");
    }
    setOpen(false); load();
  };

  const setStatut = async (id: string, statut: string) => {
    const { error } = await supabase.from("courriers_recus").update({ statut: statut as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour"); load();
  };

  const filtered = filter === "all" ? list : list.filter(c => c.categorie === filter);
  const stats = {
    nouveaux: list.filter(c => c.statut === "recu").length,
    preavis: list.filter(c => c.categorie === "preavis_depart" && c.statut !== "clos").length,
    en_cours: list.filter(c => c.statut === "en_traitement").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Inbox className="h-6 w-6" />Préavis & Réclamations</h1>
          <p className="text-sm text-muted-foreground">Courriers reçus des locataires — traités par le service juridique</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Enregistrer un courrier</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nouveaux</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.nouveaux}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Préavis en cours</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.preavis}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">En traitement</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{stats.en_cours}</CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Liste des courriers</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Catégorie</TableHead><TableHead>Objet</TableHead>
              <TableHead>Locataire</TableHead><TableHead>Bail</TableHead>
              <TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun courrier</TableCell></TableRow>}
              {filtered.map(c => {
                const cat = CATEGORIES.find(x => x.value === c.categorie);
                const st = STATUTS.find(x => x.value === c.statut);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs">{c.date_reception}</TableCell>
                    <TableCell><Badge variant="outline">{cat?.label}</Badge></TableCell>
                    <TableCell className="font-medium max-w-xs truncate">{c.objet}</TableCell>
                    <TableCell className="text-xs">{c.locataires ? `${c.locataires.prenom ?? ""} ${c.locataires.nom}`.trim() : "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{c.baux?.reference ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={c.statut} onValueChange={(v) => setStatut(c.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUTS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setView(c)}><Eye className="h-4 w-4" /></Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/reponses-courriers">
                          <Reply className="h-4 w-4 mr-1" />Traiter
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Création / édition */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <form onSubmit={submit}>
            <DialogHeader><DialogTitle>{editing ? "Modifier" : "Enregistrer"} un courrier reçu</DialogTitle></DialogHeader>
            <div className="space-y-3 py-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Catégorie *</Label>
                  <Select value={form.categorie} onValueChange={v => setForm({ ...form, categorie: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Bail concerné</Label>
                  <Select value={form.bail_id} onValueChange={v => setForm({ ...form, bail_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                    <SelectContent>
                      {baux.map(b => <SelectItem key={b.id} value={b.id}>{b.reference} — {b.locataires?.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Objet *</Label><Input value={form.objet} onChange={e => setForm({ ...form, objet: e.target.value })} required /></div>
              <div><Label>Contenu</Label><Textarea rows={4} value={form.contenu} onChange={e => setForm({ ...form, contenu: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date réception *</Label><Input type="date" value={form.date_reception} onChange={e => setForm({ ...form, date_reception: e.target.value })} required /></div>
                <div><Label>Date d'effet (préavis)</Label><Input type="date" value={form.date_effet} onChange={e => setForm({ ...form, date_effet: e.target.value })} /></div>
              </div>
              <div><Label>Notes internes</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button type="submit">Enregistrer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Aperçu */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{view?.objet}</DialogTitle></DialogHeader>
          {view && (
            <div className="space-y-3 text-sm">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{CATEGORIES.find(c => c.value === view.categorie)?.label}</Badge>
                <Badge>{STATUTS.find(s => s.value === view.statut)?.label}</Badge>
                {view.date_effet && <Badge variant="secondary">Effet : {view.date_effet}</Badge>}
              </div>
              <div><span className="text-muted-foreground">Reçu le :</span> {view.date_reception}</div>
              <div><span className="text-muted-foreground">Locataire :</span> {view.locataires ? `${view.locataires.prenom ?? ""} ${view.locataires.nom}` : "—"}</div>
              <div><span className="text-muted-foreground">Bail :</span> {view.baux?.reference ?? "—"} {view.baux?.biens?.adresse && `· ${view.baux.biens.adresse}`}</div>
              {view.contenu && <div className="p-3 bg-muted rounded whitespace-pre-wrap">{view.contenu}</div>}
              {view.notes && <div className="text-muted-foreground italic">Notes : {view.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
