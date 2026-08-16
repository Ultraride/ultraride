import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import OrganizerQuickCreate from "./OrganizerQuickCreate";

const EMPTY = {
  name: "", country: "", discipline: "Gravel", format: "course", mode: "Autonomie",
  parcours: "boucle", month: "", km: "", dplus: "", open: true,
  lat: "", lon: "", start_lat: "", start_lon: "", end_lat: "", end_lon: "",
  start_place: "", end_place: "", departure_time: "",
  organizer_name: "", terrain: "", next_edition: "", blurb: "", long_blurb: "",
  status: "published", organizer_id: "",
};

export default function RaceForm({ race, onSaved, onCancel }) {
  const { isAdmin, isOrganizer, user } = useAuth();
  const [form, setForm] = useState(race ? { ...EMPTY, ...race, organizer_id: race.organizer_id || "" } : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [organizerList, setOrganizerList] = useState([]);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  const loadOrganizers = () => {
    supabase
      .from("organizers")
      .select("id, name")
      .order("name", { ascending: true })
      .then(({ data }) => setOrganizerList(data || []));
  };

  useEffect(() => {
    if (isAdmin) loadOrganizers();
  }, [isAdmin]);

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const numOrNull = (v) => (v === "" || v === null ? null : Number(v));

  const handleSubmit = async (e) => {

    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      ...form,
      km: numOrNull(form.km),
      dplus: numOrNull(form.dplus),
      lat: numOrNull(form.lat),
      lon: numOrNull(form.lon),
      start_lat: numOrNull(form.start_lat),
      start_lon: numOrNull(form.start_lon),
      end_lat: numOrNull(form.end_lat),
      end_lon: numOrNull(form.end_lon),
    };

    // organizer_id (a standalone public entity, not tied to any login) can
    // be picked freely by an admin. created_by (who submitted the race) is
    // never client-settable — the server owns that entirely.
    payload.organizer_id = payload.organizer_id || null;
    delete payload.created_by;
    delete payload.reviewed_by;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.gpx_track;
    delete payload.elevation_profile;

    let result;
    if (race?.id) {
      result = await supabase.from("races").update(payload).eq("id", race.id);
    } else {
      result = await supabase.from("races").insert(payload);
    }

    setSaving(false);
    if (result.error) setError(result.error.message);
    else onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="panel">
      <div className="h2">{race?.id ? "Modifier la course" : "Nouvelle course"}</div>
      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Nom</label>
        <input required value={form.name} onChange={(e) => field("name", e.target.value)} />
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Pays</label>
          <input value={form.country} onChange={(e) => field("country", e.target.value)} />
        </div>
        <div className="field">
          <label>Discipline</label>
          <select value={form.discipline} onChange={(e) => field("discipline", e.target.value)}>
            <option>Gravel</option><option>Route</option><option>VTT</option>
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Format</label>
          <select value={form.format} onChange={(e) => field("format", e.target.value)}>
            <option value="course">Course</option>
            <option value="aventure">Aventure</option>
            <option value="endurance">Endurance</option>
          </select>
        </div>
        <div className="field">
          <label>Mode</label>
          <select value={form.mode} onChange={(e) => field("mode", e.target.value)}>
            <option>Autonomie</option><option>Semi-autonomie</option><option>Assisté</option>
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Parcours</label>
          <select value={form.parcours} onChange={(e) => field("parcours", e.target.value)}>
            <option value="boucle">Boucle</option>
            <option value="point">Point à point</option>
            <option value="ar">Aller-retour</option>
          </select>
        </div>
        <div className="field">
          <label>Mois</label>
          <input value={form.month} onChange={(e) => field("month", e.target.value)} placeholder="Septembre" />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Distance (km)</label>
          <input type="number" value={form.km ?? ""} onChange={(e) => field("km", e.target.value)} />
        </div>
        <div className="field">
          <label>Dénivelé + (m)</label>
          <input type="number" value={form.dplus ?? ""} onChange={(e) => field("dplus", e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={!!form.open}
            onChange={(e) => field("open", e.target.checked)}
            style={{ width: "auto", marginRight: 8 }}
          />
          Inscriptions ouvertes
        </label>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Départ (lieu)</label>
          <input value={form.start_place || ""} onChange={(e) => field("start_place", e.target.value)} />
        </div>
        <div className="field">
          <label>Arrivée (lieu)</label>
          <input value={form.end_place || ""} onChange={(e) => field("end_place", e.target.value)} />
        </div>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Départ — lat / lon</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={form.start_lat ?? ""} onChange={(e) => field("start_lat", e.target.value)} placeholder="lat" />
            <input value={form.start_lon ?? ""} onChange={(e) => field("start_lon", e.target.value)} placeholder="lon" />
          </div>
        </div>
        <div className="field">
          <label>Arrivée — lat / lon</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={form.end_lat ?? ""} onChange={(e) => field("end_lat", e.target.value)} placeholder="lat" />
            <input value={form.end_lon ?? ""} onChange={(e) => field("end_lon", e.target.value)} placeholder="lon" />
          </div>
        </div>
      </div>

      <div className="field">
        <label>Heure de départ</label>
        <input value={form.departure_time || ""} onChange={(e) => field("departure_time", e.target.value)} placeholder="7h21" />
      </div>

      {isAdmin ? (
        <div className="grid-2">
          <div className="field">
            <label>Organisateur lié</label>
            <select value={form.organizer_id || ""} onChange={(e) => field("organizer_id", e.target.value)}>
              <option value="">— Aucun (nom libre ci-dessous) —</option>
              {organizerList.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <div className="field-hint">Si un organisateur est sélectionné, ses coordonnées (site, réseaux) s'affichent automatiquement sur la fiche course — inutile de les ressaisir. Il n'a pas besoin d'avoir de compte.</div>
            {showQuickCreate ? (
              <OrganizerQuickCreate
                onCreated={(o) => {
                  setOrganizerList((list) => [...list, o].sort((a, b) => a.name.localeCompare(b.name)));
                  field("organizer_id", o.id);
                  setShowQuickCreate(false);
                }}
                onCancel={() => setShowQuickCreate(false)}
              />
            ) : (
              <button type="button" className="filter-reset" style={{ marginTop: 6 }} onClick={() => setShowQuickCreate(true)}>
                + Créer un nouvel organisateur
              </button>
            )}
          </div>
          <div className="field">
            <label>Organisateur (nom affiché, si aucun organisateur lié)</label>
            <input value={form.organizer_name || ""} onChange={(e) => field("organizer_name", e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="field">
          <label>Organisateur (nom affiché)</label>
          <input value={form.organizer_name || ""} onChange={(e) => field("organizer_name", e.target.value)} />
          {isOrganizer && (
            <div className="field-hint">Connecté en tant que {user?.email}.</div>
          )}
        </div>
      )}

      <div className="field">
        <label>Prochaine édition</label>
        <input value={form.next_edition || ""} onChange={(e) => field("next_edition", e.target.value)} />
      </div>

      <div className="field">
        <label>Terrain</label>
        <input value={form.terrain || ""} onChange={(e) => field("terrain", e.target.value)} />
      </div>

      <div className="field">
        <label>Description courte</label>
        <textarea rows={2} value={form.blurb || ""} onChange={(e) => field("blurb", e.target.value)} />
      </div>

      <div className="field">
        <label>Description longue</label>
        <textarea rows={4} value={form.long_blurb || ""} onChange={(e) => field("long_blurb", e.target.value)} />
      </div>

      {isAdmin && (
        <div className="field">
          <label>Statut</label>
          <select value={form.status} onChange={(e) => field("status", e.target.value)}>
            <option value="draft">Brouillon</option>
            <option value="pending">En attente</option>
            <option value="published">Publiée</option>
            <option value="rejected">Refusée</option>
          </select>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
