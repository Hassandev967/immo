import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileUp } from "lucide-react";
import { CATEGORIE_LABEL } from "@/lib/courriers";

const empty = { id: "", nom: "", categorie: "autre", objet: "", contenu_html: "", variables: "" };

export default function ModelesCourrier() {
  const [modeles, setModeles] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const { data } = await supabase.from("modeles_courrier").select("*").order("nom");
    setModeles(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (m: any) => { setForm({ ...m, variables: (m.variables ?? []).join(", ") }); setOpen(true); };

  const save = async () => {
    if (!form.nom || !form.contenu_html) return toast.error("Nom et contenu requis");
    const vars = form.variables.split(",").map((s: string) => s.trim()).filter(Boolean);
    const detected = Array.from(new Set([...vars, ...Array.from(form.contenu_html.matchAll(/\{\{\s*(\w+)\s*\}\}/g)).map((m: any) => m[1])]));
    const payload = { nom: form.nom, categorie: form.categorie, objet: form.objet, contenu_html: form.contenu_html, variables: detected, actif: true };
    const { error } = form.id
      ? await supabase.from("modeles_courrier").update(payload as any).eq("id", form.id)
      : await supabase.from("modeles_courrier").insert([payload as any]);
    if (error) toast.error(error.message); else { toast.success("Enregistré"); setOpen(false); load(); }
  };

  const remove = async (id: string, systeme: boolean) => {
    if (systeme) return toast.error("Modèle système — désactivez-le plutôt");
    if (!confirm("Supprimer ce modèle ?")) return;
    const { error } = await supabase.from("modeles_courrier").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Supprimé"); load(); }
  };

  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    setForm({ ...empty, nom: f.name.replace(/\.[^.]+$/, ""), contenu_html: f.name.endsWith(".html") ? text : `<p>${text.replace(/\n/g, "</p><p>")}</p>` });
    setOpen(true);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold">Modèles de courriers</h1>
          <p className="text-muted-foreground">Variables disponibles : <code className="text-xs">{"{{nom}}"}</code>, <code className="text-xs">{"{{montant_du}}"}</code>, etc.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><label className="cursor-pointer"><FileUp className="h-4 w-4 mr-2" />Importer<input type="file" className="hidden" accept=".html,.txt,.docx" onChange={importFile} /></label></Button>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nouveau modèle</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Catégorie</TableHead><TableHead>Variables</TableHead><TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {modeles.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.nom}{m.systeme && <Badge variant="outline" className="ml-2 text-[10px]">système</Badge>}</TableCell>
                  <TableCell><Badge variant="outline">{CATEGORIE_LABEL[m.categorie] ?? m.categorie}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{(m.variables ?? []).slice(0, 4).join(", ")}{m.variables?.length > 4 ? "…" : ""}</TableCell>
                  <TableCell>{m.actif ? <Badge className="bg-green-600">Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(m.id, m.systeme)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "Modifier" : "Nouveau"} modèle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nom *</Label><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></div>
              <div>
                <Label>Catégorie</Label>
                <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Objet</Label><Input value={form.objet} onChange={(e) => setForm({ ...form, objet: e.target.value })} /></div>
            <div><Label>Contenu HTML * <span className="text-xs text-muted-foreground">(supporte {"<p>, <strong>, <br/>"} et variables {"{{xxx}}"})</span></Label>
              <Textarea rows={14} className="font-mono text-xs" value={form.contenu_html} onChange={(e) => setForm({ ...form, contenu_html: e.target.value })} /></div>
            <div><Label>Variables additionnelles (séparées par virgule)</Label>
              <Input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} placeholder="nom, montant, date…" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
