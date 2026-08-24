import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, FileUp, Trash2, Paperclip, Download } from "lucide-react";

type TypePersonne = "physique" | "morale";

const DOCS_PHYSIQUE = [
  { value: "cni", label: "CNI / Pièce d'identité" },
  { value: "bulletin_salaire", label: "Bulletin de salaire" },
  { value: "contrat_travail", label: "Contrat de travail" },
  { value: "attestation_employeur", label: "Attestation employeur" },
  { value: "justificatif_domicile", label: "Justificatif de domicile" },
  { value: "autre", label: "Autre" },
];

const DOCS_MORALE = [
  { value: "rccm", label: "RCCM" },
  { value: "nif", label: "NIF / Identification fiscale" },
  { value: "statuts", label: "Statuts de la société" },
  { value: "pv_assemblee", label: "PV d'assemblée" },
  { value: "attestation_existence", label: "Attestation d'existence" },
  { value: "cni_representant", label: "CNI du représentant légal" },
  { value: "pouvoir_signature", label: "Pouvoir de signature" },
  { value: "kbis_equivalent", label: "Kbis / équivalent" },
  { value: "autre", label: "Autre" },
];

const emptyForm = {
  type_personne: "physique" as TypePersonne,
  nom: "", prenom: "", raison_sociale: "",
  telephone: "", email: "",
  employeur: "", revenus_mensuels: "",
  rccm: "", nif: "",
};

