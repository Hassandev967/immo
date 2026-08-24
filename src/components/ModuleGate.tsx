import { Navigate } from "react-router-dom";
import { usePermissions, type AppModule } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";

export const ModuleGate = ({ module, children }: { module: AppModule; children: JSX.Element }) => {
  const { can, ready, isAdmin } = usePermissions();
  const { loading } = useAuth();

  // Attendre que l'auth ET les permissions soient chargées
  if (loading || !ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh", color: "#9ca3af", fontSize: 14 }}>
        Chargement…
      </div>
    );
  }

  if (isAdmin) return children;
  if (!can(module, "view")) return <Navigate to="/" replace />;
  return children;
};
