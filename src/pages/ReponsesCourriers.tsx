import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { UserCheck, PenLine, CheckCircle2, Send, Eye, Download, Reply, Inbox, Users } from "lucide-react";
import {
  renderCourrier, courrierToPdf, courrierToDocx,
  uploadCourrierFichier, downloadBlob,
} from "@/lib/courriers";

const CATEGORIES_RECUS: Record<string, string> = {
  preavis_depart: "Préavis de départ",
  reclamation: "Réclamation",
  demande_travaux: "Demande de travaux",
  demande_information: "Demande d'information",
  contestation: "Contestation",
  autre: "Autre",
};

type Tab = "a_affecter" | "affectes" | "en_redaction" | "a_valider" | "envoyes";

export default function ReponsesCourriers() {
  const { user, hasRole } = useAuth();
  const [tab, setTab] = useState<Tab>("a_affecter");
  const [list, setList] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [modeles, setModeles] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [redactionOpen, setRedactionOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [redaction, setRedaction] = useState("");
  const [objetReponse, setObjetReponse] = useState("");
  const [modeleId, setModeleId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAgent, setBulkAgent] = useState<string>("");

  const canValidate = hasRole("admin") || hasRole("direction") || hasRole("juridique");

  const load = async () => {
    const [c, m, p] = await Promise.all([
      supabase.from("courriers_recus")
        .select("*, locataires(nom, prenom, telephone, email), baux(reference, biens(adresse, commune, reference))")
        .order("date_reception", { ascending: false }),
      supabase.from("modeles_courrier").select("*").eq("actif", true).order("nom"),
      supabase.rpc("get_users_with_roles" as any),
    ]);
    setList(c.data ?? []);
    setModeles(m.data ?? []);
    const all = (p.data as any[]) ?? [];
    setAgents(all.filter((u) => u.roles?.some((r: string) => ["juridique", "recouvrement", "direction", "admin"].includes(r))));
  };
  useEffect(() => { load(); }, []);

  const buckets = useMemo(() => ({
    a_affecter: list.filter((c) => !c.affecte_a && c.statut === "recu"),
    affectes: list.filter((c) => c.affecte_a && c.statut === "recu" && !c.redaction_html),
    en_redaction: list.filter((c) => c.statut === "en_traitement" && c.redaction_html && !c.valide_le),
    a_valider: list.filter((c) => c.statut === "en_traitement" && c.redaction_html && c.valide_le === null && c.redige_par && c.redige_par !== c.affecte_a),
    envoyes: list.filter((c) => c.statut === "reponse_envoyee" || c.statut === "clos"),
  }), [list]);

  // Affectation
  const affecter = async (id: string, agentId: string) => {
    const { error } = await supabase.from("courriers_recus")
      .update({ affecte_a: agentId, statut: "en_traitement" as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Courrier affecté"); load();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (rows: any[]) => {
    setSelectedIds((prev) => {
      const allIds = rows.map((r) => r.id);
      const allSelected = allIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(allIds);
    });
  };

  const affecterEnLot = async () => {
    if (!bulkAgent || selectedIds.size === 0) return;
    setBusy(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("courriers_recus")
      .update({ affecte_a: bulkAgent, statut: "en_traitement" as any })
      .in("id", ids);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${ids.length} courrier(s) affecté(s)`);
    setSelectedIds(new Set());
    setBulkAgent("");
    load();
  };

  // Ouvre la rédaction
  const openRedaction = (c: any) => {
    setEditing(c);
    setRedaction(c.redaction_html ?? `<p>Madame, Monsieur,</p>\n<p>Nous accusons réception de votre courrier du ${c.date_reception} relatif à : ${c.objet}.</p>\n<p>...</p>\n<p>Veuillez agréer, Madame, Monsieur, l'expression de nos salutations distinguées.</p>\n<p><strong>La Direction</strong></p>`);
    setObjetReponse(`Réponse à votre courrier du ${c.date_reception} — ${c.objet}`);
    setModeleId(c.modele_reponse_id ?? "");
    setRedactionOpen(true);
  };

  const applyModele = (id: string) => {
    setModeleId(id);
    const m = modeles.find((x) => x.id === id);
    if (!m) return;
    const vars: Record<string, string> = {
      destinataire_nom: editing?.locataires ? `${editing.locataires.prenom ?? ""} ${editing.locataires.nom}`.trim() : "",
      destinataire_adresse: editing?.baux?.biens?.adresse ?? "",
      bien_adresse: editing?.baux?.biens?.adresse ?? "",
      bien_reference: editing?.baux?.biens?.reference ?? "",
      bail_reference: editing?.baux?.reference ?? "",
      objet_courrier: editing?.objet ?? "",
      date_courrier: editing?.date_reception ?? "",
      date: new Date().toLocaleDateString("fr-FR"),
    };
    setRedaction(renderCourrier(m.contenu_html, vars));
    if (m.objet) setObjetReponse(renderCourrier(m.objet, vars));
  };

  const saveBrouillon = async () => {
    if (!editing) return;
    setBusy(true);
    const { error } = await supabase.from("courriers_recus").update({
      redaction_html: redaction,
      modele_reponse_id: modeleId || null,
      redige_par: user?.id,
      statut: "en_traitement" as any,
    }).eq("id", editing.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Brouillon enregistré"); setRedactionOpen(false); load();
  };

  const soumettreValidation = async () => {
    if (!editing) return;
    await saveBrouillon();
    toast.info("Soumis à validation");
  };

  const valider = async (c: any) => {
    if (!canValidate) return toast.error("Validation réservée à la direction / juridique");
    const { error } = await supabase.from("courriers_recus")
      .update({ valide_par: user?.id, valide_le: new Date().toISOString() }).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Réponse validée — prête à être envoyée"); load();
  };

  const refuser = async (c: any) => {
    const { error } = await supabase.from("courriers_recus")
      .update({ valide_par: null, valide_le: null, statut: "en_traitement" as any })
      .eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Renvoyé en rédaction"); load();
  };

  // Génération + archivage de la réponse (PDF + DOCX) dans courriers_juridiques
  const genererEtEnvoyer = async (c: any) => {
    setBusy(true);
    try {
      const objet = `Réponse — ${c.objet}`;
      const html = c.redaction_html ?? "";
      const pdfBlob = courrierToPdf(objet, html);
      const docxBlob = await courrierToDocx(objet, html);

      const baseName = `reponses/${c.id}_${Date.now()}`;
      const pdfPath = await uploadCourrierFichier(`${baseName}.pdf`, pdfBlob);
      const docxPath = await uploadCourrierFichier(`${baseName}.docx`, docxBlob);

      const { data: courrier, error: ce } = await supabase.from("courriers_juridiques").insert({
        objet, contenu_html: html,
        categorie: "reponse_locataire" as any,
        bail_id: c.bail_id, locataire_id: c.locataire_id,
        destinataire_nom: c.locataires ? `${c.locataires.prenom ?? ""} ${c.locataires.nom}`.trim() : null,
        destinataire_adresse: c.baux?.biens?.adresse ?? null,
        fichier_pdf_url: pdfPath, fichier_docx_url: docxPath,
        statut: "envoye" as any, date_envoi: new Date().toISOString().slice(0, 10),
        cree_par: user?.id,
      } as any).select().single();
      if (ce) throw ce;

      const { error: ue } = await supabase.from("courriers_recus").update({
        statut: "reponse_envoyee" as any,
        reponse_courrier_id: courrier.id,
      }).eq("id", c.id);
      if (ue) throw ue;

      downloadBlob(pdfBlob, `${objet}.pdf`);
      toast.success("Réponse générée et archivée");
      load();
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (c: any, actions: React.ReactNode, withSelect = false) => (
    <TableRow key={c.id} data-state={withSelect && selectedIds.has(c.id) ? "selected" : undefined}>
      {withSelect && (
        <TableCell className="w-8">
          <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
        </TableCell>
      )}
      <TableCell className="text-xs">{c.date_reception}</TableCell>
      <TableCell><Badge variant="outline">{CATEGORIES_RECUS[c.categorie]}</Badge></TableCell>
      <TableCell className="font-medium max-w-xs truncate">{c.objet}</TableCell>
      <TableCell className="text-xs">
        {c.locataires ? `${c.locataires.prenom ?? ""} ${c.locataires.nom}`.trim() : "—"}
        <div className="text-muted-foreground">{c.baux?.reference}</div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {c.affecte_a ? agents.find((a) => a.id === c.affecte_a)?.nom ?? "Affecté" : "—"}
      </TableCell>
      <TableCell className="text-right space-x-1">{actions}</TableCell>
    </TableRow>
  );

  const TableShell = ({ rows, empty }: { rows: any[]; empty: string }) => {
    const withSelect = tab === "a_affecter";
    const allSelected = withSelect && rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
    const colCount = withSelect ? 7 : 6;
    return (
      <Table>
        <TableHeader><TableRow>
          {withSelect && (
            <TableHead className="w-8">
              <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(rows)} />
            </TableHead>
          )}
          <TableHead>Reçu le</TableHead><TableHead>Catégorie</TableHead><TableHead>Objet</TableHead>
          <TableHead>Locataire / bail</TableHead><TableHead>Affecté à</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 && <TableRow><TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">{empty}</TableCell></TableRow>}
          {rows.map((c) => {
            if (tab === "a_affecter") return renderRow(c, (
              <Select onValueChange={(v) => affecter(c.id, v)}>
                <SelectTrigger className="h-8 w-44 inline-flex"><SelectValue placeholder="Affecter à…" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.prenom} {a.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            ), true);
            if (tab === "affectes") return renderRow(c, (
              <Button size="sm" onClick={() => openRedaction(c)}><PenLine className="h-4 w-4 mr-1" />Rédiger</Button>
            ));
            if (tab === "en_redaction") return renderRow(c, (
              <>
                <Button size="sm" variant="outline" onClick={() => openRedaction(c)}><PenLine className="h-4 w-4 mr-1" />Modifier</Button>
                {canValidate && <Button size="sm" onClick={() => valider(c)}><CheckCircle2 className="h-4 w-4 mr-1" />Valider</Button>}
              </>
            ));
            if (tab === "a_valider") return renderRow(c, (
              <>
                <Button size="sm" variant="outline" onClick={() => { setEditing(c); setRedaction(c.redaction_html ?? ""); setObjetReponse(`Réponse — ${c.objet}`); setPreviewOpen(true); }}>
                  <Eye className="h-4 w-4 mr-1" />Aperçu
                </Button>
                {canValidate && <>
                  <Button size="sm" variant="ghost" onClick={() => refuser(c)}>Refuser</Button>
                  <Button size="sm" onClick={() => valider(c)}><CheckCircle2 className="h-4 w-4 mr-1" />Valider</Button>
                </>}
              </>
            ));
            // envoyes
            return renderRow(c, (
              <>
                {c.valide_le && c.statut !== "reponse_envoyee" && (
                  <Button size="sm" disabled={busy} onClick={() => genererEtEnvoyer(c)}>
                    <Send className="h-4 w-4 mr-1" />Générer & envoyer
                  </Button>
                )}
                {c.statut === "reponse_envoyee" && <Badge>Envoyée</Badge>}
              </>
            ));
          })}
        </TableBody>
      </Table>
    );
  };

  // Section dédiée "Validées – à générer" (entre a_valider et envoyes)
  const validees = list.filter((c) => c.valide_le && c.statut === "en_traitement");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Reply className="h-6 w-6" />Réponses aux courriers reçus</h1>
          <p className="text-sm text-muted-foreground">Affectation, rédaction, validation et envoi des réponses aux locataires</p>
        </div>
        <Button variant="outline" asChild>
          <a href="/courriers-recus"><Inbox className="h-4 w-4 mr-1" />Boîte de réception</a>
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {([
          ["a_affecter", "À affecter", buckets.a_affecter.length],
          ["affectes", "Affectés", buckets.affectes.length],
          ["en_redaction", "En rédaction", buckets.en_redaction.length],
          ["a_valider", "À valider", validees.length],
          ["envoyes", "Envoyées", buckets.envoyes.length],
        ] as const).map(([key, label, n]) => (
          <Card key={key} onClick={() => setTab(key as Tab)} className={`cursor-pointer transition ${tab === key ? "border-primary" : ""}`}>
            <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{n}</CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="a_affecter">À affecter</TabsTrigger>
              <TabsTrigger value="affectes">Affectés</TabsTrigger>
              <TabsTrigger value="en_redaction">En rédaction</TabsTrigger>
              <TabsTrigger value="a_valider">Validées – à envoyer</TabsTrigger>
              <TabsTrigger value="envoyes">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="a_affecter" className="mt-4 space-y-3">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/40">
                  <Users className="h-4 w-4" />
                  <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
                  <Select value={bulkAgent} onValueChange={setBulkAgent}>
                    <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Affecter à un agent…" /></SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.prenom} {a.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="sm" disabled={!bulkAgent || busy} onClick={affecterEnLot}>
                    <UserCheck className="h-4 w-4 mr-1" />Affecter en lot
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Annuler</Button>
                </div>
              )}
              <TableShell rows={buckets.a_affecter} empty="Tous les courriers ont été affectés" />
            </TabsContent>
            <TabsContent value="affectes" className="mt-4">
              <TableShell rows={buckets.affectes} empty="Aucun courrier en attente de rédaction" />
            </TabsContent>
            <TabsContent value="en_redaction" className="mt-4">
              <TableShell rows={buckets.en_redaction} empty="Aucune rédaction en cours" />
            </TabsContent>
            <TabsContent value="a_valider" className="mt-4">
              <TableShell rows={validees} empty="Aucune réponse validée à envoyer" />
            </TabsContent>
            <TabsContent value="envoyes" className="mt-4">
              <TableShell rows={buckets.envoyes} empty="Aucun envoi" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Rédaction */}
      <Dialog open={redactionOpen} onOpenChange={setRedactionOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Rédiger la réponse</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="p-3 bg-muted rounded text-xs space-y-1">
                <div><strong>Courrier reçu :</strong> {editing.objet}</div>
                <div><strong>Catégorie :</strong> {CATEGORIES_RECUS[editing.categorie]} · <strong>Reçu :</strong> {editing.date_reception}</div>
                <div><strong>Locataire :</strong> {editing.locataires ? `${editing.locataires.prenom ?? ""} ${editing.locataires.nom}` : "—"} · <strong>Bail :</strong> {editing.baux?.reference ?? "—"}</div>
                {editing.contenu && <div className="pt-2 border-t mt-2 whitespace-pre-wrap text-muted-foreground italic">{editing.contenu}</div>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Modèle de réponse</Label>
                  <Select value={modeleId} onValueChange={applyModele}>
                    <SelectTrigger><SelectValue placeholder="Choisir un modèle…" /></SelectTrigger>
                    <SelectContent>
                      {modeles.map((m) => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Objet de la réponse</Label>
                  <Input value={objetReponse} onChange={(e) => setObjetReponse(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Contenu (HTML)</Label>
                <Textarea rows={14} value={redaction} onChange={(e) => setRedaction(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="border rounded p-3 max-h-64 overflow-auto bg-background">
                <div dangerouslySetInnerHTML={{ __html: redaction }} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRedactionOpen(false)}>Annuler</Button>
            <Button variant="outline" onClick={saveBrouillon} disabled={busy}>Enregistrer le brouillon</Button>
            {canValidate && editing && (
              <Button onClick={async () => { await saveBrouillon(); await valider(editing); }}>
                Enregistrer & valider
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Aperçu */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{objetReponse}</DialogTitle></DialogHeader>
          <div className="border rounded p-4 max-h-[60vh] overflow-auto bg-background">
            <div dangerouslySetInnerHTML={{ __html: redaction }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => downloadBlob(courrierToPdf(objetReponse, redaction), `${objetReponse}.pdf`)}>
              <Download className="h-4 w-4 mr-1" />Télécharger PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
