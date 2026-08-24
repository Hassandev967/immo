import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtFCFA } from "@/lib/format";
import { Plus } from "lucide-react";

export default function Biens() {
  const { user } = useAuth();
  const [biens, setBiens] = useState<any[]>([]);
  const [proprios, setProprios] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "appartement", commune: "", quartier: "", loyer_mensuel: "", proprietaire_id: "", pieces: "" });

  const load = async () => {
    const [{ data: b }, { data: p }] = await Promise.all([
      supabase.from("biens").select("*, proprietaires!biens_proprietaire_fk(nom)").order("created_at", { ascending: false }),
      supabase.from("proprietaires").select("id, nom"),
    ]);
    setBiens(b ?? []); setProprios(p ?? []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.proprietaire_id) { toast.error("Sélectionnez un propriétaire"); return; }
    const { data: created, error } = await supabase.from("biens").insert({
      type: form.type, commune: form.commune, quartier: form.quartier,
      loyer_mensuel: Number(form.loyer_mensuel),
      proprietaire_id: form.proprietaire_id,
      pieces: form.pieces ? Number(form.pieces) : null,
      created_by: user?.id ?? null, // ← isolation commercial
    }).select("reference").single();
    if (error) { toast.error(error.message); return; }
    toast.success(`Bien ${created?.reference ?? ""} ajouté`); setOpen(false); load();
    setForm({ type: "appartement", commune: "", quartier: "", loyer_mensuel: "", proprietaire_id: "", pieces: "" });
  };

  const statutBadge = (s: string) => {
    const map: any = {
      occupe: ["Occupé", "default", "bg-green-600 text-white"],
      vacant: ["Vacant", "secondary", ""],
      travaux: ["Travaux", "default", "bg-yellow-500 text-white"],
    };
    const [label, variant, cls] = map[s] ?? [s, "secondary", ""];
    return <Badge variant={variant} className={cls}>{label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Parc immobilier</h1><p className="text-muted-foreground text-sm">Référentiel des biens en gestion</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouveau bien</Button></DialogTrigger>
          <DialogContent>
            <form onSubmit={submit}>
              <DialogHeader><DialogTitle>Ajouter un bien</DialogTitle></DialogHeader>
              <div className="space-y-3 py-3">
                {proprios.length === 0 && <div className="text-sm text-yellow-600">Créez d'abord un propriétaire dans l'onglet Propriétaires.</div>}
                <div className="text-xs text-muted-foreground">La référence sera générée automatiquement (BIEN-AAAA-XXXX).</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Type</Label>
                    <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="studio">Studio</SelectItem>
                        <SelectItem value="appartement">Appartement</SelectItem>
                        <SelectItem value="villa">Villa</SelectItem>
                        <SelectItem value="local_commercial">Local commercial</SelectItem>
                        <SelectItem value="bureau">Bureau</SelectItem>
                        <SelectItem value="terrain">Terrain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Commune</Label><Input value={form.commune} onChange={e => setForm({ ...form, commune: e.target.value })} placeholder="Cocody" /></div>
                  <div><Label>Quartier</Label><Input value={form.quartier} onChange={e => setForm({ ...form, quartier: e.target.value })} /></div>
                  <div><Label>Pièces</Label><Input type="number" value={form.pieces} onChange={e => setForm({ ...form, pieces: e.target.value })} /></div>
                  <div className="col-span-2"><Label>Loyer mensuel (FCFA)</Label><Input type="number" value={form.loyer_mensuel} onChange={e => setForm({ ...form, loyer_mensuel: e.target.value })} required /></div>
                </div>
                <div><Label>Propriétaire</Label>
                  <Select value={form.proprietaire_id} onValueChange={v => setForm({ ...form, proprietaire_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent>{proprios.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button type="submit">Enregistrer</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardHeader><CardTitle>Biens ({biens.length})</CardTitle></CardHeader><CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Référence</TableHead><TableHead>Type</TableHead><TableHead>Localisation</TableHead>
            <TableHead>Propriétaire</TableHead><TableHead className="text-right">Loyer</TableHead><TableHead>Statut</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {biens.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun bien enregistré</TableCell></TableRow>}
            {biens.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.reference}</TableCell>
                <TableCell className="capitalize">{b.type}{b.pieces ? ` · ${b.pieces}p` : ""}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{[b.quartier, b.commune].filter(Boolean).join(", ") || "—"}</TableCell>
                <TableCell>{(b.proprietaires as any)?.nom ?? "—"}</TableCell>
                <TableCell className="text-right">{fmtFCFA(b.loyer_mensuel)}</TableCell>
                <TableCell>{statutBadge(b.statut)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}