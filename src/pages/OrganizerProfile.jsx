import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const FIELDS = [
  { key: "org_name", label: "Nom de l'organisation", placeholder: "Collectif Baronnies Gravel" },
  { key: "org_website", label: "Site web", placeholder: "exemple.fr" },
  { key: "org_email", label: "Email de contact public", placeholder: "contact@exemple.fr", type: "email" },
  { key: "org_instagram", label: "Instagram", placeholder: "@pseudo ou URL complète" },
  { key: "org_facebook", label: "Facebook", placeholder: "pseudo ou URL complète" },
  { key: "org_strava", label: "Club Strava", placeholder: "identifiant du club ou URL complète" },
  { key: "org_logo_url", label: "Logo (URL image)", placeholder: "https://..." },
];

export default function OrganizerProfile() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        org_name: profile.org_name || "",
        org_website: profile.org_website || "",
        org_email: profile.org_email || "",
        org_instagram: profile.org_instagram || "",
        org_facebook: profile.org_facebook || "",
        org_strava: profile.org_strava || "",
        org_logo_url: profile.org_logo_url || "",
      });
    }
  }, [profile]);

  if (loading) return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;
  if (!user) return <Navigate to="/login" replace />;

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    // .select() is required here — without it, Supabase reports success even
    // when RLS silently matched zero rows, hiding a real failure.
    const { data, error } = await supabase.from("profiles").update(form).eq("id", user.id).select();
    setSaving(false);
    if (error) {
      setError(error.message);
    } else if (!data || data.length === 0) {
      setError("Aucune ligne mise à jour. Vérifie que tu es bien connecté avec le bon compte, puis réessaie.");
    } else {
      setSaved(true);
      refreshProfile();
    }
  };

  if (!form) return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 520 }}>
      <h1 className="h1">Fiche organisateur</h1>
      <p className="muted" style={{ marginBottom: 24 }}>
        Renseigne ces informations une seule fois — elles s'afficheront automatiquement sur toutes les courses que tu soumets, dans un encadré "Organisé par".
      </p>

      {error && <div className="error-box">{error}</div>}
      {saved && <div className="success-box">Fiche organisateur enregistrée.</div>}

      <form onSubmit={handleSubmit} className="panel">
        {FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <input
              type={f.type || "text"}
              value={form[f.key]}
              onChange={(e) => field(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          </div>
        ))}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
