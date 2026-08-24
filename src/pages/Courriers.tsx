import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { FileText, Download, Eye, Plus, FileUp, Trash2, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import {
  renderCourrier, courrierToPdf, courrierToDocx,
  uploadCourrierFichier, getCourrierSignedUrl, downloadBlob, CATEGORIE_LABEL,
} from "@/lib/courriers";

export default function Courriers() {
  const { user } = useAuth();
  const [modeles, setModeles] = useState<any[]>([]);
  const [courriers, setCourriers] = useState<any[]>([]);
  const [baux, setBaux] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedModele, setSelectedModele] = useState<any | null>(null);
  const [selectedBail, setSelectedBail] = useState<string>("");
  const [vars, setVars] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewObjet, setPreviewObjet] = useState("");
  const [busy, setBusy] = useState(false);

  // Import courrier historique
  const [importOpen, setImportOpen] = useState(false);
  const [importForm, setImportForm] = useState<any>({ categorie: "autre", objet: "", bail_id: "", date_envoi: "", file: null as File | null });

  const load = async () => {
    const [m, c, b] = await Promise.all([
      supabase.from("modeles_courrier").select("*").eq("actif", true).order("nom"),
      supabase.from("courriers_juridiques").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("baux").select("id, reference, loyer_mensuel, date_entree, date_fin, locataires(id, nom, prenom, telephone, email), biens(adresse, commune, reference)").eq("statut", "actif"),
    ]);
    setModeles(m.data ?? []);
    setCourriers(c.data ?? []);
    setBaux(b.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return courriers.filter((c) =>
      !q || c.numero.toLowerCase().includes(q) ||
      (c.objet || "").toLowerCase().includes(q) ||
      (c.destinataire_nom || "").toLowerCase().includes(q)
    );
  }, [courriers, search]);

  const openGenerate = (modele: any) => {
    setSelectedModele(modele);
    setSelectedBail("");
    const init: Record<string, string> = { date: new Date().toLocaleDateString("fr-FR") };
    (modele.variables ?? []).forEach((v: string) => { if (!(v in init)) init[v] = ""; });
    setVars(init);
    setGenOpen(true);
  };

  const onSelectBail = (bailId: string) => {
    setSelectedBail(bailId);
    const b = baux.find((x) => x.id === bailId);
    if (!b) return;
    const loc = b.locataires;
    const bien = b.biens;
    setVars((prev) => ({
      ...prev,
      destinataire_nom: `${loc?.nom ?? ""} ${loc?.prenom ?? ""}`.trim(),
      destinataire_adresse: bien?.adresse ?? "",
      bail_reference: b.reference,
      bien_adresse: `${bien?.adresse ?? ""} — ${bien?.commune ?? ""}`,
      loyer_mensuel: String(b.loyer_mensuel ?? ""),
      date_entree: b.date_entree ?? "",
    }));
  };

  const renderCurrent = () => {
    if (!selectedModele) return { html: "", objet: "" };
    const html = renderCourrier(selectedModele.contenu_html, vars);
    const objet = renderCourrier(selectedModele.objet ?? selectedModele.nom, vars);
    return { html, objet };
  };

  const doPreview = () => {
    const { html, objet } = renderCurrent();
    setPreviewHtml(html); setPreviewObjet(objet); setPreviewOpen(true);
  };

  const archive = async (download: "pdf" | "docx" | null) => {
    if (!selectedModele) return;
    setBusy(true);
    try {
      const { html, objet } = renderCurrent();
      const b = baux.find((x) => x.id === selectedBail);
      const baseInsert = {
        modele_id: selectedModele.id,
        categorie: selectedModele.categorie,
        objet,
        contenu_html: html,
        bail_id: selectedBail || null,
        locataire_id: b?.locataires?.id ?? null,
        destinataire_nom: vars.destinataire_nom || null,
        destinataire_adresse: vars.destinataire_adresse || null,
        statut: "genere",
        cree_par: user?.id ?? null,
        numero: "",
      };
      const { data: inserted, error } = await supabase.from("courriers_juridiques")
        .insert([baseInsert as any]).select().single();
      if (error) throw error;

      const numero = inserted.numero;
      const pdfBlob = courrierToPdf(objet, html);
      const pdfPath = `${numero}/${numero}.pdf`;
      await uploadCourrierFichier(pdfPath, pdfBlob);

      const docxBlob = await courrierToDocx(objet, html);
      const docxPath = `${numero}/${numero}.docx`;
      await uploadCourrierFichier(docxPath, docxBlob);

      await supabase.from("courriers_juridiques").update({
        fichier_pdf_url: pdfPath, fichier_docx_url: docxPath,
      }).eq("id", inserted.id);

      if (download === "pdf") downloadBlob(pdfBlob, `${numero}.pdf`);
      if (download === "docx") downloadBlob(docxBlob, `${numero}.docx`);

      toast.success(`Courrier ${numero} archivé`);
      setGenOpen(false); setPreviewOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const downloadFile = async (path: string, name: string) => {
    try {
      const url = await getCourrierSignedUrl(path);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.target = "_blank"; a.click();
    } catch (e: any) { toast.error(e.message); }
  };

  const importCourrier = async () => {
    if (!importForm.file || !importForm.objet) return toast.error("Objet et fichier requis");
    setBusy(true);
    try {
      const b = baux.find((x) => x.id === importForm.bail_id);
      const { data: inserted, error } = await supabase.from("courriers_juridiques").insert([{
        categorie: importForm.categorie,
        objet: importForm.objet,
        contenu_html: `<p><em>Courrier importé le ${new Date().toLocaleDateString("fr-FR")}.</em></p>`,
        bail_id: importForm.bail_id || null,
        locataire_id: b?.locataires?.id ?? null,
        destinataire_nom: b ? `${b.locataires?.nom ?? ""} ${b.locataires?.prenom ?? ""}`.trim() : null,
        statut: "envoye",
        date_envoi: importForm.date_envoi || null,
        cree_par: user?.id ?? null,
        numero: "",
      } as any]).select().single();
      if (error) throw error;

      const ext = (importForm.file.name.split(".").pop() || "pdf").toLowerCase();
      const path = `${inserted.numero}/import.${ext}`;
      await uploadCourrierFichier(path, importForm.file);
      const updateField = ext === "docx" ? "fichier_docx_url" : "fichier_pdf_url";
      await supabase.from("courriers_juridiques").update({ [updateField]: path } as any).eq("id", inserted.id);

      toast.success(`Courrier ${inserted.numero} importé`);
      setImportOpen(false);
      setImportForm({ categorie: "autre", objet: "", bail_id: "", date_envoi: "", file: null });
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const supprimer = async (id: string) => {
    if (!confirm("Supprimer ce courrier ?")) return;
    const { error } = await supabase.from("courriers_juridiques").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Supprimé"); load(); }
  };

  const updateStatut = async (id: string, statut: string, mode?: string) => {
    const patch: any = { statut };
    if (mode) patch.mode_envoi = mode;
    if (statut === "envoye") patch.date_envoi = new Date().toISOString().slice(0, 10);
    if (statut === "recu") patch.date_reception = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("courriers_juridiques").update(patch).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Statut mis à jour"); load(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courriers juridiques</h1>
          <p className="text-muted-foreground">Rédaction automatisée, archivage, import/export</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild><Link to="/modeles-courrier"><Settings className="h-4 w-4 mr-2" />Modèles</Link></Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4 mr-2" />Importer</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Générer un nouveau courrier</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {modeles.map((m) => (
              <button key={m.id} onClick={() => openGenerate(m)}
                className="text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors">
                <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-primary" /><Badge variant="outline" className="text-[10px]">{CATEGORIE_LABEL[m.categorie]}</Badge></div>
                <div className="font-medium text-sm">{m.nom}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base">Historique ({filtered.length})</CardTitle>
            <Input placeholder="Rechercher numéro, objet, destinataire…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Objet / Destinataire</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                  <TableCell><Badge variant="outline">{CATEGORIE_LABEL[c.categorie] ?? c.categorie}</Badge></TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{c.objet}</div>
                    <div className="text-xs text-muted-foreground">{c.destinataire_nom || "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString("fr-FR")}</TableCell>
                  <TableCell>
                    <Select value={c.statut} onValueChange={(v) => updateStatut(c.id, v)}>
                      <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brouillon">Brouillon</SelectItem>
                        <SelectItem value="genere">Généré</SelectItem>
                        <SelectItem value="envoye">Envoyé</SelectItem>
                        <SelectItem value="recu">Reçu</SelectItem>
                        <SelectItem value="annule">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { setPreviewHtml(c.contenu_html); setPreviewObjet(c.objet); setPreviewOpen(true); setSelectedModele(null); }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    {c.fichier_pdf_url && <Button size="sm" variant="ghost" onClick={() => downloadFile(c.fichier_pdf_url, `${c.numero}.pdf`)}><Download className="h-3 w-3" /> PDF</Button>}
                    {c.fichier_docx_url && <Button size="sm" variant="ghost" onClick={() => downloadFile(c.fichier_docx_url, `${c.numero}.docx`)}><Download className="h-3 w-3" /> DOCX</Button>}
                    <Button size="sm" variant="ghost" onClick={() => supprimer(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun courrier</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Génération */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Générer : {selectedModele?.nom}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Bail concerné (optionnel — préremplit les variables)</Label>
              <Select value={selectedBail} onValueChange={onSelectBail}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un bail…" /></SelectTrigger>
                <SelectContent>
                  {baux.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.reference} — {b.locataires?.nom} {b.locataires?.prenom} ({b.biens?.commune})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(selectedModele?.variables ?? []).map((v: string) => (
                <div key={v} className={["destinataire_adresse", "bien_adresse"].includes(v) ? "col-span-2" : ""}>
                  <Label className="text-xs">{v}</Label>
                  {["destinataire_adresse", "bien_adresse"].includes(v)
                    ? <Textarea rows={2} value={vars[v] ?? ""} onChange={(e) => setVars({ ...vars, [v]: e.target.value })} />
                    : <Input value={vars[v] ?? ""} onChange={(e) => setVars({ ...vars, [v]: e.target.value })} />}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={doPreview}><Eye className="h-4 w-4 mr-2" />Aperçu</Button>
            <Button variant="outline" onClick={() => archive("docx")} disabled={busy}><Download className="h-4 w-4 mr-2" />DOCX</Button>
            <Button onClick={() => archive("pdf")} disabled={busy}><Download className="h-4 w-4 mr-2" />{busy ? "…" : "PDF + Archiver"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aperçu */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{previewObjet}</DialogTitle></DialogHeader>
          <div className="prose prose-sm max-w-none p-4 bg-white text-black rounded border" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          {selectedModele && (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => archive("docx")} disabled={busy}><Download className="h-4 w-4 mr-2" />Télécharger DOCX</Button>
              <Button onClick={() => archive("pdf")} disabled={busy}><Download className="h-4 w-4 mr-2" />Télécharger PDF + Archiver</Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Import */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Importer un courrier existant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Catégorie</Label>
              <Select value={importForm.categorie} onValueChange={(v) => setImportForm({ ...importForm, categorie: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Objet *</Label><Input value={importForm.objet} onChange={(e) => setImportForm({ ...importForm, objet: e.target.value })} /></div>
            <div>
              <Label>Bail concerné (optionnel)</Label>
              <Select value={importForm.bail_id} onValueChange={(v) => setImportForm({ ...importForm, bail_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {baux.map((b) => <SelectItem key={b.id} value={b.id}>{b.reference} — {b.locataires?.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date d'envoi</Label><Input type="date" value={importForm.date_envoi} onChange={(e) => setImportForm({ ...importForm, date_envoi: e.target.value })} /></div>
            <div><Label>Fichier (PDF ou DOCX) *</Label><Input type="file" accept=".pdf,.docx" onChange={(e) => setImportForm({ ...importForm, file: e.target.files?.[0] ?? null })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Annuler</Button>
            <Button onClick={importCourrier} disabled={busy}>{busy ? "Import…" : "Importer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
