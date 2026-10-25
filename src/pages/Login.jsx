import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, passwordErrorMessage } from "../lib/passwordRules";

const PERKS = [
  ["Tes favoris et leurs dates", "Garde tes ultras en vue et retrouve leurs dates en un coup d'œil."],
  ["Ton palmarès", "Ajoute tes ultras terminés avec ta trace .FIT et télécharge ton passeport en PDF."],
  ["Ton avis compte", "Partage ton expérience sur les épreuves que tu as roulées."],
  ["Organisateurs", "Publie et mets à jour tes ultras, avec ton logo sur chaque fiche."],
];

const ROLES = [
  { id: "participant", icon: "🚴", title: "Participant", text: "Favoris, avis, palmarès et passeport PDF." },
  { id: "organizer", icon: "🏁", title: "Organisateur", text: "Je publie et je mets à jour mes ultras." },
];

// Les 4 critères de Supabase > Authentication > Policies (voir passwordRules).
function passwordScore(pw) {
  if (!pw) return 0;
  return [pw.length >= PASSWORD_MIN_LENGTH, /[a-z]/.test(pw), /[A-Z]/.test(pw), /\d/.test(pw)].filter(Boolean).length;
}
const SCORE_LABEL = ["", "Faible", "Faible", "Moyen", "Solide"];

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function Login() {
  const { signInWithPassword, signUp, sendPasswordReset, user } = useAuth();
  const [searchParams] = useSearchParams();
  // /login?mode=signup ouvre directement l'onglet « Créer un compte ».
  const [mode, setMode] = useState(searchParams.get("mode") === "signup" ? "signup" : "signin"); // signin | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // RGPD : CGU obligatoires, newsletter facultative et décochée par défaut.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [accountType, setAccountType] = useState("participant");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    supabase
      .from("races")
      .select("country")
      .eq("status", "published")
      .eq("is_current", true)
      .then(({ data }) => {
        if (!data) return;
        setStats({ ultras: data.length, countries: new Set(data.map((r) => r.country).filter(Boolean)).size });
      });
  }, []);

  const switchMode = (m) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

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

    if (mode === "signup" && !termsAccepted) {
      setError("Merci d'accepter les CGU, la politique de confidentialité et les règles pour créer un compte.");
      return;
    }

    setLoading(true);
    const result =
      mode === "signin"
        ? await signInWithPassword(email, password)
        : await signUp(email, password, {
            terms_accepted: termsAccepted,
            marketing_consent: newsletter,
            requested_role: accountType,
          });
    setLoading(false);

    if (result.error) {
      setError(mode === "signup" ? passwordErrorMessage(result.error) : result.error.message);
      return;
    }
    if (mode === "signup") {
      setInfo("Compte créé — vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.");
      setPassword("");
    }
  };

  if (user) {
    return (
      <main className="v2-wrap auth-done">
        <p>Tu es connecté avec <strong>{user.email}</strong>.</p>
        <Link to="/account" className="v2-btn v2-btn-rust">Mon passeport</Link>
      </main>
    );
  }

  const score = passwordScore(password);

  return (
    <main className="v2-wrap auth-page">
      <div className="auth-shell">
        <section className="auth-aside">
          <svg className="auth-contours" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
            {[760, 700, 640, 580].map((y) => (
              <path key={y} d={`M-20 ${y} C 120 ${y - 60}, 220 ${y + 40}, 360 ${y - 30} S 560 ${y - 140}, 640 ${y - 100}`} />
            ))}
          </svg>
          <div className="auth-aside-head">
            <span className="auth-eyebrow">TON PASSEPORT ULTRA</span>
            <h1 className="auth-title">SUIS TES ULTRAS.<br />TIENS TON PALMARÈS.</h1>
          </div>
          <ul className="auth-perks">
            {PERKS.map(([title, text]) => (
              <li key={title}>
                <span className="auth-perk-ico"><Check /></span>
                <div>
                  <div className="auth-perk-title">{title}</div>
                  <div className="auth-perk-text">{text}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="auth-stats">
            <span><b>{stats ? stats.ultras : "—"}</b>ULTRAS</span>
            <span><b>{stats ? stats.countries : "—"}</b>PAYS</span>
            <span><b>0 €</b>POUR TOUS</span>
          </div>
        </section>

        <section className="auth-main">
          {mode === "forgot" ? (
            <div className="auth-forgot-head">
              <h2 className="auth-h2">Mot de passe oublié</h2>
              <p>Saisis l'adresse de ton compte : on t'envoie un lien pour en choisir un nouveau.</p>
            </div>
          ) : (
            <div role="tablist" className="auth-tabs">
              <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => switchMode("signin")}>Connexion</button>
              <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => switchMode("signup")}>Créer un compte</button>
            </div>
          )}

          {error && <div className="error-box" role="alert">{error}</div>}
          {info && <div className="success-box" role="status">{info}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            {mode === "signup" && (
              <div className="auth-field">
                <span className="auth-label" id="role-label">Je suis</span>
                <div className="auth-roles" role="radiogroup" aria-labelledby="role-label">
                  {ROLES.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={accountType === r.id}
                      className="auth-role"
                      onClick={() => setAccountType(r.id)}
                    >
                      <span className="auth-role-top">
                        <span className="auth-role-icon" aria-hidden="true">{r.icon}</span>
                        <span className="auth-radio" aria-hidden="true" />
                      </span>
                      <span className="auth-role-title">{r.title}</span>
                      <span className="auth-role-text">{r.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="auth-field">
              <span className="auth-label">Adresse email</span>
              <input
                className="auth-input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="toi@exemple.fr"
              />
            </label>

            {mode !== "forgot" && (
              <div className="auth-field">
                <span className="auth-label-row">
                  <label className="auth-label" htmlFor="auth-password">Mot de passe</label>
                  {mode === "signin" && (
                    <button type="button" className="auth-textlink" onClick={() => switchMode("forgot")}>Mot de passe oublié ?</button>
                  )}
                </span>
                <div className="auth-input auth-input-pw">
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    required
                    // Seulement à l'inscription : les comptes créés avant la règle
                    // des 12 caractères doivent pouvoir se connecter.
                    minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button type="button" className="auth-textlink" onClick={() => setShowPassword((s) => !s)}>
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
                {mode === "signup" && (
                  <>
                    <div className={`auth-meter s${score}`} aria-hidden="true">
                      {[1, 2, 3, 4].map((i) => <span key={i} className={i <= score ? "on" : ""} />)}
                    </div>
                    <span className="auth-hint">
                      {score > 0 && <strong>{SCORE_LABEL[score]} · </strong>}
                      {PASSWORD_HINT}.
                    </span>
                  </>
                )}
              </div>
            )}

            {mode === "signup" && (
              <>
                <label className="auth-check">
                  <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
                  <span className="auth-box" aria-hidden="true"><Check /></span>
                  <span>
                    J'accepte les <Link to="/cgu" target="_blank" rel="noopener noreferrer">CGU</Link>, la{" "}
                    <Link to="/confidentialite" target="_blank" rel="noopener noreferrer">politique de confidentialité</Link> et les{" "}
                    <Link to="/rules" target="_blank" rel="noopener noreferrer">règles de bonne conduite</Link>.
                    <span className="auth-req"> *</span>
                  </span>
                </label>
                <label className="auth-check">
                  <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
                  <span className="auth-box" aria-hidden="true"><Check /></span>
                  <span>Recevoir les nouveaux ultras et les actualités par email <span className="auth-muted">(facultatif)</span></span>
                </label>
              </>
            )}

            <button className="v2-btn v2-btn-rust auth-submit" type="submit" disabled={loading}>
              {loading ? "…" : mode === "signin" ? "Se connecter" : mode === "signup" ? "Créer mon compte" : "Envoyer le lien"}
            </button>
          </form>

          <p className="auth-foot">
            {mode === "signin" && (
              <>Pas encore de compte ? <button type="button" className="auth-textlink" onClick={() => switchMode("signup")}>Créer un compte</button></>
            )}
            {mode === "signup" && (
              <>Déjà un compte ? <button type="button" className="auth-textlink" onClick={() => switchMode("signin")}>Se connecter</button></>
            )}
            {mode === "forgot" && (
              <button type="button" className="auth-textlink" onClick={() => switchMode("signin")}>← Retour à la connexion</button>
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
