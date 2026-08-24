import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function Soon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">{title}</h1><p className="text-muted-foreground text-sm">{description}</p></div>
      <Card>
        <CardHeader>
          <Construction className="h-10 w-10 text-muted-foreground mb-2" />
          <CardTitle>Module en construction</CardTitle>
          <CardDescription>Ce module sera disponible dans la prochaine itération. Le cœur métier (Caisse, Recouvrement, Référentiels) est opérationnel.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Demandez la suite : « Construis le module Juridique » ou « Ajoute la facture d'entrée au Service Commercial ».
        </CardContent>
      </Card>
    </div>
  );
}
