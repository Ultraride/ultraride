import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const FIELDS = [
  { key: "org_name", label: "Nom de l'organisation" },
  { key: "org_website", label: "Site web", placeholder: "exemple.fr" },
  { key: "org_email", label: "Email de contact public", type: "email" },
  { key: "org_instagram", label: "Instagram", placeholder: "@pseudo ou URL complète" },
  { key: "org_facebook", label: "Facebook", placeholder: "pseudo ou URL complète" },
  { key: "org_strava", label: "Club Strava", placeholder: "identifiant du club ou URL complète" },
  { key: "org_logo_url", label: "Logo (URL image)", placeholder: "https://..." },
];

function OrganizerEditForm({ organizer, onSaved, onCancel }) {
  const [form, setForm] = useState({
    org_name: organizer.org_name || "",
    org_website: organizer.org_website || "",
    org_email: organizer.org_email || "",
    org_instagram: organizer.org_instagram || "",
    org_facebook: organizer.org_facebook || "",
    org_strava: organizer.org_strava || "",
    org_logo_url: organizer.org_logo_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data, error } = await supabase.from("profiles").update(form).eq("id", organizer.id).select();
    setSaving(false);
    if (error) setError(error.message);
    else if (!data || data.length === 0) setError("Aucune ligne mise à jour.");
    else onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ marginTop: 10 }}>
      {error && <div className="error-box">{error}</div>}
      <div className="muted mono" style={{ fontSize: 11, marginBottom: 12 }}>{organizer.email}</div>
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
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

export default function OrganizersManager() {
  const [organizers, setOrganizers] = useState(null);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const load = () => {
    supabase
      .from("profiles")
      .select("id, email, display_name, role, created_at, org_name, org_website, org_email, org_instagram, org_facebook, org_strava, org_logo_url")
      .eq("role", "organizer")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setOrganizers(data);
      });
  };

  useEffect(() => { load(); }, []);

  const hasProfile = (o) => o.org_name || o.org_website || o.org_email || o.org_instagram || o.org_facebook || o.org_strava;

  return (
    <div>
      <h1 className="h1">Fiches organisateur</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Comptes avec le rôle organisateur, et les coordonnées qu'ils ont renseignées (affichées automatiquement sur leurs courses).
      </p>
      {error && <div className="error-box">{error}</div>}
      {organizers === null ? (
        <p className="muted">Chargement…</p>
      ) : organizers.length === 0 ? (
        <p className="muted">Aucun compte organisateur pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {organizers.map((o) => (
            <div key={o.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="h2" style={{ marginBottom: 2 }}>{o.org_name || "(fiche non renseignée)"}</div>
                  <div className="muted mono" style={{ fontSize: 12 }}>{o.email}</div>
                  {hasProfile(o) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                      {o.org_website && <span className="tag">{o.org_website}</span>}
                      {o.org_email && <span className="tag">{o.org_email}</span>}
                      {o.org_instagram && <span className="tag">Instagram</span>}
                      {o.org_facebook && <span className="tag">Facebook</span>}
                      {o.org_strava && <span className="tag">Strava</span>}
                    </div>
                  )}
                </div>
                <button className="btn" onClick={() => setEditingId(editingId === o.id ? null : o.id)}>
                  {editingId === o.id ? "Fermer" : "Modifier"}
                </button>
              </div>
              {editingId === o.id && (
                <OrganizerEditForm
                  organizer={o}
                  onSaved={() => { setEditingId(null); load(); }}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
