import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { signInWithPassword, signUp, sendPasswordReset, user } = useAuth();
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "forgot"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [accountType, setAccountType] = useState("participant"); // "participant" | "organizer"
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "forgot") {
      setLoading(true);
      const { error } = await sendPasswordReset(email);
      setLoading(false);
      if (error) setError(error.message);
      else setInfo("Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé.");
      return;
    }

    if (mode === "signup" && !consent) {
      setError("Merci de cocher la case ci-dessous pour créer un compte.");
      return;
    }

    setLoading(true);
    let result;
    if (mode === "signin") {
      result = await signInWithPassword(email, password);
    } else {
      result = await signUp(email, password, {
        terms_accepted: consent,
        marketing_consent: consent,
        requested_role: accountType,
      });
    }
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }
    if (mode === "signup") {
      setInfo("Compte créé — vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.");
      setPassword("");
    }
  };

  if (user) {
    return (
      <div className="wrap" style={{ paddingTop: 60, maxWidth: 480 }}>
        <p className="muted">Tu es déjà connecté avec {user.email}.</p>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingTop: 60, maxWidth: 420 }}>
      <h1 className="h1">{mode === "signin" ? "Connexion" : mode === "signup" ? "Créer un compte" : "Mot de passe oublié"}</h1>

      {mode !== "forgot" && (
        <div className="auth-mode-toggle">
          <button type="button" className={mode === "signin" ? "active" : ""} onClick={() => { setMode("signin"); setError(null); setInfo(null); }}>
            Connexion
          </button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(null); setInfo(null); }}>
            Créer un compte
          </button>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
      {info && <div className="success-box">{info}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Adresse email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="toi@exemple.fr"
          />
        </div>

        {mode !== "forgot" && (
          <div className="field">
            <label>Mot de passe</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "6 caractères minimum" : ""}
            />
          </div>
        )}

        {mode === "signin" && (
          <button type="button" className="filter-reset" style={{ marginBottom: 16, display: "block" }} onClick={() => { setMode("forgot"); setError(null); setInfo(null); }}>
            Mot de passe oublié ?
          </button>
        )}

        {mode === "signup" && (
          <div className="field">
            <label>Type de compte</label>
            <div className="row" style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className={`chip ${accountType === "participant" ? "chip-active" : ""}`}
                onClick={() => setAccountType("participant")}
              >
                Participant
              </button>
              <button
                type="button"
                className={`chip ${accountType === "organizer" ? "chip-active" : ""}`}
                onClick={() => setAccountType("organizer")}
              >
                Organisateur
              </button>
            </div>
            <div className="field-hint">
              {accountType === "organizer"
                ? "Tu pourras soumettre des courses — elles seront revues par un administrateur avant publication."
                : "Tu pourras suivre des courses, laisser des avis et tenir ton palmarès."}
            </div>
          </div>
        )}

        {mode === "signup" && (
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              J'accepte les <Link to="/rules" target="_blank" rel="noopener noreferrer">règles de bonne conduite</Link> du
              site et la <Link to="/cookies" target="_blank" rel="noopener noreferrer">politique de cookies</Link>, et
              j'autorise UltraRide à m'envoyer des communications par email (nouvelles courses, actualités du site).
              <span style={{ color: "var(--brick)" }}> *</span>
            </span>
          </label>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "…" : mode === "signin" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien de réinitialisation"}
        </button>
      </form>

      {mode === "forgot" ? (
        <button type="button" className="filter-reset" style={{ marginTop: 14 }} onClick={() => { setMode("signin"); setError(null); setInfo(null); }}>
          ← Retour à la connexion
        </button>
      ) : (
        <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
          {mode === "signin"
            ? "Organisateur ou administrateur, utilise l'email associé à ton compte."
            : "Un simple visiteur qui veut laisser un avis doit créer un compte de cette façon."}
        </p>
      )}
    </div>
  );
}
