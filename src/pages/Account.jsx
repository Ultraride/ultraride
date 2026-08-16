import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import PalmaresSection from "./PalmaresSection";

function InfoSection() {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDisplayName(profile?.display_name || ""); }, [profile]);

  const ROLE_LABEL = { participant: "Participant", organizer: "Organisateur", admin: "Administrateur" };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const { data, error } = await supabase
      .from("profiles")
      .update({ display_name: displayName })
      .eq("id", user.id)
      .select();
    setSaving(false);
    if (error) setError(error.message);
    else if (!data || data.length === 0) setError("Aucune ligne mise à jour.");
    else {
      setSaved(true);
      refreshProfile();
    }
  };

  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <div className="h2">Mes informations</div>
      {error && <div className="error-box">{error}</div>}
      {saved && <div className="success-box">Enregistré.</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Email</label>
          <input value={user.email} disabled />
        </div>
        <div className="field">
          <label>Rôle</label>
          <input value={ROLE_LABEL[profile?.role] || profile?.role || "—"} disabled />
        </div>
        <div className="field">
          <label>Nom affiché</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ton nom ou pseudo" />
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}

function FavoritesSection() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    supabase
      .from("favorites")
      .select("id, race:races(id, name, country, km, month)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setFavorites(data);
      });
  };

  useEffect(() => { load(); }, []);

  const remove = async (favId) => {
    await supabase.from("favorites").delete().eq("id", favId);
    load();
  };

  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <div className="h2">Mes courses favorites</div>
      {error && <div className="error-box">{error}</div>}
      {favorites === null ? (
        <p className="muted">Chargement…</p>
      ) : favorites.length === 0 ? (
        <p className="muted">Aucune course en favori pour l'instant — clique sur l'étoile d'une fiche course pour l'ajouter ici.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {favorites.map((f) => (
            <div key={f.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              {f.race ? (
                <Link to={`/courses/${f.race.id}`}>
                  <strong>{f.race.name}</strong>{" "}
                  <span className="muted mono" style={{ fontSize: 12 }}>· {f.race.country} · {f.race.km} km · {f.race.month}</span>
                </Link>
              ) : (
                <span className="muted">Course supprimée</span>
              )}
              <button className="btn" onClick={() => remove(f.id)}>Retirer</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CommentsSection() {
  const { user } = useAuth();
  const [comments, setComments] = useState(null);
  const [error, setError] = useState(null);

  const load = () => {
    supabase
      .from("comments")
      .select("id, body, status, deletion_requested, created_at, race:races(id, name)")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setComments(data);
      });
  };

  useEffect(() => { load(); }, []);

  const requestDeletion = async (id) => {
    if (!window.confirm("Demander à un administrateur de supprimer cet avis ?")) return;
    await supabase.from("comments").update({ deletion_requested: true }).eq("id", id);
    load();
  };

  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <div className="h2">Mes avis</div>
      {error && <div className="error-box">{error}</div>}
      {comments === null ? (
        <p className="muted">Chargement…</p>
      ) : comments.length === 0 ? (
        <p className="muted">Tu n'as encore laissé aucun avis.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {comments.map((c) => (
            <div key={c.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div className="mono muted" style={{ fontSize: 12 }}>
                  {c.race ? <Link to={`/courses/${c.race.id}`}>{c.race.name}</Link> : "Course supprimée"}
                  {c.status === "hidden" && <span className="badge badge-hidden" style={{ marginLeft: 8 }}>Masqué par un admin</span>}
                </div>
                {c.deletion_requested ? (
                  <span className="badge badge-pending">Suppression demandée</span>
                ) : (
                  <button className="btn btn-danger" onClick={() => requestDeletion(c.id)}>Demander la suppression</button>
                )}
              </div>
              <p style={{ margin: "8px 0 0" }}>{c.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DangerZone() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    const { error } = await supabase.from("profiles").delete().eq("id", user.id);
    setDeleting(false);
    if (error) {
      setError(error.message);
      return;
    }
    await signOut();
    navigate("/");
  };

  return (
    <div className="panel" style={{ border: "1px solid var(--brick)" }}>
      <div className="h2" style={{ color: "var(--brick)" }}>Supprimer mon compte</div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        Ceci supprime ton profil, tes favoris et te déconnecte immédiatement. Tes avis existants resteront visibles
        mais affichés comme provenant d'un « utilisateur supprimé ». Cette action ne supprime pas ta capacité
        technique à te reconnecter avec ce même email (limitation actuelle) — contacte l'administrateur si tu veux
        une suppression complète.
      </p>
      {error && <div className="error-box">{error}</div>}
      {!confirming ? (
        <button className="btn btn-danger" onClick={() => setConfirming(true)}>Supprimer mon compte</button>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13 }}>Es-tu sûr ? Cette action est irréversible.</span>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Suppression…" : "Oui, supprimer définitivement"}
          </button>
          <button className="btn" onClick={() => setConfirming(false)}>Annuler</button>
        </div>
      )}
    </div>
  );
}

export default function Account() {
  const { user, loading } = useAuth();

  if (loading) return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 560 }}>
      <h1 className="h1">Mon compte</h1>
      <InfoSection />
      <PalmaresSection />
      <FavoritesSection />
      <CommentsSection />
      <DangerZone />
    </div>
  );
}
