import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import OrganizerQuickCreate from "./OrganizerQuickCreate";
import ImageUploadField from "../components/ImageUploadField";

const FIELDS = [
  { key: "name", label: "Nom de l'organisation" },
  { key: "website", label: "Site web", placeholder: "exemple.fr" },
  { key: "email", label: "Email de contact public", type: "email" },
  { key: "instagram", label: "Instagram", placeholder: "@pseudo ou URL complète" },
  { key: "facebook", label: "Facebook", placeholder: "pseudo ou URL complète" },
  { key: "strava", label: "Club Strava", placeholder: "identifiant du club ou URL complète" },
];

function OrganizerEditForm({ organizer, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: organizer.name || "",
    website: organizer.website || "",
    email: organizer.email || "",
    instagram: organizer.instagram || "",
    facebook: organizer.facebook || "",
    strava: organizer.strava || "",
    logo_url: organizer.logo_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const { data, error } = await supabase.from("organizers").update(form).eq("id", organizer.id).select();
    setSaving(false);
    if (error) setError(error.message);
    else if (!data || data.length === 0) setError("Aucune ligne mise à jour.");
    else onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ marginTop: 10 }}>
      {error && <div className="error-box">{error}</div>}
      <ImageUploadField label="Logo" value={form.logo_url} onChange={(v) => field("logo_url", v)} folder="organizers" />
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
  const [creating, setCreating] = useState(false);

  const load = () => {
    supabase
      .from("organizers")
      .select("*, linked_account:profiles!organizers_linked_profile_id_fkey(email)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setOrganizers(data);
      });
  };

  useEffect(() => { load(); }, []);

  const remove = async (o) => {
    if (!window.confirm(`Supprimer la fiche « ${o.name} » ? Les courses liées ne seront plus rattachées à un organisateur.`)) return;
    const { error } = await supabase.from("organizers").delete().eq("id", o.id);
    if (error) setError(error.message);
    else load();
  };

  const hasContact = (o) => o.website || o.email || o.instagram || o.facebook || o.strava;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 className="h1" style={{ margin: 0 }}>Fiches organisateur</h1>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Nouvel organisateur</button>
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>
        Ces fiches n'exigent pas de compte — tu peux en créer une pour n'importe quel organisateur, même s'il ne s'est jamais connecté. Si un compte se connecte un jour avec le même profil, tu pourras le relier (« lié à »).
      </p>

      {creating && (
        <div style={{ marginBottom: 16 }}>
          <OrganizerQuickCreate
            onCreated={() => { setCreating(false); load(); }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
      {organizers === null ? (
        <p className="muted">Chargement…</p>
      ) : organizers.length === 0 ? (
        <p className="muted">Aucune fiche organisateur pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {organizers.map((o) => (
            <div key={o.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {o.logo_url && (
                    <img src={o.logo_url} alt="" className="organizer-logo" />
                  )}
                  <div>
                    <div className="h2" style={{ marginBottom: 2 }}>{o.name}</div>
                    <div className="muted mono" style={{ fontSize: 12 }}>
                      {o.linked_account ? `Lié à ${o.linked_account.email}` : "Aucun compte lié"}
                    </div>
                    {hasContact(o) && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                        {o.website && <span className="tag">{o.website}</span>}
                        {o.email && <span className="tag">{o.email}</span>}
                        {o.instagram && <span className="tag">Instagram</span>}
                        {o.facebook && <span className="tag">Facebook</span>}
                        {o.strava && <span className="tag">Strava</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" onClick={() => setEditingId(editingId === o.id ? null : o.id)}>
                    {editingId === o.id ? "Fermer" : "Modifier"}
                  </button>
                  <button className="btn btn-danger" onClick={() => remove(o)}>Suppr.</button>
                </div>
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
