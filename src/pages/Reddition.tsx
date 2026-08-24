import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { fmtFCFA, fmtDate } from "@/lib/format";
import { Calculator, CheckCircle2, Download } from "lucide-react";
import { downloadRedditionPDF } from "@/lib/pdf";

export default function Reddition() {
  const [mois, setMois] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [proprietaires, setProprietaires] = useState<any[]>([]);
  const [biens, setBiens] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [reversements, setReversements] = useState<any[]>([]);
  const [openPay, setOpenPay] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({ date_paiement: "", mode_paiement: "virement", reference_externe: "" });

  const moisDate = mois + "-01";

  const load = async () => {
    const [{ data: pr }, { data: bi }, { data: pa }, { data: rv }] = await Promise.all([
      supabase.from("proprietaires").select("*").order("nom"),
      supabase.from("biens").select("id, proprietaire_id, charges, reference, quartier"),
      supabase.from("paiements").select("montant, bail_id, mois_concerne, baux(bien_id, biens(proprietaire_id))").gte("mois_concerne", moisDate).lt("mois_concerne", nextMonth(moisDate)),
      supabase.from("reversements").select("*").eq("mois_concerne", moisDate),
    ]);
    setProprietaires(pr ?? []); setBiens(bi ?? []); setPaiements(pa ?? []); setReversements(rv ?? []);
  };
  useEffect(() => { load(); }, [mois]);

  function nextMonth(dateStr: string) {
    const d = new Date(dateStr); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }

  const reddition = useMemo(() => {
    return proprietaires.map(p => {
      const biensPropr = biens.filter(b => b.proprietaire_id === p.id);
      const bienIds = new Set(biensPropr.map(b => b.id));
      const encaisse = paiements
        .filter((pa: any) => pa.baux?.biens?.proprietaire_id === p.id)
        .reduce((s, pa: any) => s + Number(pa.montant), 0);
      const charges = biensPropr.reduce((s, b) => s + Number(b.charges || 0), 0);
      const taux = Number(p.taux_honoraires || 0);
      const honoraires = Math.round((encaisse * taux) / 100);
      const net = encaisse - honoraires - charges;
      const rev = reversements.find(r => r.proprietaire_id === p.id);
      return { proprietaire: p, encaisse, honoraires, charges, net, taux, rev, nbBiens: biensPropr.length };
    });
  }, [proprietaires, biens, paiements, reversements]);

  const totaux = useMemo(() => reddition.reduce((acc, r) => ({
    encaisse: acc.encaisse + r.encaisse,
    honoraires: acc.honoraires + r.honoraires,
    charges: acc.charges + r.charges,
    net: acc.net + r.net,
  }), { encaisse: 0, honoraires: 0, charges: 0, net: 0 }), [reddition]);

  const generer = async (r: any) => {
    if (r.rev) return toast.info("Reddition déjà générée");
    const { error } = await supabase.from("reversements").insert({
      proprietaire_id: r.proprietaire.id,
      mois_concerne: moisDate,
      total_encaisse: r.encaisse, honoraires: r.honoraires, charges_deduites: r.charges,
      net_a_reverser: r.net, statut: "a_payer",
    });
    if (error) return toast.error(error.message);
    toast.success("Reddition générée"); load();
  };

  const marquerPaye = async (e: React.FormEvent, revId: string) => {
    e.preventDefault();
    const { error } = await supabase.from("reversements").update({
      statut: "paye",
      date_paiement: payForm.date_paiement,
      mode_paiement: payForm.mode_paiement,
      reference_externe: payForm.reference_externe || null,
    }).eq("id", revId);
    if (error) return toast.error(error.message);
    toast.success("Reversement enregistré"); setOpenPay(null);
    setPayForm({ date_paiement: "", mode_paiement: "virement", reference_externe: "" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reddition propriétaires</h1>
          <p className="text-muted-foreground">Encaissé · honoraires · charges · net à reverser</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label>Mois</Label><Input type="month" value={mois} onChange={e => setMois(e.target.value)} /></div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total encaissé</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmtFCFA(totaux.encaisse)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Honoraires</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmtFCFA(totaux.honoraires)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Charges</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{fmtFCFA(totaux.charges)}</div></CardContent></Card>
        <Card className="border-primary"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Net à reverser</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-primary">{fmtFCFA(totaux.net)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Propriétaire</TableHead>
              <TableHead className="text-center">Biens</TableHead>
              <TableHead className="text-right">Encaissé</TableHead>
              <TableHead className="text-center">Taux</TableHead>
              <TableHead className="text-right">Honoraires</TableHead>
              <TableHead className="text-right">Charges</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {reddition.map(r => (
                <TableRow key={r.proprietaire.id}>
                  <TableCell className="font-medium">{r.proprietaire.nom}</TableCell>
                  <TableCell className="text-center">{r.nbBiens}</TableCell>
                  <TableCell className="text-right">{fmtFCFA(r.encaisse)}</TableCell>
                  <TableCell className="text-center">{r.taux}%</TableCell>
                  <TableCell className="text-right text-muted-foreground">- {fmtFCFA(r.honoraires)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">- {fmtFCFA(r.charges)}</TableCell>
                  <TableCell className="text-right font-bold">{fmtFCFA(r.net)}</TableCell>
                  <TableCell>
                    {r.rev ? <Badge variant={r.rev.statut === "paye" ? "default" : "outline"}>{r.rev.statut === "paye" ? "Payé" : "À payer"}</Badge>
                           : <Badge variant="secondary">Non générée</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {!r.rev && r.encaisse > 0 && (
                      <Button size="sm" variant="outline" onClick={() => generer(r)}><Calculator className="h-4 w-4 mr-1" />Générer</Button>
                    )}
                    {r.rev && r.rev.statut === "a_payer" && (
                      <Dialog open={openPay === r.rev.id} onOpenChange={(o) => setOpenPay(o ? r.rev.id : null)}>
                        <DialogTrigger asChild><Button size="sm"><CheckCircle2 className="h-4 w-4 mr-1" />Marquer payé</Button></DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Reverser {fmtFCFA(r.net)} à {r.proprietaire.nom}</DialogTitle></DialogHeader>
                          <form onSubmit={(e) => marquerPaye(e, r.rev.id)} className="space-y-3">
                            <div><Label>Date paiement *</Label><Input type="date" required value={payForm.date_paiement} onChange={e => setPayForm({ ...payForm, date_paiement: e.target.value })} /></div>
                            <div><Label>Mode</Label>
                              <Select value={payForm.mode_paiement} onValueChange={(v) => setPayForm({ ...payForm, mode_paiement: v })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="virement">Virement</SelectItem>
                                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                                  <SelectItem value="especes">Espèces</SelectItem>
                                  <SelectItem value="cheque">Chèque</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div><Label>Référence</Label><Input value={payForm.reference_externe} onChange={e => setPayForm({ ...payForm, reference_externe: e.target.value })} /></div>
                            <DialogFooter><Button type="submit">Confirmer</Button></DialogFooter>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                    {r.rev?.statut === "paye" && <span className="text-xs text-muted-foreground mr-2">{fmtDate(r.rev.date_paiement)}</span>}
                    {r.rev && <Button size="sm" variant="ghost" onClick={() => downloadRedditionPDF(r, moisDate)}><Download className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
              {reddition.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Aucun propriétaire</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
