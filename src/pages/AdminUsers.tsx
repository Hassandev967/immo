import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

const ALL_ROLES = ["admin", "direction", "commercial", "caisse", "recouvrement", "juridique"] as const;

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  direction: "Direction",
  commercial: "Commercial",
  caisse: "Caisse",
  recouvrement: "Recouvrement",
  juridique: "Juridique",
};

export default function AdminUsers() {
  const { hasRole, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const emptyForm = { email: "", password: "", nom: "", prenom: "", telephone: "", roles: new Set<string>(["caisse"]) };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    const { data, error } = await supabase.rpc("get_users_with_roles");
    if (error) { toast.error(error.message); setLoading(false); return; }
    setUsers(data ?? []); setLoading(false);
  };

  useEffect(() => { if (!authLoading && hasRole("admin")) load(); }, [authLoading, hasRole]);

  if (!authLoading && !hasRole("admin")) return <Navigate to="/" replace />;

  const openEdit = (u: any) => {
    setEditing(u);
    setSelected(new Set(u.roles));
  };

  const toggle = (role: string) => {
    const next = new Set(selected);
    if (next.has(role)) next.delete(role); else next.add(role);
    setSelected(next);
  };

  const save = async () => {
    if (!editing) return;
    const current = new Set<string>(editing.roles);
    const toAdd = [...selected].filter(r => !current.has(r));
    const toRemove = [...current].filter(r => !selected.has(r));

    if (toAdd.length) {
      const { error } = await supabase.from("user_roles").insert(toAdd.map(r => ({ user_id: editing.id, role: r as any })));
      if (error) return toast.error(error.message);
    }
    if (toRemove.length) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", editing.id).in("role", toRemove as any);
      if (error) return toast.error(error.message);
    }
    toast.success("Rôles mis à jour");
    setEditing(null);
    load();
  };

  const toggleForm = (role: string) => {
    const next = new Set(form.roles);
    if (next.has(role)) next.delete(role); else next.add(role);
    setForm({ ...form, roles: next });
  };

  const createUser = async () => {
    if (!form.email || !form.password) return toast.error("Email et mot de passe requis");
    if (form.password.length < 8) return toast.error("Mot de passe : 8 caractères minimum");
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        email: form.email.trim(),
        password: form.password,
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        telephone: form.telephone.trim() || null,
        roles: [...form.roles],
      },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Erreur");
    }
    toast.success("Utilisateur créé");
    setCreateOpen(false);
    setForm(emptyForm);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-7 w-7" />Administration · Utilisateurs</h1>
          <p className="text-muted-foreground">Création de comptes et attribution des rôles</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><UserPlus className="h-4 w-4 mr-2" />Créer un utilisateur</Button>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertDescription className="text-sm">
          En tant qu'admin, vous créez les comptes et attribuez les rôles correspondant au service de chaque utilisateur. Les comptes créés ici sont actifs immédiatement (email confirmé).
        </AlertDescription>
      </Alert>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Utilisateur</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead>Rôles</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Chargement…</TableCell></TableRow>}
            {!loading && users.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Aucun utilisateur</TableCell></TableRow>}
            {users.map(u => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="font-medium">{u.prenom} {u.nom}</div>
                  <div className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}…</div>
                </TableCell>
                <TableCell className="text-sm">{u.telephone || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0 && <span className="text-xs text-muted-foreground italic">Aucun</span>}
                    {u.roles.map((r: string) => (
                      <Badge key={r} variant={r === "admin" ? "default" : "outline"}>{ROLE_LABEL[r] ?? r}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(u)}>Modifier rôles</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rôles de {editing?.prenom} {editing?.nom}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {ALL_ROLES.map(r => (
              <label key={r} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer">
                <Checkbox checked={selected.has(r)} onCheckedChange={() => toggle(r)} />
                <div>
                  <div className="font-medium">{ROLE_LABEL[r]}</div>
                  <div className="text-xs text-muted-foreground">
                    {r === "admin" && "Accès complet, gestion des utilisateurs"}
                    {r === "direction" && "Vue d'ensemble, validation reversements"}
                    {r === "commercial" && "Prospects, visites, factures d'entrée"}
                    {r === "caisse" && "Encaissements, quittances, baux"}
                    {r === "recouvrement" && "Suivi impayés, relances"}
                    {r === "juridique" && "Mises en demeure, procédures"}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={save}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setForm(emptyForm); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Créer un nouvel utilisateur</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Prénom</Label><Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} /></div>
              <div><Label>Nom</Label><Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} /></div>
            </div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Téléphone</Label><Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} /></div>
            <div>
              <Label>Mot de passe provisoire * <span className="text-xs text-muted-foreground">(8 car. min.)</span></Label>
              <Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <Label>Rôles à attribuer</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ALL_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted cursor-pointer text-sm">
                    <Checkbox checked={form.roles.has(r)} onCheckedChange={() => toggleForm(r)} />
                    <span>{ROLE_LABEL[r]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setForm(emptyForm); }}>Annuler</Button>
            <Button onClick={createUser} disabled={creating}>{creating ? "Création…" : "Créer le compte"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
