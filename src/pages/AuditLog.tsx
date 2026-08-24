import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClipboardList, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type LogEntry = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  changed_fields: string[] | null;
  old_values: any;
  new_values: any;
  user_id: string | null;
  created_at: string;
};

const ACTION_COLORS: Record<string, string> = {
  INSERT: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

const TABLE_LABELS: Record<string, string> = {
  baux: "Baux",
  paiements: "Paiements",
  modeles_courrier: "Modèles courrier",
  proprietaires: "Propriétaires",
  locataires: "Locataires",
};

export default function AuditLog() {
  const { hasRole } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTable, setFilterTable] = useState("all");
  const [filterAction, setFilterAction] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!error) setLogs((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  if (!hasRole("admin") && !hasRole("direction")) {
    return (
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>Accès réservé aux administrateurs et à la direction.</AlertDescription>
      </Alert>
    );
  }

  const filtered = logs.filter(l => {
    if (filterTable !== "all" && l.table_name !== filterTable) return false;
    if (filterAction !== "all" && l.action !== filterAction) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.table_name.toLowerCase().includes(q) &&
          !(l.record_id ?? "").toLowerCase().includes(q) &&
          !(l.user_id ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const tables = [...new Set(logs.map(l => l.table_name))].sort();

  const formatValue = (v: any): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v, null, 0).slice(0, 120);
    return String(v);
  };

  const renderChangedFields = (entry: LogEntry) => {
    if (!entry.changed_fields?.length) return null;
    const sensitiveFields = ["rib", "loyer_mensuel", "caution", "taux_honoraires", "transfere_juridique_le"];
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {entry.changed_fields.map(f => (
          <span key={f} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${sensitiveFields.includes(f) ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"}`}>
            {f}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Journal d'audit</h1>
          <p className="text-muted-foreground text-sm">Traçabilité immuable de toutes les opérations sensibles — non modifiable, non supprimable</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Rechercher (table, ID utilisateur…)"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Table" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les tables</SelectItem>
            {tables.map(t => <SelectItem key={t} value={t}>{TABLE_LABELS[t] ?? t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes actions</SelectItem>
            <SelectItem value="INSERT">Création</SelectItem>
            <SelectItem value="UPDATE">Modification</SelectItem>
            <SelectItem value="DELETE">Suppression</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground self-center">{filtered.length} entrée(s)</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Historique des opérations
          </CardTitle>
          <CardDescription>
            Les champs en orange sont des champs financiers ou de transfert critiques.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Date / Heure</TableHead>
                <TableHead className="w-28">Action</TableHead>
                <TableHead className="w-32">Table</TableHead>
                <TableHead>Champs modifiés</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead className="w-28">ID Enregistrement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Chargement du journal…</TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucune entrée dans le journal.</TableCell>
                </TableRow>
              )}
              {filtered.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
                  </TableCell>
                  <TableCell>
                    <Badge className={ACTION_COLORS[entry.action] ?? ""} variant="outline">
                      {entry.action === "INSERT" ? "Création" : entry.action === "UPDATE" ? "Modification" : "Suppression"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium">{TABLE_LABELS[entry.table_name] ?? entry.table_name}</TableCell>
                  <TableCell>
                    {entry.action === "UPDATE" && renderChangedFields(entry)}
                    {entry.action === "INSERT" && <span className="text-xs text-muted-foreground italic">Nouvel enregistrement</span>}
                    {entry.action === "DELETE" && <span className="text-xs text-destructive italic">Enregistrement supprimé</span>}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {entry.user_id ? entry.user_id.slice(0, 8) + "…" : <span className="italic">système</span>}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {entry.record_id ? entry.record_id.slice(0, 8) + "…" : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
