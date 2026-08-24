import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { ModuleGate } from "@/components/ModuleGate";
import type { AppModule } from "@/hooks/usePermissions";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Caisse from "./pages/Caisse";
import Recouvrement from "./pages/Recouvrement";
import Biens from "./pages/Biens";
import Locataires from "./pages/Locataires";
import Baux from "./pages/Baux";
import Proprietaires from "./pages/Proprietaires";
import Reddition from "./pages/Reddition";
import Commercial from "./pages/Commercial";
import Juridique from "./pages/Juridique";
import ModelesRelance from "./pages/ModelesRelance";
import AdminUsers from "./pages/AdminUsers";
import AdminPermissions from "./pages/AdminPermissions";
import SuiviLocataires from "./pages/SuiviLocataires";
import Imports from "./pages/Imports";
import Exports from "./pages/Exports";
import CourriersRecus from "./pages/CourriersRecus";
import Courriers from "./pages/Courriers";
import ModelesCourrier from "./pages/ModelesCourrier";
import ReponsesCourriers from "./pages/ReponsesCourriers";
import FicheLocataire from "./pages/FicheLocataire";
import FicheProprietaire from "./pages/FicheProprietaire";
import AuditLog from "./pages/AuditLog";
import Soon from "./pages/Soon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children, module }: { children: JSX.Element; module?: AppModule }) => (
  <ProtectedRoute><AppLayout>{module ? <ModuleGate module={module}>{children}</ModuleGate> : children}</AppLayout></ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/caisse" element={<Protected module="caisse"><Caisse /></Protected>} />
            <Route path="/recouvrement" element={<Protected module="recouvrement"><Recouvrement /></Protected>} />
            <Route path="/biens" element={<Protected module="biens"><Biens /></Protected>} />
            <Route path="/locataires" element={<Protected module="locataires"><Locataires /></Protected>} />
            <Route path="/locataires/:id" element={<Protected module="locataires"><FicheLocataire /></Protected>} />
            <Route path="/baux" element={<Protected module="baux"><Baux /></Protected>} />
            <Route path="/proprietaires" element={<Protected module="proprietaires"><Proprietaires /></Protected>} />
            <Route path="/proprietaires/:id" element={<Protected module="proprietaires"><FicheProprietaire /></Protected>} />
            <Route path="/reddition" element={<Protected module="reddition"><Reddition /></Protected>} />
            <Route path="/juridique" element={<Protected module="juridique"><Juridique /></Protected>} />
            <Route path="/commercial" element={<Protected module="commercial"><Commercial /></Protected>} />
            <Route path="/modeles-relance" element={<Protected module="modeles_relance"><ModelesRelance /></Protected>} />
            <Route path="/admin/users" element={<Protected><AdminUsers /></Protected>} />
            <Route path="/admin/permissions" element={<Protected><AdminPermissions /></Protected>} />
            <Route path="/admin/audit" element={<Protected><AuditLog /></Protected>} />
            <Route path="/suivi-locataires" element={<Protected module="suivi_locataires"><SuiviLocataires /></Protected>} />
            <Route path="/imports" element={<Protected module="imports"><Imports /></Protected>} />
            <Route path="/exports" element={<Protected module="exports"><Exports /></Protected>} />
            <Route path="/courriers-recus" element={<Protected module="courriers_recus"><CourriersRecus /></Protected>} />
            <Route path="/courriers" element={<Protected module="courriers"><Courriers /></Protected>} />
            <Route path="/modeles-courrier" element={<Protected module="modeles_courrier"><ModelesCourrier /></Protected>} />
            <Route path="/reponses-courriers" element={<Protected module="reponses_courriers"><ReponsesCourriers /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;