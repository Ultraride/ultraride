import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ImageUploadField from "../components/ImageUploadField";

const FIELDS = [
  { key: "name", label: "Nom de l'organisation", placeholder: "Collectif Baronnies Gravel" },
  { key: "website", label: "Site web", placeholder: "exemple.fr" },
  { key: "email", label: "Email de contact public", placeholder: "contact@exemple.fr", type: "email" },
  { key: "instagram", label: "Instagram", placeholder: "@pseudo ou URL complète" },
  { key: "facebook", label: "Facebook", placeholder: "pseudo ou URL complète" },
  { key: "strava", label: "Club Strava", placeholder: "identifiant du club ou URL complète" },
];

const EMPTY_FORM = { name: "", website: "", email: "", instagram: "", facebook: "", strava: "", logo_url: "", bio: "" };

export default function OrganizerProfile() {
  const { user, loading } = useAuth();
  const [organizerId, setOrganizerId] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("organizers")
      .select("*")
      .eq("linked_profile_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setOrganizerId(data.id);
          setForm({ ...EMPTY_FORM, ...data });
        } else {
          // No organizer entry linked to this account yet — start blank,
          // it'll be created on first save.
          setForm(EMPTY_FORM);
        }
      });
  }, [user]);

  if (loading) return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;
  if (!user) return <Navigate to="/login" replace />;

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    let result;
    if (organizerId) {
      result = await supabase.from("organizers").update(form).eq("id", organizerId).select().single();
    } else {
      result = await supabase.from("organizers").insert({ ...form, linked_profile_id: user.id }).select().single();
    }

    setSaving(false);
    if (result.error) setError(result.error.message);
    else {
      setOrganizerId(result.data.id);
      setSaved(true);
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
        <ImageUploadField label="Logo" value={form.logo_url} onChange={(v) => field("logo_url", v)} folder="organizers" />
        {FIELDS.map((f) => (
          <div className="field" key={f.key}>
            <label>{f.label}</label>
            <input
              type={f.type || "text"}
              value={form[f.key] || ""}
              onChange={(e) => field(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          </div>
        ))}
        <div className="field">
          <label>Résumé court</label>
          <textarea rows={3} value={form.bio || ""} onChange={(e) => field("bio", e.target.value)} placeholder="Présentation de ton organisation, affichée en haut de ta page publique." />
        </div>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </div>
  );
}
