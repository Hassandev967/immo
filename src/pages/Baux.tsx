import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { fmtFCFA, fmtDate } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, AlertCircle } from "lucide-react";

export default function Baux() {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [biens, setBiens] = useState<any[]>([]);
  const [locataires, setLocataires] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bien_id: "", locataire_id: "", date_entree: "", loyer_mensuel: "", caution: "", avance_loyer: "", commission_agence: "", jour_echeance: "5" });

  const load = async () => {
    const [{ data: b }, { data: bi }, { data: lo }] = await Promise.all([
      supabase.from("baux")
        .select("*, biens!baux_bien_fk(reference, quartier, loyer_mensuel), locataires!baux_locataire_id_fkey(nom, prenom)")
        .order("created_at", { ascending: false }),
      supabase.from("biens").select("id, reference, quartier, loyer_mensuel, statut").eq("statut", "vacant"),
      supabase.from("locataires").select("id, nom, prenom"),
    ]);
    setList(b ?? []); setBiens(bi ?? []); setLocataires(lo ?? []);
  };
  useEffect(() => { load(); }, []);

  const onBienChange = (id: string) => {
    const bien = biens.find(b => b.id === id);
    if (bien) setForm(f => ({ ...f, bien_id: id, loyer_mensuel: String(bien.loyer_mensuel) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const loyer = Number(form.loyer_mensuel);
    const caution = Number(form.caution);
    const avance = Number(form.avance_loyer);
    const commission = Number(form.commission_agence || 0);
    if (caution > loyer * 2) { toast.error("Caution > 2 mois (Loi 2018-575 art. 22)"); return; }
    if (avance > loyer * 2) { toast.error("Avance loyer > 2 mois"); return; }
    if (commission > loyer) { toast.error("Commission d'agence > 1 mois de loyer"); return; }

    const { data: created, error } = await supabase.from("baux").insert({
      bien_id: form.bien_id, locataire_id: form.locataire_id,
      date_entree: form.date_entree, loyer_mensuel: loyer, caution, avance_loyer: avance,
      commission_agence: commission,
      jour_echeance: Number(form.jour_echeance),
      created_by: user?.id ?? null,
    }).select("reference").single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("biens").update({ statut: "occupe" }).eq("id", form.bien_id);
    toast.success(`Bail ${created?.reference ?? ""} créé`); setOpen(false); load();
    setForm({ bien_id: "", locataire_id: "", date_entree: "", loyer_mensuel: "", caution: "", avance_loyer: "", commission_agence: "", jour_echeance: "5" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bail</h1>
          <p className="text-muted-foreground text-sm">Contrats de location actifs et historique</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouveau bail</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <form onSubmit={submit}>
              <DialogHeader><DialogTitle>Créer un bail</DialogTitle></DialogHeader>
              <Alert className="my-3"><AlertCircle className="h-4 w-4" /><AlertDescription className="text-xs">Loi 2018-575 art. 22 : caution ≤ 2 mois, avance ≤ 2 mois. Commission d'agence ≤ 1 mois (pratique de l'agence).</AlertDescription></Alert>
              <div className="space-y-3 py-2">
                <div className="text-xs text-muted-foreground">La référence du bail sera générée automatiquement (BAIL-AAAA-XXXX).</div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Bien (vacants)</Label>
                    <Select value={form.bien_id} onValueChange={onBienChange}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                      <SelectContent>
                        {biens.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun bien vacant</div>}
                        {biens.map(b => <SelectItem key={b.id} value={b.id}>{b.reference} · {b.quartier}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Locataire</Label>
                    <Select value={form.locataire_id} onValueChange={v => setForm({ ...form, locataire_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                      <SelectContent>
                        {locataires.length === 0 && <div className="p-2 text-xs text-muted-foreground">Aucun locataire</div>}
                        {locataires.map(l => <SelectItem key={l.id} value={l.id}>{l.prenom} {l.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date d'entrée</Label><Input type="date" value={form.date_entree} onChange={e => setForm({ ...form, date_entree: e.target.value })} required /></div>
                  <div><Label>Jour d'échéance (1-28)</Label><Input type="number" min="1" max="28" value={form.jour_echeance} onChange={e => setForm({ ...form, jour_echeance: e.target.value })} required /></div>
                  <div><Label>Loyer (FCFA)</Label><Input type="number" value={form.loyer_mensuel} onChange={e => setForm({ ...form, loyer_mensuel: e.target.value })} required /></div>
                  <div><Label>Caution (max 2× loyer)</Label><Input type="number" value={form.caution} onChange={e => setForm({ ...form, caution: e.target.value })} required /></div>
                  <div><Label>Avance loyer (max 2× loyer)</Label><Input type="number" value={form.avance_loyer} onChange={e => setForm({ ...form, avance_loyer: e.target.value })} required /></div>
                  <div><Label>Commission agence (max 1× loyer)</Label><Input type="number" value={form.commission_agence} onChange={e => setForm({ ...form, commission_agence: e.target.value })} /></div>
                </div>
                {form.loyer_mensuel && (
                  <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span>Caution</span><span>{fmtFCFA(Number(form.caution || 0) * Number(form.loyer_mensuel))}</span></div>
                    <div className="flex justify-between"><span>Avance loyer</span><span>{fmtFCFA(Number(form.avance_loyer || 0) * Number(form.loyer_mensuel))}</span></div>
                    <div className="flex justify-between"><span>Commission agence</span><span>{fmtFCFA(Number(form.commission_agence || 0))}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                      <span>Total frais d'entrée</span>
                      <span>{fmtFCFA(Number(form.caution || 0) * Number(form.loyer_mensuel) + Number(form.avance_loyer || 0) * Number(form.loyer_mensuel) + Number(form.commission_agence || 0))}</span>
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter><Button type="submit" disabled={!form.bien_id || !form.locataire_id}>Créer le bail</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardHeader><CardTitle>Bail ({list.length})</CardTitle></CardHeader><CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Référence</TableHead><TableHead>Locataire</TableHead><TableHead>Bien</TableHead>
            <TableHead>Entrée</TableHead><TableHead className="text-center">Échéance</TableHead>
            <TableHead className="text-right">Loyer</TableHead><TableHead>Statut</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun bail</TableCell></TableRow>}
            {list.map(b => (
              <TableRow key={b.id}>
                <TableCell className="font-mono text-xs">{b.reference}</TableCell>
                <TableCell>{b.locataires?.prenom} {b.locataires?.nom}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{b.biens?.reference} · {b.biens?.quartier}</TableCell>
                <TableCell>{fmtDate(b.date_entree)}</TableCell>
                <TableCell className="text-center">le {b.jour_echeance}</TableCell>
                <TableCell className="text-right">{fmtFCFA(b.loyer_mensuel)}</TableCell>
                <TableCell>
                  <Badge variant={b.statut === "actif" ? "default" : "secondary"}
                    className={b.statut === "actif" ? "bg-green-600 text-white" : ""}>
                    {b.statut}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}