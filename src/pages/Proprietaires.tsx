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
import { Plus, Coins, Pencil, Building2, Link2, Unlink } from "lucide-react";
import { fmtFCFA } from "@/lib/format";
import { Link } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";

type Proprio = {
  id: string; nom: string; numero_gestion: string | null; type_personne: string;
  telephone: string | null; email: string | null; adresse: string | null;
  rib: string | null; taux_honoraires: number;
  biens?: { id: string; reference: string; statut: string; loyer_mensuel: number; commune: string | null }[];
};

const emptyForm = { nom: "", type_personne: "physique", telephone: "", email: "", adresse: "", rib: "", taux_honoraires: "10" };

export default function Proprietaires() {
  const { fieldPerm } = usePermissions();
  const { user } = useAuth();
  const showRib = fieldPerm("proprietaires", "rib").visible;
  const showHonoraires = fieldPerm("proprietaires", "taux_honoraires").visible;

  const [list, setList] = useState<Proprio[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Proprio | null>(null);
  const [form, setForm] = useState(emptyForm);

  const [detail, setDetail] = useState<Proprio | null>(null);
  const [biensLibres, setBiensLibres] = useState<any[]>([]);
  const [bienToLink, setBienToLink] = useState<string>("");

  const [bienOpen, setBienOpen] = useState(false);
  const [bienForm, setBienForm] = useState({ type: "appartement", commune: "", quartier: "", loyer_mensuel: "", pieces: "" });

  const load = async () => {
    const { data } = await supabase
      .from("proprietaires")
      .select("*, biens!biens_proprietaire_fk(id, reference, statut, loyer_mensuel, commune)")
      .order("created_at", { ascending: false });
    setList((data as any) ?? []);
    if (detail) {
      const refreshed = (data as any)?.find((p: any) => p.id === detail.id);
      if (refreshed) setDetail(refreshed);
    }
  };

  const loadBiensLibres = async () => {
    const { data } = await supabase
      .from("biens")
      .select("id, reference, commune, loyer_mensuel, proprietaire_id, proprietaires!biens_proprietaire_fk(nom)")
      .order("reference");
    setBiensLibres(data ?? []);
  };

  useEffect(() => { load(); loadBiensLibres(); }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p: Proprio) => {
    setEditing(p);
    setForm({
      nom: p.nom, type_personne: p.type_personne || "physique",
      telephone: p.telephone ?? "", email: p.email ?? "",
      adresse: p.adresse ?? "", rib: p.rib ?? "",
      taux_honoraires: String(p.taux_honoraires ?? 10),
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      created_by: user?.id ?? null,
      nom: form.nom, type_personne: form.type_personne,
      telephone: form.telephone || null, email: form.email || null,
      adresse: form.adresse || null, rib: form.rib || null,
      taux_honoraires: Number(form.taux_honoraires),
    };
    const { error } = editing
      ? await supabase.from("proprietaires").update(payload).eq("id", editing.id)
      : await supabase.from("proprietaires").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Propriétaire mis à jour" : "Propriétaire ajouté");
    setOpen(false); setEditing(null); setForm(emptyForm);
    load();
  };

  const linkBien = async () => {
    if (!detail || !bienToLink) return;
    const { error } = await supabase.from("biens").update({ proprietaire_id: detail.id }).eq("id", bienToLink);
    if (error) { toast.error(error.message); return; }
    toast.success("Bien rattaché"); setBienToLink("");
    await Promise.all([load(), loadBiensLibres()]);
  };

  const unlinkBien = async (_bienId: string) => {
    toast.error("Un bien doit toujours être rattaché à un propriétaire. Réassignez-le depuis le Parc immobilier.");
  };

  const submitBien = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const { data: created, error } = await supabase.from("biens").insert({
      type: bienForm.type,
      commune: bienForm.commune || null,
      quartier: bienForm.quartier || null,
      loyer_mensuel: Number(bienForm.loyer_mensuel),
      pieces: bienForm.pieces ? Number(bienForm.pieces) : null,
      proprietaire_id: detail.id,
    }).select("reference").single();
    if (error) { toast.error(error.message); return; }
    toast.success(`Bien ${created?.reference ?? ""} créé et rattaché`);
    setBienOpen(false);
    setBienForm({ type: "appartement", commune: "", quartier: "", loyer_mensuel: "", pieces: "" });
    await Promise.all([load(), loadBiensLibres()]);
  };

  const biensDispoPourLien = biensLibres.filter(b => b.proprietaire_id !== detail?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Propriétaires</h1>
          <p className="text-muted-foreground text-sm">Gérez les mandants et rattachez leurs biens</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nouveau propriétaire</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Propriétaires ({list.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>N° Gestion</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-center">Biens</TableHead>
              <TableHead className="text-right">Loyers occupés</TableHead>
              {showHonoraires && <TableHead className="text-right">Honoraires</TableHead>}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {list.length === 0 && (
                <TableRow><TableCell colSpan={showHonoraires ? 8 : 7} className="text-center text-muted-foreground py-8">Aucun propriétaire</TableCell></TableRow>
              )}
              {list.map(p => {
                const occupes = p.biens?.filter(b => b.statut === "occupe") ?? [];
                const totalLoyers = occupes.reduce((s, b) => s + Number(b.loyer_mensuel), 0);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.numero_gestion ?? "—"}</TableCell>
                    <TableCell className="font-medium">
                      <Link to={`/proprietaires/${p.id}`} className="text-primary hover:underline">{p.nom}</Link>
                    </TableCell>
                    <TableCell><Badge variant="outline">{p.type_personne}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {[p.telephone, p.email].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-center">{occupes.length}/{p.biens?.length ?? 0}</TableCell>
                    <TableCell className="text-right">{fmtFCFA(totalLoyers)}</TableCell>
                    {showHonoraires && <TableCell className="text-right text-muted-foreground">{p.taux_honoraires}%</TableCell>}
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => setDetail(p)}>
                        <Building2 className="h-4 w-4 mr-1" />Biens
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to="/reddition"><Coins className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Créer / Modifier propriétaire */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit}>
            <DialogHeader>
              <h2 className="text-lg font-bold">{editing ? "Modifier le propriétaire" : "Ajouter un propriétaire"}</h2>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Nom / Raison sociale *</Label>
                  <Input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} required />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type_personne} onValueChange={v => setForm({ ...form, type_personne: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physique">Physique</SelectItem>
                      <SelectItem value="morale">Morale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Téléphone</Label><Input value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} /></div>
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>Adresse</Label><Textarea rows={2} value={form.adresse} onChange={e => setForm({ ...form, adresse: e.target.value })} /></div>
              {(showRib || showHonoraires) && (
                <div className="grid grid-cols-2 gap-3">
                  {showRib && <div><Label>RIB / Coordonnées bancaires</Label><Input value={form.rib} onChange={e => setForm({ ...form, rib: e.target.value })} /></div>}
                  {showHonoraires && <div><Label>Taux honoraires (%) *</Label><Input type="number" step="0.01" value={form.taux_honoraires} onChange={e => setForm({ ...form, taux_honoraires: e.target.value })} required /></div>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit">{editing ? "Mettre à jour" : "Enregistrer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Détail biens du propriétaire */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <h2 className="text-lg font-bold">Biens de {detail?.nom}</h2>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="flex items-end gap-2 p-3 rounded-lg bg-muted/40">
                <div className="flex-1">
                  <Label className="text-xs">Rattacher un bien existant</Label>
                  <Select value={bienToLink} onValueChange={setBienToLink}>
                    <SelectTrigger><SelectValue placeholder="Choisir un bien..." /></SelectTrigger>
                    <SelectContent>
                      {biensDispoPourLien.length === 0 && (
                        <div className="px-2 py-1 text-sm text-muted-foreground">Aucun autre bien disponible</div>
                      )}
                      {biensDispoPourLien.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.reference} — {b.commune ?? "—"} ({fmtFCFA(b.loyer_mensuel)}) · actuel: {(b.proprietaires as any)?.nom ?? "—"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={linkBien} disabled={!bienToLink}><Link2 className="h-4 w-4 mr-1" />Rattacher</Button>
                <Button variant="outline" onClick={() => setBienOpen(true)}><Plus className="h-4 w-4 mr-1" />Nouveau bien</Button>
              </div>

              <Table>
                <TableHeader><TableRow>
                  <TableHead>Référence</TableHead>
                  <TableHead>Commune</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Loyer</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(detail.biens?.length ?? 0) === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucun bien rattaché</TableCell></TableRow>
                  )}
                  {detail.biens?.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.reference}</TableCell>
                      <TableCell>{b.commune ?? "—"}</TableCell>
                      <TableCell><Badge variant="outline">{b.statut}</Badge></TableCell>
                      <TableCell className="text-right">{fmtFCFA(b.loyer_mensuel)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => unlinkBien(b.id)}>
                          <Unlink className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Création rapide d'un bien lié */}
      <Dialog open={bienOpen} onOpenChange={setBienOpen}>
        <DialogContent>
          <form onSubmit={submitBien}>
            <DialogHeader>
              <h2 className="text-lg font-bold">Nouveau bien — {detail?.nom}</h2>
            </DialogHeader>
            <div className="space-y-3 py-3">
              <div className="text-xs text-muted-foreground">Référence générée automatiquement (BIEN-AAAA-XXXX).</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type *</Label>
                  <Select value={bienForm.type} onValueChange={v => setBienForm({ ...bienForm, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appartement">Appartement</SelectItem>
                      <SelectItem value="villa">Villa</SelectItem>
                      <SelectItem value="studio">Studio</SelectItem>
                      <SelectItem value="local_commercial">Local commercial</SelectItem>
                      <SelectItem value="bureau">Bureau</SelectItem>
                      <SelectItem value="terrain">Terrain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Commune</Label><Input value={bienForm.commune} onChange={e => setBienForm({ ...bienForm, commune: e.target.value })} /></div>
                <div><Label>Quartier</Label><Input value={bienForm.quartier} onChange={e => setBienForm({ ...bienForm, quartier: e.target.value })} /></div>
                <div><Label>Pièces</Label><Input type="number" value={bienForm.pieces} onChange={e => setBienForm({ ...bienForm, pieces: e.target.value })} /></div>
              </div>
              <div>
                <Label>Loyer mensuel (FCFA) *</Label>
                <Input type="number" value={bienForm.loyer_mensuel} onChange={e => setBienForm({ ...bienForm, loyer_mensuel: e.target.value })} required />
              </div>
            </div>
            <DialogFooter><Button type="submit">Créer le bien</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}