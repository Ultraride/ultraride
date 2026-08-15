import { useState } from "react";
import { useAuth } from "../lib/AuthContext";

export default function Login() {
  const { signInWithEmail, user } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signInWithEmail(email);
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
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
      <h1 className="h1">Connexion</h1>
      {sent ? (
        <div className="success-box">
          Un lien de connexion a été envoyé à <strong>{email}</strong>. Ouvre-le pour te connecter — aucun mot de passe n'est nécessaire.
        </div>
      ) : (
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
          {error && <div className="error-box">{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Envoi…" : "Recevoir le lien de connexion"}
          </button>
          <p className="muted" style={{ marginTop: 14 }}>
            Organisateur ou administrateur, utilise l'email associé à ton compte. Un simple visiteur qui laisse un commentaire crée automatiquement un compte de cette façon.
          </p>
        </form>
      )}
    </div>
  );
}
