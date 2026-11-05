import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { supabase } from "../lib/supabaseClient";
import { getEnabledProviders, rememberAfterLogin, authErrorFr } from "../lib/authProviders";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, passwordErrorMessage } from "../lib/passwordRules";

const PERKS = [
  ["Tes favoris et leurs dates", "Garde tes ultras en vue et retrouve leurs dates en un coup d'œil."],
  ["Ton palmarès", "Ajoute tes ultras terminés avec ta trace .FIT et télécharge ton passeport en PDF."],
  ["Ton avis compte", "Partage ton expérience sur les épreuves que tu as roulées."],
  ["Organisateurs", "Publie et mets à jour tes ultras, avec ton logo sur chaque fiche."],
];

export const ROLES = [
  { id: "participant", icon: "🚴", title: "Participant", text: "Favoris, avis, palmarès et passeport PDF." },
  { id: "organizer", icon: "🏁", title: "Organisateur", text: "Je publie et je mets à jour mes ultras." },
];

// Les 4 critères de Supabase > Authentication > Policies (voir passwordRules).
function passwordScore(pw) {
  if (!pw) return 0;
  return [pw.length >= PASSWORD_MIN_LENGTH, /[a-z]/.test(pw), /[A-Z]/.test(pw), /\d/.test(pw)].filter(Boolean).length;
}
const SCORE_LABEL = ["", "Faible", "Faible", "Moyen", "Solide"];

export function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 814 1000" aria-hidden="true" fill="currentColor">
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105.6-57-155.5-127C46.7 790.7 0 663 0 541.8c0-194.4 126.4-297.5 250.8-297.5 66.1 0 121.2 43.4 162.7 43.4 39.5 0 101.1-46 176.3-46 28.5 0 130.9 2.6 198.3 99.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z" />
    </svg>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

const OTP_LENGTH = 6;
const RESEND_DELAY = 60;

