import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Building2, User, Lock } from "lucide-react";

export default function Auth() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ─── State connexion ────────────────────────────────────────────────────────
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ─── State inscription (admin seulement) ────────────────────────────────────
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupForm, setSignupForm] = useState({ prenom: "", nom: "", username: "", email: "", password: "", confirm: "" });
  const [signupErr, setSignupErr] = useState("");
  const [signupOk, setSignupOk] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);

  useEffect(() => { if (user) navigate("/"); }, [user, navigate]);

  // ─── Connexion par username ──────────────────────────────────────────────────
  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!username.trim() || !password) { setErr("Nom d'utilisateur et mot de passe requis."); return; }
    setLoading(true);

    // PocketBase accepte le nom d'utilisateur OU l'e-mail comme identifiant :
    // on se connecte directement, sans recherche préalable.
    const { error } = await supabase.auth.signInWithPassword({
      email: username.trim(),
      password,
    });

    setLoading(false);
    if (error) {
      setErr(error.message === "Invalid login credentials"
        ? "Mot de passe incorrect."
        : error.message);
    } else {
      navigate("/");
    }
  };

  // ─── Inscription ─────────────────────────────────────────────────────────────
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupErr("");
    const { prenom, nom, username: un, email, password: pwd, confirm } = signupForm;
    if (!prenom || !nom || !un || !email || !pwd) { setSignupErr("Tous les champs sont obligatoires."); return; }
    if (pwd !== confirm) { setSignupErr("Les mots de passe ne correspondent pas."); return; }
    if (pwd.length < 6) { setSignupErr("Mot de passe : 6 caractères minimum."); return; }
    if (!/^[a-z0-9._-]+$/i.test(un)) { setSignupErr("Username : lettres, chiffres, . _ - seulement."); return; }

    setSignupLoading(true);

    // L'unicité du nom d'utilisateur est garantie par la base :
    // si le nom est déjà pris, la création échouera avec un message explicite.

    const { error } = await supabase.auth.signUp({
      email,
      password: pwd,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nom, prenom, username: un.trim().toLowerCase() },
      },
    });

    setSignupLoading(false);
    if (error) { setSignupErr(error.message); return; }
    setSignupOk(true);
  };

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    width: "100%", padding: "11px 12px 11px 40px", borderRadius: 10,
    border: "1.5px solid #e5e7eb", background: "#fff", color: "#111827",
    fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border .15s",
  };
  const inpSimple: React.CSSProperties = { ...inp, paddingLeft: 12 };
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#374151", letterSpacing: ".03em", display: "block", marginBottom: 6 };
  const btnPrimary: React.CSSProperties = {
    width: "100%", padding: "12px", borderRadius: 10, border: "none",
    background: "#1e3a5f", color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", transition: "opacity .15s", marginTop: 4,
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a9e 50%, #1e3a5f 100%)",
      fontFamily: "'DM Sans', system-ui, sans-serif", padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: "white", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12, boxShadow: "0 4px 20px rgba(0,0,0,.2)" }}>
            <Building2 size={30} color="#1e3a5f" />
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "white", letterSpacing: "-.02em" }}>YapGi Immobilier</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,.6)", marginTop: 4 }}>Système de gestion immobilière</div>
        </div>

        {/* Carte */}
        <div style={{ background: "white", borderRadius: 20, padding: "32px 28px", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>

          {/* Onglets */}
          <div style={{ display: "flex", gap: 4, background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 28 }}>
            {(["login", "signup"] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(""); setSignupErr(""); setSignupOk(false); }}
                style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all .15s",
                  background: mode === m ? "white" : "transparent",
                  color: mode === m ? "#111827" : "#6b7280",
                  boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                }}>
                {m === "login" ? "Connexion" : "Créer un compte"}
              </button>
            ))}
          </div>

          {/* ── Formulaire Connexion ── */}
          {mode === "login" && (
            <form onSubmit={signIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={lbl}>Nom d'utilisateur</label>
                <div style={{ position: "relative" }}>
                  <User size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    autoFocus
                    style={inp}
                    placeholder="ex: hassan.n"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={lbl}>Mot de passe</label>
                <div style={{ position: "relative" }}>
                  <Lock size={15} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input
                    type={showPwd ? "text" : "password"}
                    style={{ ...inp, paddingRight: 40 }}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", display: "flex", alignItems: "center" }}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {err && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626", display: "flex", alignItems: "center", gap: 6 }}>
                  ⚠️ {err}
                </div>
              )}

              <button type="submit" disabled={loading} style={{ ...btnPrimary, opacity: loading ? .7 : 1, cursor: loading ? "wait" : "pointer" }}>
                {loading ? "Connexion en cours…" : "Se connecter"}
              </button>

              <div style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                Contactez votre administrateur pour obtenir vos identifiants.
              </div>
            </form>
          )}

          {/* ── Formulaire Inscription ── */}
          {mode === "signup" && !signupOk && (
            <form onSubmit={signUp} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e" }}>
                ⚠️ La création de compte est réservée à l'administrateur. Le premier compte créé obtient les droits admin.
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Prénom *</label>
                  <input style={inpSimple} value={signupForm.prenom} onChange={e => setSignupForm(f => ({ ...f, prenom: e.target.value }))} required />
                </div>
                <div>
                  <label style={lbl}>Nom *</label>
                  <input style={inpSimple} value={signupForm.nom} onChange={e => setSignupForm(f => ({ ...f, nom: e.target.value }))} required />
                </div>
              </div>

              <div>
                <label style={lbl}>Nom d'utilisateur * <span style={{ color: "#9ca3af", fontWeight: 400 }}>(pour se connecter)</span></label>
                <div style={{ position: "relative" }}>
                  <User size={14} color="#9ca3af" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  <input style={inp} placeholder="ex: hassan.n" value={signupForm.username}
                    onChange={e => setSignupForm(f => ({ ...f, username: e.target.value.toLowerCase() }))}
                    required pattern="[a-zA-Z0-9._\-]+" title="Lettres, chiffres, . _ - seulement" />
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Lettres, chiffres, points et tirets. Pas d'espace.</div>
              </div>

              <div>
                <label style={lbl}>Email * <span style={{ color: "#9ca3af", fontWeight: 400 }}>(pour la récupération)</span></label>
                <input type="email" style={inpSimple} value={signupForm.email} onChange={e => setSignupForm(f => ({ ...f, email: e.target.value }))} required />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={lbl}>Mot de passe *</label>
                  <input type="password" style={inpSimple} value={signupForm.password}
                    onChange={e => setSignupForm(f => ({ ...f, password: e.target.value }))} required minLength={6} />
                </div>
                <div>
                  <label style={lbl}>Confirmer *</label>
                  <input type="password" style={inpSimple} value={signupForm.confirm}
                    onChange={e => setSignupForm(f => ({ ...f, confirm: e.target.value }))} required />
                </div>
              </div>

              {signupErr && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
                  ⚠️ {signupErr}
                </div>
              )}

              <button type="submit" disabled={signupLoading} style={{ ...btnPrimary, opacity: signupLoading ? .7 : 1, cursor: signupLoading ? "wait" : "pointer" }}>
                {signupLoading ? "Création en cours…" : "Créer le compte"}
              </button>
            </form>
          )}

          {/* ── Succès inscription ── */}
          {mode === "signup" && signupOk && (
            <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "10px 0" }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#15803d" }}>Compte créé avec succès !</div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                Un email de confirmation a été envoyé.<br />
                Une fois confirmé, connectez-vous avec votre nom d'utilisateur : <strong style={{ color: "#111827" }}>{signupForm.username}</strong>
              </div>
              <button onClick={() => setMode("login")} style={{ ...btnPrimary, marginTop: 8 }}>
                Aller à la connexion
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "rgba(255,255,255,.4)" }}>
          YapGi Immobilier · Système intégré de gestion
        </div>
      </div>
    </div>
  );
}