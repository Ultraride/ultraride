import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Small inline form to create a brand-new organizer entry on the spot,
// without that person needing an account — used from the admin race form's
// organizer dropdown when the organizer doesn't exist yet.
export default function OrganizerQuickCreate({ onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const { data, error } = await supabase.from("organizers").insert({ name: name.trim() }).select().single();
    setSaving(false);
    if (error) setError(error.message);
    else onCreated(data);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 8 }}>
      <div style={{ flex: 1 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nom du nouvel organisateur"
          autoFocus
        />
        {error && <div className="error-box" style={{ marginTop: 6 }}>{error}</div>}
      </div>
      <button className="btn btn-primary" type="submit" disabled={saving}>Créer</button>
      <button className="btn" type="button" onClick={onCancel}>Annuler</button>
    </form>
  );
}
