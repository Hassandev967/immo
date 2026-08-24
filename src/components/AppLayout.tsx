import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export const AppLayout = ({ children }: { children: ReactNode }) => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b bg-card flex items-center px-4 gap-3 sticky top-0 z-10">
          <SidebarTrigger />
          <div className="font-semibold">Système Intégré de Gestion Immobilière</div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  </SidebarProvider>
);
