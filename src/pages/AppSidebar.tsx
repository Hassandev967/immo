import { LayoutDashboard, Wallet, AlertTriangle, Scale, Home, Building2, Users, FileText, LogOut, Briefcase, Coins, MessageSquare, ShieldCheck, UserCheck, Upload, Download, UserCog, Inbox, Mail, FileSignature, Reply, ClipboardList } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { usePermissions, type AppModule } from "@/hooks/usePermissions";

const mainNav = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard, module: "dashboard" as AppModule },
];

const services = [
  { title: "Commercial", url: "/commercial", icon: Briefcase, module: "commercial" as AppModule },
  { title: "Caisse", url: "/caisse", icon: Wallet, module: "caisse" as AppModule },
  { title: "Recouvrement", url: "/recouvrement", icon: AlertTriangle, module: "recouvrement" as AppModule },
  { title: "Suivi locataires", url: "/suivi-locataires", icon: UserCheck, module: "suivi_locataires" as AppModule },
  { title: "Juridique", url: "/juridique", icon: Scale, module: "juridique" as AppModule },
  { title: "Préavis & réclamations", url: "/courriers-recus", icon: Inbox, module: "courriers_recus" as AppModule },
  { title: "Réponses aux courriers", url: "/reponses-courriers", icon: Reply, module: "reponses_courriers" as AppModule },
  { title: "Courriers juridiques", url: "/courriers", icon: Mail, module: "courriers" as AppModule },
  { title: "Reddition propriétaires", url: "/reddition", icon: Coins, module: "reddition" as AppModule },
];

const referentiels = [
  { title: "Parc immobilier", url: "/biens", icon: Building2, module: "biens" as AppModule },
  { title: "Propriétaires", url: "/proprietaires", icon: UserCog, module: "proprietaires" as AppModule },
  { title: "Locataires", url: "/locataires", icon: Users, module: "locataires" as AppModule },
  { title: "Bail", url: "/baux", icon: FileText, module: "baux" as AppModule },
  { title: "Modèles de relance", url: "/modeles-relance", icon: MessageSquare, module: "modeles_relance" as AppModule },
  { title: "Modèles de courriers", url: "/modeles-courrier", icon: FileSignature, module: "modeles_courrier" as AppModule },
];

const donnees = [
  { title: "Imports", url: "/imports", icon: Upload, module: "imports" as AppModule },
  { title: "Rapports & Exports", url: "/exports", icon: Download, module: "exports" as AppModule },
];

const adminNav = [
  { title: "Utilisateurs & rôles", url: "/admin/users", icon: ShieldCheck, module: "admin_users" as AppModule },
  { title: "Permissions", url: "/admin/permissions", icon: ShieldCheck, module: "admin_permissions" as AppModule },
  { title: "Journal d'audit", url: "/admin/audit", icon: ClipboardList, module: "audit_log" as AppModule },
];

export const AppSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut, user, hasRole } = useAuth();
  const { can } = usePermissions();
  const filter = (items: any[]) => items.filter(i => can(i.module, "view"));

  const renderItem = (item: any) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild isActive={location.pathname === item.url}>
        <NavLink to={item.url} end>
          <item.icon className="h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
          {!collapsed && item.soon && <span className="ml-auto text-[10px] uppercase opacity-60">bientôt</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg bg-white grid place-items-center overflow-hidden shrink-0">
            <img src="/logo-yapgi.jpg" alt="YapGi Immobilier" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-bold text-sidebar-foreground">YapGi Immobilier</div>
              <div className="text-[10px] text-sidebar-foreground/60">Location · Vente · Gérance</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {filter(mainNav).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Pilotage</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{filter(mainNav).map(renderItem)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        )}

        {filter(services).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Services</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{filter(services).map(renderItem)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        )}

        {filter(referentiels).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Référentiels</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{filter(referentiels).map(renderItem)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        )}

        {filter(donnees).length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Données</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{filter(donnees).map(renderItem)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        )}

        {hasRole("admin") && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{adminNav.map(renderItem)}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && user && (
          <div className="text-xs text-sidebar-foreground/70 px-2 pb-2 truncate">{user.email}</div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Déconnexion</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
};
