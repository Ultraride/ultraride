import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

// Reached via the link in a "reset password" email. Supabase exchanges the
// URL token for a temporary recovery session automatically (it fires a
// PASSWORD_RECOVERY auth event) — we just need to let the visitor set a new
// password while that session is active.
export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // Also cover the case where the session is already established by the
    // time this component mounts (event fired before the listener attached).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    navigate("/account");
  };

  return (
    <div className="wrap" style={{ paddingTop: 60, maxWidth: 420 }}>
      <h1 className="h1">Nouveau mot de passe</h1>
      {!ready ? (
        <p className="muted">Vérification du lien de réinitialisation…</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="error-box">{error}</div>}
          <div className="field">
            <label>Nouveau mot de passe</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6 caractères minimum"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Enregistrement…" : "Définir ce mot de passe"}
          </button>
        </form>
      )}
    </div>
  );
}
