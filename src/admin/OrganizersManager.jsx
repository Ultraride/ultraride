import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import ImageUploadField from "../components/ImageUploadField";
import OrganizerQuickCreate from "./OrganizerQuickCreate";

const FIELDS = [
  { key: "name", label: "Nom de l'organisation" },
  { key: "website", label: "Site web", placeholder: "exemple.fr" },
  { key: "email", label: "Email de contact public", type: "email" },
  { key: "instagram", label: "Instagram", placeholder: "@pseudo ou URL complète" },
  { key: "facebook", label: "Facebook", placeholder: "pseudo ou URL complète" },
  { key: "strava", label: "Club Strava", placeholder: "identifiant du club ou URL complète" },
];

const ROLE_LABEL = { participant: "participant", organizer: "organisateur", admin: "admin" };

function OrganizerEditForm({ organizer, profiles, takenProfileIds, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: organizer.name || "",
    website: organizer.website || "",
    email: organizer.email || "",
    instagram: organizer.instagram || "",
    facebook: organizer.facebook || "",
    strava: organizer.strava || "",
    logo_url: organizer.logo_url || "",
    bio: organizer.bio || "",
    linked_profile_id: organizer.linked_profile_id || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = { ...form, linked_profile_id: form.linked_profile_id || null };

    const { data, error } = await supabase
      .from("organizers")
      .update(payload)
      .eq("id", organizer.id)
      .select();

    setSaving(false);

    if (error) {
      // La contrainte d'unicité en base remonte ici si le compte est déjà
      // rattaché à une autre fiche — on traduit le message technique.
      if (error.code === "23505") {
        setError("Ce compte est déjà lié à une autre fiche organisateur. Un compte ne peut être rattaché qu'à une seule fiche.");
      } else {
        setError(error.message);
      }
      return;
    }
    if (!data || data.length === 0) {
      setError("Aucune ligne mise à jour.");
      return;
    }
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ marginTop: 10 }}>
      {error && <div className="error-box">{error}</div>}

      <ImageUploadField
        label="Logo"
        value={form.logo_url}
        onChange={(v) => field("logo_url", v)}
        folder="organizers"
      />

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

      <div className="field">
        <label>Compte lié</label>
        <select
          value={form.linked_profile_id}
          onChange={(e) => field("linked_profile_id", e.target.value)}
        >
          <option value="">— Aucun compte lié —</option>
          {profiles.map((p) => {
            // Un compte déjà rattaché ailleurs reste listé mais désactivé :
            // le masquer laisserait l'admin sans explication.
            const takenElsewhere = takenProfileIds[p.id] && takenProfileIds[p.id] !== organizer.id;
            return (
              <option key={p.id} value={p.id} disabled={takenElsewhere}>
                {p.email}
                {p.display_name ? ` — ${p.display_name}` : ""}
                {` (${ROLE_LABEL[p.role] || p.role})`}
                {takenElsewhere ? " — déjà lié" : ""}
              </option>
            );
          })}
        </select>
        <div className="field-hint">
          Le compte lié pourra modifier cette fiche depuis « Fiche organisateur ». Un compte ne peut
          être rattaché qu'à une seule fiche. Si le rôle du compte n'est pas « organisateur », pense
          à le changer dans l'onglet Utilisateurs.
        </div>
      </div>

      <div className="field">
        <label>Résumé court</label>
        <textarea
          rows={3}
          value={form.bio}
          onChange={(e) => field("bio", e.target.value)}
          placeholder="Présentation de l'organisateur, affichée en haut de sa page publique."
        />
      </div>

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
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => {
    supabase
      .from("organizers")
      .select("*, linked_account:profiles!organizers_linked_profile_id_fkey(email, display_name, role)")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setOrganizers(data);
      });

    supabase
      .from("profiles")
      .select("id, email, display_name, role")
      .order("email", { ascending: true })
      .then(({ data }) => setProfiles(data || []));
  };

  useEffect(() => { load(); }, []);

  // Index des comptes déjà rattachés : id du profil -> id de la fiche.
  const takenProfileIds = {};
  (organizers || []).forEach((o) => {
    if (o.linked_profile_id) takenProfileIds[o.linked_profile_id] = o.id;
  });

  const remove = async (o) => {
    if (!window.confirm(`Supprimer la fiche « ${o.name} » ? Les courses liées ne seront plus rattachées à un organisateur.`)) return;
    const { error } = await supabase.from("organizers").delete().eq("id", o.id);
    if (error) setError(error.message);
    else load();
  };

  const unlink = async (o) => {
    if (!window.confirm(`Détacher le compte de la fiche « ${o.name} » ?`)) return;
    const { error } = await supabase.from("organizers").update({ linked_profile_id: null }).eq("id", o.id);
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
        Ces fiches n'exigent pas de compte — tu peux en créer une pour n'importe quel organisateur,
        même s'il ne s'est jamais connecté. Quand un organisateur se crée un compte, relie-le à sa
        fiche depuis « Modifier » : il pourra alors la tenir à jour lui-même.
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
                  {o.logo_url && <img src={o.logo_url} alt="" className="organizer-logo" />}
                  <div>
                    <div className="h2" style={{ marginBottom: 2 }}>{o.name}</div>
                    <div className="muted mono" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {o.linked_account ? (
                        <>
                          <span>
                            Lié à {o.linked_account.email}
                            {o.linked_account.role !== "organizer" && ` (rôle : ${ROLE_LABEL[o.linked_account.role] || o.linked_account.role})`}
                          </span>
                          <button type="button" className="filter-reset" onClick={() => unlink(o)}>Détacher</button>
                        </>
                      ) : (
                        <span>Aucun compte lié</span>
                      )}
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
                  <Link to={`/organizers/${o.id}`} className="btn" target="_blank">Voir la page</Link>
                  <button className="btn" onClick={() => setEditingId(editingId === o.id ? null : o.id)}>
                    {editingId === o.id ? "Fermer" : "Modifier"}
                  </button>
                  <button className="btn btn-danger" onClick={() => remove(o)}>Suppr.</button>
                </div>
              </div>

              {editingId === o.id && (
                <OrganizerEditForm
                  organizer={o}
                  profiles={profiles}
                  takenProfileIds={takenProfileIds}
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
