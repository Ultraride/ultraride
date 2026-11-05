import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { ROLES, CheckIcon } from "./Login";

// Premier passage d'un compte créé via Google / Apple : il n'a encore choisi
// ni son rôle ni accepté les CGU. Une seule fois (RPC complete_oauth_onboarding).
export default function Welcome() {
  const { user, needsOnboarding, completeOnboarding, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("participant");
  const [terms, setTerms] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!needsOnboarding) return <Navigate to="/account" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (!terms) {
      setError("Merci d'accepter les CGU, la politique de confidentialité et les règles pour continuer.");
      return;
    }
    setSaving(true);
    setError(null);
    const { error } = await completeOnboarding({ role, terms, marketing: newsletter });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate(role === "organizer" ? "/organizer/profile" : "/account", { replace: true });
  };

  return (
    <main className="v2-wrap auth-page">
      <div className="auth-shell auth-shell-single">
        <section className="auth-main">
          <div className="auth-forgot-head">
            <h2 className="auth-h2">Bienvenue sur UltraRide</h2>
            <p>Connecté avec <strong>{user.email}</strong>. Dernière étape : tu viens sur UltraRide en tant que…</p>
          </div>
          {error && <div className="error-box" role="alert">{error}</div>}
          <form onSubmit={submit} className="auth-form">
            <div className="auth-roles" role="radiogroup" aria-label="Type de compte">
              {ROLES.map((r) => (
                <button key={r.id} type="button" role="radio" aria-checked={role === r.id} className="auth-role" onClick={() => setRole(r.id)}>
                  <span className="auth-role-top">
                    <span className="auth-role-icon" aria-hidden="true">{r.icon}</span>
                    <span className="auth-radio" aria-hidden="true" />
                  </span>
                  <span className="auth-role-title">{r.title}</span>
                  <span className="auth-role-text">{r.text}</span>
                </button>
              ))}
            </div>
            <label className="auth-check">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span className="auth-box" aria-hidden="true"><CheckIcon /></span>
              <span>
                J'accepte les <Link to="/cgu" target="_blank" rel="noopener noreferrer">CGU</Link>, la{" "}
                <Link to="/confidentialite" target="_blank" rel="noopener noreferrer">politique de confidentialité</Link> et les{" "}
                <Link to="/rules" target="_blank" rel="noopener noreferrer">règles de bonne conduite</Link>.
                <span className="auth-req"> *</span>
              </span>
            </label>
            <label className="auth-check">
              <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
              <span className="auth-box" aria-hidden="true"><CheckIcon /></span>
              <span>Recevoir les nouveaux ultras et les actualités par email <span className="auth-muted">(facultatif)</span></span>
            </label>
            <button className="v2-btn v2-btn-rust auth-submit" type="submit" disabled={saving}>
              {saving ? "…" : "C'est parti"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
