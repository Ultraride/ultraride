import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import OrganizerQuickCreate from "./OrganizerQuickCreate";
import ImageUploadField from "../components/ImageUploadField";
import PlaceSearch from "../components/PlaceSearch";
import { EMEA_COUNTRIES, MONTHS, NEXT_EDITION_YEARS } from "../lib/emea";

// L'identifiant d'URL est dérivé du libellé : le saisir à la main ouvrirait
// la porte aux divergences entre deux courses du même événement.
function slugify(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const EMPTY = {
  name: "", country: "", discipline: "Gravel", format: "course", mode: "Autonomie",
  parcours: "boucle", month: "", km: "", dplus: "", open: true,
  lat: "", lon: "", start_lat: "", start_lon: "", end_lat: "", end_lon: "",
  start_place: "", end_place: "", departure_time: "",
  start_date: "", end_date: "",
  organizer_name: "", terrain: "", next_edition: "", blurb: "", long_blurb: "",
  event_name: "",
  status: "published", organizer_id: "", image_url: "",
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

    payload.organizer_id = payload.organizer_id || null;
    payload.event_name = form.event_name?.trim() || null;
    payload.event_slug = payload.event_name ? slugify(payload.event_name) : null;
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
      {!isAdmin && (
        <p className="muted" style={{ fontSize: 13, marginTop: -4 }}>
          Ta soumission sera relue par un administrateur avant d'apparaître dans le répertoire.
        </p>
      )}
      {error && <div className="error-box">{error}</div>}

      <div className="field">
        <label>Nom</label>
        <input required value={form.name} onChange={(e) => field("name", e.target.value)} />
      </div>

      <ImageUploadField
        label="Image de la course"
        value={form.image_url}
        onChange={(v) => field("image_url", v)}
        folder="races"
      />

      <div className="grid-2">
        <div className="field">
          <label>Pays</label>
          <select value={form.country} onChange={(e) => field("country", e.target.value)}>
            <option value="">— Sélectionner —</option>
            {EMEA_COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
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
          <select value={form.month} onChange={(e) => field("month", e.target.value)}>
            <option value="">— Sélectionner —</option>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
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

      <PlaceSearch
        label="Lieu de départ"
        value={form.start_place}
        placeholder="Place de la Cathédrale, Strasbourg…"
        onSelect={({ name, lat, lon }) => setForm((f) => ({
          ...f,
          start_place: name,
          start_lat: lat ?? f.start_lat,
          start_lon: lon ?? f.start_lon,
        }))}
      />

      <PlaceSearch
        label="Lieu d'arrivée"
        value={form.end_place}
        placeholder="Esplanade, Argelès-sur-Mer…"
        onSelect={({ name, lat, lon }) => setForm((f) => ({
          ...f,
          end_place: name,
          end_lat: lat ?? f.end_lat,
          end_lon: lon ?? f.end_lon,
        }))}
      />

      <div className="field">
        <label>Heure de départ</label>
        <input value={form.departure_time || ""} onChange={(e) => field("departure_time", e.target.value)} placeholder="7h21" />
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Date de début</label>
          <input
            type="date"
            value={form.start_date || ""}
            onChange={(e) => field("start_date", e.target.value)}
          />
          <div className="field-hint">jj/mm/aaaa — date du jour de départ officiel</div>
        </div>
        <div className="field">
          <label>Date de fin</label>
          <input
            type="date"
            value={form.end_date || ""}
            onChange={(e) => field("end_date", e.target.value)}
          />
          <div className="field-hint">jj/mm/aaaa — date limite d'arrivée</div>
        </div>
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
            <div className="field-hint">Ses coordonnées (site, réseaux) s'affichent automatiquement sur la fiche course.</div>
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
            <label>Organisateur (nom libre, si aucun lié)</label>
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
        <label>Événement</label>
        <input
          value={form.event_name || ""}
          onChange={(e) => field("event_name", e.target.value)}
          placeholder="Race Across France"
        />
        <div className="field-hint">
          Laisse vide si la course est isolée. Renseigné à l'identique sur plusieurs courses, ce
          libellé les regroupe en une seule carte dans le répertoire, avec une page dédiée listant
          les formats.
        </div>
      </div>

      <div className="field">
        <label>Prochaine édition</label>
        <select value={form.next_edition || ""} onChange={(e) => field("next_edition", e.target.value)}>
          <option value="">— Sélectionner —</option>
          {NEXT_EDITION_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
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
          {saving ? "Enregistrement…" : isAdmin ? "Enregistrer" : "Envoyer pour validation"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