export default function Locataires() {
  const { user } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [pieces, setPieces] = useState<{ type_document: string; libelle: string; file: File | null }[]>([]);
  const [saving, setSaving] = useState(false);

  const [docsOpen, setDocsOpen] = useState(false);
  const [docsLoc, setDocsLoc] = useState<any>(null);
  const [docsList, setDocsList] = useState<any[]>([]);
  const [newDoc, setNewDoc] = useState<{ type_document: string; libelle: string; file: File | null }>({ type_document: "", libelle: "", file: null });

  const load = async () => {
    const { data } = await supabase.from("locataires").select("*").order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const docTypes = (tp: TypePersonne) => tp === "morale" ? DOCS_MORALE : DOCS_PHYSIQUE;

  const addPieceRow = () => setPieces(p => [...p, { type_document: "", libelle: "", file: null }]);
  const updatePiece = (i: number, patch: Partial<{ type_document: string; libelle: string; file: File | null }>) =>
    setPieces(p => p.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const removePiece = (i: number) => setPieces(p => p.filter((_, idx) => idx !== i));

  const uploadFile = async (locataireId: string, file: File) => {
    const ext = file.name.split(".").pop();
    const path = `locataires/${locataireId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("documents").upload(path, file);
    if (error) throw error;
    return path;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isMorale = form.type_personne === "morale";
      const payload: any = {
        type_personne: form.type_personne,
        nom: isMorale ? (form.raison_sociale || form.nom) : form.nom,
        prenom: isMorale ? null : (form.prenom || null),
        raison_sociale: isMorale ? (form.raison_sociale || null) : null,
        telephone: form.telephone || null,
        email: form.email || null,
        employeur: isMorale ? null : (form.employeur || null),
        revenus_mensuels: form.revenus_mensuels ? Number(form.revenus_mensuels) : null,
        rccm: isMorale ? (form.rccm || null) : null,
        nif: isMorale ? (form.nif || null) : null,
        created_by: user?.id ?? null, // ← isolation commercial
      };
      const { data: loc, error } = await supabase.from("locataires").insert(payload).select().single();
      if (error) throw error;

      const valid = pieces.filter(p => p.file && p.type_document);
      for (const p of valid) {
        const path = await uploadFile(loc.id, p.file!);
        const types = docTypes(form.type_personne);
        const label = p.libelle || types.find(t => t.value === p.type_document)?.label || p.type_document;
        const { error: pe } = await supabase.from("pieces_locataire").insert({
          locataire_id: loc.id,
          type_document: p.type_document,
          libelle: label,
          fichier_url: path,
        });
        if (pe) throw pe;
      }

      toast.success(`Locataire ajouté${valid.length ? ` avec ${valid.length} document(s)` : ""}`);
      setOpen(false); setForm(emptyForm); setPieces([]);
      load();
    } catch (err: any) {
      toast.error(err.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const openDocs = async (loc: any) => {
    setDocsLoc(loc); setDocsOpen(true);
    setNewDoc({ type_document: "", libelle: "", file: null });
    const { data } = await supabase.from("pieces_locataire").select("*").eq("locataire_id", loc.id).order("created_at", { ascending: false });
    setDocsList(data ?? []);
  };

  const addExistingDoc = async () => {
    if (!docsLoc || !newDoc.file || !newDoc.type_document) { toast.error("Type et fichier requis"); return; }
    try {
      const path = await uploadFile(docsLoc.id, newDoc.file);
      const types = docTypes(docsLoc.type_personne);
      const label = newDoc.libelle || types.find(t => t.value === newDoc.type_document)?.label || newDoc.type_document;
      const { error } = await supabase.from("pieces_locataire").insert({
        locataire_id: docsLoc.id, type_document: newDoc.type_document,
        libelle: label, fichier_url: path,
      });
      if (error) throw error;
      toast.success("Document ajouté"); openDocs(docsLoc);
    } catch (e: any) { toast.error(e.message); }
  };

  const downloadDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const deleteDoc = async (doc: any) => {
    if (!confirm("Supprimer ce document ?")) return;
    await supabase.storage.from("documents").remove([doc.fichier_url]);
    await supabase.from("pieces_locataire").delete().eq("id", doc.id);
    openDocs(docsLoc);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Locataires</h1><p className="text-muted-foreground text-sm">Référentiel des locataires (personnes physiques & morales)</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nouveau locataire</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={submit}>
              <DialogHeader><DialogTitle>Ajouter un locataire</DialogTitle></DialogHeader>
              <div className="space-y-4 py-3">
                <div>
                  <Label>Type de personne</Label>
                  <Select value={form.type_personne} onValueChange={(v: TypePersonne) => { setForm({ ...form, type_personne: v }); setPieces([]); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="physique">Personne physique</SelectItem>
                      <SelectItem value="morale">Personne morale</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.type_personne === "physique" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Prénom</Label><Input value={form.prenom} onChange={e => setForm({ ...form, prenom: e.target.value })} /></div>
                    <div><Label>Nom *</Label><Input value={form.nom} onChange={e => setForm({ ...form, nom: e.target.value })} required /></div>
                    <div><Label>Téléphone</Label><Input value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Employeur</Label><Input value={form.employeur} onChange={e => setForm({ ...form, employeur: e.target.value })} /></div>
                    <div><Label>Revenus mensuels (FCFA)</Label><Input type="number" value={form.revenus_mensuels} onChange={e => setForm({ ...form, revenus_mensuels: e.target.value })} /></div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Raison sociale *</Label><Input value={form.raison_sociale} onChange={e => setForm({ ...form, raison_sociale: e.target.value, nom: e.target.value })} required /></div>
                    <div><Label>RCCM</Label><Input value={form.rccm} onChange={e => setForm({ ...form, rccm: e.target.value })} /></div>
                    <div><Label>NIF</Label><Input value={form.nif} onChange={e => setForm({ ...form, nif: e.target.value })} /></div>
                    <div><Label>Téléphone</Label><Input value={form.telephone} onChange={e => setForm({ ...form, telephone: e.target.value })} /></div>
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-base">Documents à joindre</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addPieceRow}><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    {form.type_personne === "physique"
                      ? "Ex. : CNI, bulletin de salaire, contrat de travail."
                      : "Ex. : RCCM, NIF, statuts, PV d'assemblée, CNI du représentant légal."}
                  </p>
                  {pieces.length === 0 && <p className="text-sm text-muted-foreground italic">Aucun document — vous pourrez aussi en ajouter plus tard.</p>}
                  <div className="space-y-2">
                    {pieces.map((p, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded p-2">
                        <div className="col-span-4">
                          <Label className="text-xs">Type</Label>
                          <Select value={p.type_document} onValueChange={(v) => updatePiece(i, { type_document: v })}>
                            <SelectTrigger><SelectValue placeholder="Type..." /></SelectTrigger>
                            <SelectContent>{docTypes(form.type_personne).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Label className="text-xs">Libellé (optionnel)</Label>
                          <Input value={p.libelle} onChange={e => updatePiece(i, { libelle: e.target.value })} placeholder="ex. Janvier 2025" />
                        </div>
                        <div className="col-span-4">
                          <Label className="text-xs">Fichier</Label>
                          <Input type="file" onChange={e => updatePiece(i, { file: e.target.files?.[0] ?? null })} />
                        </div>
                        <div className="col-span-1">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removePiece(i)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardHeader><CardTitle>Locataires ({list.length})</CardTitle></CardHeader><CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Type</TableHead><TableHead>Nom / Raison sociale</TableHead>
            <TableHead>Téléphone</TableHead><TableHead>Email</TableHead>
            <TableHead>Employeur / RCCM</TableHead>
            <TableHead className="text-right">Documents</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {list.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun locataire</TableCell></TableRow>}
            {list.map(l => (
              <TableRow key={l.id}>
                <TableCell><Badge variant={l.type_personne === "morale" ? "default" : "secondary"}>{l.type_personne === "morale" ? "Morale" : "Physique"}</Badge></TableCell>
                <TableCell className="font-medium">
                  <Link to={`/locataires/${l.id}`} className="text-primary hover:underline">
                    {l.type_personne === "morale" ? (l.raison_sociale || l.nom) : `${l.prenom ?? ""} ${l.nom}`}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{l.telephone || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{l.email || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{l.type_personne === "morale" ? (l.rccm || "—") : (l.employeur || "—")}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openDocs(l)}><Paperclip className="h-3 w-3 mr-1" />Documents</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Documents — {docsLoc?.type_personne === "morale" ? (docsLoc?.raison_sociale || docsLoc?.nom) : `${docsLoc?.prenom ?? ""} ${docsLoc?.nom ?? ""}`}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="border rounded p-3 space-y-2">
              <div className="font-medium text-sm flex items-center gap-2"><FileUp className="h-4 w-4" />Ajouter un document</div>
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Label className="text-xs">Type</Label>
                  <Select value={newDoc.type_document} onValueChange={(v) => setNewDoc({ ...newDoc, type_document: v })}>
                    <SelectTrigger><SelectValue placeholder="Type..." /></SelectTrigger>
                    <SelectContent>{docTypes((docsLoc?.type_personne ?? "physique") as TypePersonne).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-4"><Label className="text-xs">Libellé</Label><Input value={newDoc.libelle} onChange={e => setNewDoc({ ...newDoc, libelle: e.target.value })} /></div>
                <div className="col-span-3"><Label className="text-xs">Fichier</Label><Input type="file" onChange={e => setNewDoc({ ...newDoc, file: e.target.files?.[0] ?? null })} /></div>
                <div className="col-span-1"><Button type="button" size="sm" onClick={addExistingDoc}>OK</Button></div>
              </div>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Libellé</TableHead><TableHead>Ajouté le</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {docsList.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucun document</TableCell></TableRow>}
                {docsList.map(d => (
                  <TableRow key={d.id}>
                    <TableCell><Badge variant="outline">{d.type_document}</Badge></TableCell>
                    <TableCell>{d.libelle}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString("fr-FR")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => downloadDoc(d.fichier_url)}><Download className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteDoc(d)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}