import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { popAfterLogin } from "../lib/authProviders";

// Retour de Google / Apple. supabase-js lit les jetons dans l'URL
// (detectSessionInUrl) ; on attend la session puis on renvoie l'utilisateur
// là où il était. Les nouveaux comptes passent ensuite par /bienvenue
// (OnboardingGate dans App.jsx).
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search);
    const err = params.get("error_description") || params.get("error");
    if (err) {
      setError(err.replace(/\+/g, " "));
      return;
    }

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      navigate(popAfterLogin(), { replace: true });
    };

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish();
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });
    const t = setTimeout(() => {
      if (!done) setError("La connexion n'a pas abouti. Réessaie depuis la page de connexion.");
    }, 10000);
    return () => {
      clearTimeout(t);
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <main className="v2-wrap auth-done">
      {error ? (
        <>
          <div className="error-box" role="alert">{error}</div>
          <Link to="/login" className="v2-btn v2-btn-rust">Retour à la connexion</Link>
        </>
      ) : (
        <p>Connexion en cours…</p>
      )}
    </main>
  );
}
