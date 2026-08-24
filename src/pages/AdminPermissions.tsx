import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ALL_MODULES, ALL_ROLES, MODULE_LABELS, refreshPermissions, type AppModule, type AppRole } from "@/hooks/usePermissions";

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin", direction: "Direction", commercial: "Commercial",
  caisse: "Caisse", recouvrement: "Recouvrement", juridique: "Juridique",
};

const ACTIONS = [
  { key: "can_view", label: "Voir" },
  { key: "can_create", label: "Créer" },
  { key: "can_edit", label: "Modifier" },
  { key: "can_delete", label: "Supprimer" },
] as const;

interface RolePerm { id?: string; role: AppRole; module: string; can_view: boolean; can_create: boolean; can_edit: boolean; can_delete: boolean; }
interface FieldPerm { id?: string; role: AppRole; module: string; field: string; visible: boolean; editable: boolean; required: boolean; }

export default function AdminPermissions() {
  const { hasRole, loading: authLoading } = useAuth();
  const [rolePerms, setRolePerms] = useState<RolePerm[]>([]);
  const [fieldPerms, setFieldPerms] = useState<FieldPerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState<AppRole>("direction");
  const [newField, setNewField] = useState({ role: "direction" as AppRole, module: "locataires" as AppModule, field: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: rp }, { data: fp }] = await Promise.all([
      supabase.from("role_permissions").select("*"),
      supabase.from("field_permissions").select("*"),
    ]);
    setRolePerms((rp as any) ?? []);
    setFieldPerms((fp as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { if (!authLoading && hasRole("admin")) load(); }, [authLoading, hasRole]);
  if (!authLoading && !hasRole("admin")) return <Navigate to="/" replace />;

  const getRP = (role: AppRole, module: AppModule): RolePerm => {
    return rolePerms.find(p => p.role === role && p.module === module)
      ?? { role, module, can_view: false, can_create: false, can_edit: false, can_delete: false };
  };

  const toggleRP = (role: AppRole, module: AppModule, action: typeof ACTIONS[number]["key"]) => {
    setRolePerms(prev => {
      const idx = prev.findIndex(p => p.role === role && p.module === module);
      if (idx === -1) {
        return [...prev, { role, module, can_view: false, can_create: false, can_edit: false, can_delete: false, [action]: true } as RolePerm];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], [action]: !(next[idx] as any)[action] };
      return next;
    });
  };

  const toggleFP = (id: string | undefined, role: AppRole, module: string, field: string, key: "visible"|"editable"|"required") => {
    setFieldPerms(prev => {
      const idx = prev.findIndex(p => (id && p.id === id) || (p.role === role && p.module === module && p.field === field));
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: !next[idx][key] };
      return next;
    });
  };

  const addField = () => {
    if (!newField.field.trim()) return toast.error("Nom du champ requis");
    if (fieldPerms.some(p => p.role === newField.role && p.module === newField.module && p.field === newField.field.trim())) {
      return toast.error("Ce champ existe déjà pour ce rôle et module");
    }
    setFieldPerms(prev => [...prev, { role: newField.role, module: newField.module, field: newField.field.trim(), visible: true, editable: true, required: false }]);
    setNewField({ ...newField, field: "" });
  };

  const removeField = (p: FieldPerm) => {
    setFieldPerms(prev => prev.filter(x => x !== p && !(p.id && x.id === p.id)));
  };

  const save = async () => {
    setSaving(true);
    const rpRows = rolePerms.map(({ id, ...r }) => r);
    const fpRows = fieldPerms.map(({ id, ...r }) => r);

    const { error: e1 } = await supabase.from("role_permissions").upsert(rpRows as any, { onConflict: "role,module" });
    if (e1) { setSaving(false); return toast.error(e1.message); }

    // Delete removed field perms
    const { data: existingFP } = await supabase.from("field_permissions").select("id, role, module, field");
    const keepKeys = new Set(fieldPerms.map(p => `${p.role}|${p.module}|${p.field}`));
    const toDelete = (existingFP ?? []).filter((p: any) => !keepKeys.has(`${p.role}|${p.module}|${p.field}`));
    if (toDelete.length) {
      const { error } = await supabase.from("field_permissions").delete().in("id", toDelete.map((x: any) => x.id));
      if (error) { setSaving(false); return toast.error(error.message); }
    }

    const { error: e2 } = await supabase.from("field_permissions").upsert(fpRows as any, { onConflict: "role,module,field" });
    if (e2) { setSaving(false); return toast.error(e2.message); }

    await refreshPermissions();
    setSaving(false);
    toast.success("Permissions enregistrées");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><ShieldCheck className="h-7 w-7" />Permissions des rôles</h1>
          <p className="text-muted-foreground">Configurez les accès aux modules et la gestion des champs par rôle</p>
        </div>
        <Button onClick={save} disabled={saving || loading}><Save className="h-4 w-4 mr-2" />{saving ? "Enregistrement…" : "Enregistrer"}</Button>
      </div>

      <Tabs defaultValue="modules">
        <TabsList>
          <TabsTrigger value="modules">Matrice modules × rôles</TabsTrigger>
          <TabsTrigger value="fields">Champs par rôle</TabsTrigger>
        </TabsList>

        <TabsContent value="modules">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Module</TableHead>
                  {ALL_ROLES.map(r => (
                    <TableHead key={r} className="text-center min-w-[200px]">{ROLE_LABEL[r]}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && <TableRow><TableCell colSpan={ALL_ROLES.length + 1} className="text-center py-6 text-muted-foreground">Chargement…</TableCell></TableRow>}
                {!loading && ALL_MODULES.map(m => (
                  <TableRow key={m}>
                    <TableCell className="font-medium">{MODULE_LABELS[m]}<div className="text-xs text-muted-foreground font-mono">{m}</div></TableCell>
                    {ALL_ROLES.map(r => {
                      const p = getRP(r, m);
                      const isAdmin = r === "admin";
                      return (
                        <TableCell key={r} className="text-center">
                          <div className="grid grid-cols-4 gap-1 text-[10px]">
                            {ACTIONS.map(a => (
                              <label key={a.key} className="flex flex-col items-center gap-0.5 cursor-pointer">
                                <Checkbox checked={isAdmin ? true : (p as any)[a.key]} disabled={isAdmin} onCheckedChange={() => toggleRP(r, m, a.key)} />
                                <span className="text-muted-foreground">{a.label}</span>
                              </label>
                            ))}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Ajouter une règle de champ</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <Label>Rôle</Label>
                  <Select value={newField.role} onValueChange={(v) => setNewField({ ...newField, role: v as AppRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ALL_ROLES.filter(r => r !== "admin").map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Module</Label>
                  <Select value={newField.module} onValueChange={(v) => setNewField({ ...newField, module: v as AppModule })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ALL_MODULES.map(m => <SelectItem key={m} value={m}>{MODULE_LABELS[m]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nom du champ</Label>
                  <Input value={newField.field} onChange={(e) => setNewField({ ...newField, field: e.target.value })} placeholder="ex: loyer_mensuel" />
                </div>
                <Button onClick={addField}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Le nom du champ doit correspondre à la clé technique utilisée dans le formulaire concerné.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Règles configurées</CardTitle>
                <Select value={activeRole} onValueChange={(v) => setActiveRole(v as AppRole)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>{ALL_ROLES.filter(r => r !== "admin").map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Champ</TableHead>
                  <TableHead className="text-center">Visible</TableHead>
                  <TableHead className="text-center">Éditable</TableHead>
                  <TableHead className="text-center">Obligatoire</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {fieldPerms.filter(p => p.role === activeRole).length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucune règle pour ce rôle</TableCell></TableRow>
                  )}
                  {fieldPerms.filter(p => p.role === activeRole).map((p, i) => (
                    <TableRow key={p.id ?? `${p.role}-${p.module}-${p.field}-${i}`}>
                      <TableCell>{MODULE_LABELS[p.module as AppModule] ?? p.module}</TableCell>
                      <TableCell className="font-mono text-xs">{p.field}</TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.visible} onCheckedChange={() => toggleFP(p.id, p.role, p.module, p.field, "visible")} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.editable} onCheckedChange={() => toggleFP(p.id, p.role, p.module, p.field, "editable")} /></TableCell>
                      <TableCell className="text-center"><Checkbox checked={p.required} onCheckedChange={() => toggleFP(p.id, p.role, p.module, p.field, "required")} /></TableCell>
                      <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => removeField(p)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
