import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Filet de sécurité au niveau de l'app : sans ça, la moindre exception
 * pendant un rendu (ex: accès à un champ manquant sur une donnée API)
 * fait disparaître silencieusement toute l'interface (écran blanc),
 * sans aucun message pour l'utilisateur ni trace exploitable côté UI.
 *
 * A envelopper autour de <Routes /> (ou de chaque route) dans App.tsx.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Erreur de rendu interceptée :", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, maxWidth: 640, margin: "48px auto", fontFamily: "sans-serif" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Une erreur est survenue sur cette page
          </h1>
          <p style={{ color: "#666", marginBottom: 16 }}>
            L'équipe technique peut consulter les détails ci-dessous. Vous pouvez essayer de
            revenir au tableau de bord.
          </p>
          <pre
            style={{
              background: "#f5f5f5",
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
              overflow: "auto",
              marginBottom: 16,
            }}
          >
            {this.state.error?.message}
          </pre>
          <a href="#/" style={{ color: "#1e3a5f", fontWeight: 600 }}>
            ← Retour au tableau de bord
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
