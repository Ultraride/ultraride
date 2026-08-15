import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const ROLES = ["participant", "organizer", "admin"];

export default function UsersManager() {
  const { user: currentUser } = useAuth();
  const [profiles, setProfiles] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setProfiles(data);
  };

  useEffect(() => { load(); }, []);

  const changeRole = async (p, role) => {
    setBusyId(p.id);
    const { error } = await supabase.from("profiles").update({ role }).eq("id", p.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  const removeProfile = async (p) => {
    if (!window.confirm(`Retirer le profil de ${p.email} (rôle et accès à l'app) ?`)) return;
    setBusyId(p.id);
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    setBusyId(null);
    if (error) setError(error.message);
    else load();
  };

  return (
    <div>
      <h1 className="h1">Utilisateurs</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Retirer un profil ici enlève son rôle et son accès aux données de l'application. La suppression complète du
        compte de connexion (email/mot de passe) nécessite une action côté serveur avec une clé privilégiée — à faire
        depuis le dashboard Supabase (Authentication → Users) en complément.
      </p>
      {error && <div className="error-box">{error}</div>}
      {profiles === null ? (
        <p className="muted">Chargement…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr><th>Email</th><th>Rôle</th><th>Créé le</th><th></th></tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id}>
                <td>{p.email}{p.id === currentUser?.id ? " (toi)" : ""}</td>
                <td>
                  <select
                    value={p.role}
                    disabled={busyId === p.id || p.id === currentUser?.id}
                    onChange={(e) => changeRole(p, e.target.value)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="mono">{new Date(p.created_at).toLocaleDateString("fr-FR")}</td>
                <td>
                  <button
                    className="btn btn-danger"
                    disabled={busyId === p.id || p.id === currentUser?.id}
                    onClick={() => removeProfile(p)}
                  >
                    Retirer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