export default function Login() {
  const { signInWithPassword, signUp, sendPasswordReset, signInWithProvider, sendEmailCode, verifyEmailCode, user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // ?next=/courses/123#avis : où revenir après connexion (chemins internes uniquement).
  const rawNext = searchParams.get("next") || "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const location = useLocation();
  const [providers, setProviders] = useState({ google: false, apple: false });
  // Mot de passe replié par défaut : le code par email est la voie principale.
  const [usePassword, setUsePassword] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState(null); // email auquel le code a été envoyé
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // /login?mode=signup ouvre directement l'onglet « Créer un compte ».
  const [mode, setMode] = useState(searchParams.get("mode") === "signup" ? "signup" : "signin"); // signin | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // RGPD : CGU obligatoires, newsletter facultative et décochée par défaut.
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [accountType, setAccountType] = useState("participant");
  const [error, setError] = useState(searchParams.get("erreur"));
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

  useEffect(() => {
    if (user && next) navigate(next, { replace: true });
  }, [user, next, navigate]);

  // Arrivée depuis un lien précis (avis, favori…) : le formulaire est en haut, on y va.
  useEffect(() => {
    if (!next) return;
    // On s'arrête sous l'en-tête collant (barre d'état iOS comprise), sinon
    // les onglets « Connexion / Créer un compte » passent dessous.
    const el = document.querySelector(".auth-main");
    if (!el) return;
    const headerH = document.querySelector("header.site")?.offsetHeight || 0;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH - 12;
    window.scrollTo(0, Math.max(0, top));
  }, [next]);

  const signinErrorMessage = (err) => {
    const msg = err?.message || "";
    if (err?.code === "invalid_credentials" || /Invalid login credentials/i.test(msg)) return "Email ou mot de passe incorrect.";
    if (err?.code === "email_not_confirmed" || /Email not confirmed/i.test(msg)) return "Ton adresse n'est pas encore confirmée : clique sur le lien reçu par email.";
    return msg;
  };

  useEffect(() => {
    getEnabledProviders().then(setProviders);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const switchMode = (m) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const afterLoginPath = () => next || location.state?.from || "/account";

  const handleProvider = async (provider) => {
    setError(null);
    rememberAfterLogin(afterLoginPath());
    const { error } = await signInWithProvider(provider);
    if (error) setError(error.message);
  };

  const requestCode = async () => {
    setError(null);
    setInfo(null);
    if (mode === "signup" && !termsAccepted) {
      setError("Merci d'accepter les CGU, la politique de confidentialité et les règles pour créer un compte.");
      return;
    }
    setLoading(true);
    const { error } =
      mode === "signup"
        ? await sendEmailCode(email, {
            create: true,
            extraData: { terms_accepted: termsAccepted, marketing_consent: newsletter, requested_role: accountType },
          })
        : await sendEmailCode(email);
    setLoading(false);
    if (error) {
      const fr = authErrorFr(error);
      setError(fr === "NO_ACCOUNT" ? "NO_ACCOUNT" : fr);
      return;
    }
    setCode("");
    setCodeSentTo(email);
    setResendIn(RESEND_DELAY);
  };

  const submitCode = async (value) => {
    const token = (value ?? code).replace(/\D/g, "");
    if (token.length < OTP_LENGTH) return;
    setError(null);
    setLoading(true);
    rememberAfterLogin(afterLoginPath());
    const { error } = await verifyEmailCode(codeSentTo, token);
    setLoading(false);
    if (error) {
      setError(authErrorFr(error));
      setCode("");
    }
  };

  const onCodeChange = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 8);
    setCode(v);
    if (v.length === OTP_LENGTH) submitCode(v);
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

    if (!usePassword) {
      await requestCode();
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
      setError(mode === "signup" ? passwordErrorMessage(result.error) : signinErrorMessage(result.error));
      return;
    }
    if (result.alreadyExists) {
      setMode("signin");
      setPassword("");
      setError("Un compte existe déjà avec cet email. Connecte-toi, ou utilise « Mot de passe oublié » si tu ne t'en souviens plus.");
      return;
    }
    if (mode === "signup") {
      setInfo("Compte créé — vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.");
      setPassword("");
    }
  };

  if (user) {
    const stored = sessionStorage.getItem("ur_after_login");
    if (stored) {
      sessionStorage.removeItem("ur_after_login");
      if (stored.startsWith("/") && !stored.startsWith("//") && stored !== "/login") return <Navigate to={stored} replace />;
    }
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
                <span className="auth-perk-ico"><CheckIcon /></span>
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

          {error === "NO_ACCOUNT" ? (
            <div className="error-box" role="alert">
              Aucun compte avec cet email.{" "}
              <button type="button" className="auth-textlink" onClick={() => switchMode("signup")}>Créer un compte</button>
            </div>
          ) : (
            error && <div className="error-box" role="alert">{error}</div>
          )}
          {info && <div className="success-box" role="status">{info}</div>}

          {codeSentTo ? (
            <div className="auth-form">
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-code">Saisis le code reçu à <strong>{codeSentTo}</strong></label>
                <input
                  id="auth-code"
                  className="auth-input auth-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={8}
                  autoFocus
                  value={code}
                  onChange={onCodeChange}
                  placeholder={"•".repeat(OTP_LENGTH)}
                  disabled={loading}
                />
                <span className="auth-hint">Le code est valable une heure. Pense à regarder dans tes spams.</span>
              </div>
              <button className="v2-btn v2-btn-rust auth-submit" type="button" disabled={loading || code.length < OTP_LENGTH} onClick={() => submitCode()}>
                {loading ? "…" : "Valider le code"}
              </button>
              <p className="auth-foot auth-code-actions">
                <button type="button" className="auth-textlink" disabled={resendIn > 0 || loading} onClick={requestCode}>
                  {resendIn > 0 ? `Renvoyer le code (${resendIn} s)` : "Renvoyer le code"}
                </button>
                <button type="button" className="auth-textlink" onClick={() => { setCodeSentTo(null); setCode(""); setError(null); }}>
                  Changer d'email
                </button>
              </p>
            </div>
          ) : (
          <>
          {mode !== "forgot" && (providers.apple || providers.google) && (
            <div className="auth-oauth">
              {providers.apple && (
                <button type="button" className="auth-oauth-btn auth-oauth-apple" onClick={() => handleProvider("apple")}>
                  <AppleLogo /> Continuer avec Apple
                </button>
              )}
              {providers.google && (
                <button type="button" className="auth-oauth-btn auth-oauth-google" onClick={() => handleProvider("google")}>
                  <GoogleLogo /> Continuer avec Google
                </button>
              )}
              <div className="auth-sep"><span>ou</span></div>
            </div>
          )}

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

            {mode !== "forgot" && usePassword && (
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
              </>
            )}

            <button className="v2-btn v2-btn-rust auth-submit" type="submit" disabled={loading}>
              {loading
                ? "…"
                : mode === "forgot"
                  ? "Envoyer le lien"
                  : !usePassword
                    ? "Recevoir un code par email"
                    : mode === "signin"
                      ? "Se connecter"
                      : "Créer mon compte"}
            </button>
            {mode !== "forgot" && (
              <button type="button" className="auth-textlink auth-pw-toggle" onClick={() => { setUsePassword((v) => !v); setError(null); }}>
                {usePassword
                  ? "Recevoir plutôt un code par email"
                  : mode === "signin"
                    ? "Utiliser mon mot de passe"
                    : "Créer un compte avec mot de passe"}
              </button>
            )}
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
          </>
          )}
        </section>
      </div>
    </main>
  );
}
