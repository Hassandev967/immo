import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Plus, Edit, Trash2, MessageSquare, Info } from "lucide-react";

const CANAUX = [
  { v: "whatsapp", label: "WhatsApp" },
  { v: "sms", label: "SMS" },
];

const empty = { nom: "", canal: "whatsapp", jour_declenchement: "5", contenu: "", actif: true };

export default function ModelesRelance() {
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const { data } = await supabase.from("modeles_relance").select("*").order("ordre").order("jour_declenchement");
    setList(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (m: any) => {
    setEdit(m);
    setForm({ nom: m.nom, canal: m.canal, jour_declenchement: String(m.jour_declenchement), contenu: m.contenu, actif: m.actif });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nom: form.nom, canal: form.canal, jour_declenchement: Number(form.jour_declenchement),
      contenu: form.contenu, actif: form.actif,
    };
    const { error } = edit
      ? await supabase.from("modeles_relance").update(payload).eq("id", edit.id)
      : await supabase.from("modeles_relance").insert(payload);
    if (error) return toast.error(error.message);
    toast.success(edit ? "Modèle mis à jour" : "Modèle créé"); setOpen(false); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce modèle ?")) return;
    const { error } = await supabase.from("modeles_relance").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Modèles de relance</h1>
          <p className="text-muted-foreground">Messages réutilisables pour les relances locataires</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nouveau modèle</Button>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-sm">
          Variables disponibles : <code>{"{{nom}}"}</code> · <code>{"{{montant}}"}</code> · <code>{"{{mois}}"}</code> · <code>{"{{bien}}"}</code>
        </AlertDescription>
      </Alert>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nom</TableHead><TableHead>Canal</TableHead><TableHead>Déclenchement</TableHead>
            <TableHead>Aperçu</TableHead><TableHead>Actif</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.nom}</TableCell>
                <TableCell><Badge variant="outline">{m.canal}</Badge></TableCell>
                <TableCell>J+{m.jour_declenchement}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md truncate">{m.contenu}</TableCell>
                <TableCell>{m.actif ? <Badge>Actif</Badge> : <Badge variant="secondary">Inactif</Badge>}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Edit className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucun modèle</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{edit ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><Label>Nom *</Label><Input required value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} /></div>
              <div><Label>Jour (J+)</Label><Input type="number" value={form.jour_declenchement} onChange={e => setForm({ ...form, jour_declenchement: e.target.value })} /></div>
            </div>
            <div><Label>Canal *</Label>
              <Select value={form.canal} onValueChange={(v) => setForm({ ...form, canal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CANAUX.map(c => <SelectItem key={c.v} value={c.v}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Contenu * <span className="text-xs text-muted-foreground">(variables {"{{nom}} {{montant}} {{mois}} {{bien}}"})</span></Label>
              <Textarea required rows={6} value={form.contenu} onChange={e => setForm({ ...form, contenu: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.actif} onCheckedChange={(v) => setForm({ ...form, actif: v })} />
              Modèle actif
            </label>
            <DialogFooter><Button type="submit">{edit ? "Mettre à jour" : "Créer"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
