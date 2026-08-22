import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { parseTrackFile, formatDuration } from "../lib/gpx";

// Vitesse moyenne globale : distance divisée par le temps total, pauses
// comprises. C'est la mesure qui fait foi en ultra-distance, et elle ne
// dépend d'aucune heuristique de détection d'arrêt.
function averageSpeed(distanceKm, totalSeconds) {
  if (!distanceKm || !totalSeconds) return null;
  return (distanceKm / (totalSeconds / 3600)).toFixed(1);
}

function formatSpeed(distanceKm, totalSeconds) {
  const v = averageSpeed(distanceKm, totalSeconds);
  return v == null ? "—" : `${v} km/h`;
}

// Carte affichant la trace d'un résultat. Montée à la demande (bouton
// "Voir la trace") : instancier une carte Leaflet par résultat dès le
// chargement de la page serait inutilement lourd.
function ResultTrackMap({ track }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!track || track.length < 2 || !ref.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(ref.current, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const latlngs = track.map((p) => [p.lat, p.lon]);
    const line = L.polyline(latlngs, { color: "#C4622D", weight: 3 }).addTo(map);

    L.circleMarker(latlngs[0], {
      radius: 6, color: "#15793F", fillColor: "#15793F", fillOpacity: 0.9,
    }).bindTooltip("Départ").addTo(map);

    L.circleMarker(latlngs[latlngs.length - 1], {
      radius: 6, color: "#C1543F", fillColor: "#C1543F", fillOpacity: 0.9,
    }).bindTooltip("Arrivée").addTo(map);

    map.fitBounds(line.getBounds().pad(0.1));
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [track]);

  if (!track || track.length < 2) {
    return <p className="muted" style={{ fontSize: 13 }}>Trace indisponible pour ce résultat.</p>;
  }
  return <div ref={ref} className="result-track-map" />;
}

function OrganizerSearchField({ value, onChangeText, onMatch, matchedOrganizer, onClearMatch }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);

  const handleType = (text) => {
    onChangeText(text);
    if (matchedOrganizer) onClearMatch();
    window.clearTimeout(timeoutRef.current);
    if (text.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    timeoutRef.current = window.setTimeout(async () => {
      const { data } = await supabase
        .from("organizers")
        .select("id, name")
        .ilike("name", `%${text.trim()}%`)
        .limit(6);
      setSuggestions(data || []);
      setOpen((data || []).length > 0);
    }, 300);
  };

  const pick = (o) => {
    onMatch(o);
    setOpen(false);
  };

  return (
    <div className="field" style={{ position: "relative" }}>
      <label>Organisateur</label>
      {matchedOrganizer ? (
        <div className="race-search-matched">
          <span>✓ Lié à <strong>{matchedOrganizer.name}</strong></span>
          <button type="button" className="filter-reset" onClick={onClearMatch}>Changer</button>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <input
            value={value}
            onChange={(e) => handleType(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Nom de l'organisateur"
            autoComplete="off"
          />
          {open && suggestions.length > 0 && (
            <div className="race-search-suggestions">
              {suggestions.map((o) => (
                <button type="button" key={o.id} className="race-search-suggestion" onClick={() => pick(o)}>
                  <div>{o.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="field-hint">Si l'organisateur existe dans le répertoire, sélectionne-le pour rapprocher ton résultat.</div>
    </div>
  );
}

function RaceSearchField({ value, onChangeText, onMatch, matchedRace, onClearMatch }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef(null);

  const handleType = (text) => {
    onChangeText(text);
    if (matchedRace) onClearMatch();
    window.clearTimeout(timeoutRef.current);
    if (text.trim().length < 2) { setSuggestions([]); setOpen(false); return; }
    timeoutRef.current = window.setTimeout(async () => {
      const { data } = await supabase
        .from("races")
        .select("id, name, country, organizer:organizers!races_organizer_id_fkey(name)")
        .ilike("name", `%${text.trim()}%`)
        .eq("status", "published")
        .limit(6);
      setSuggestions(data || []);
      setOpen(true);
    }, 300);
  };

  const pick = (race) => {
    onMatch(race);
    setOpen(false);
  };

  return (
    <div className="field">
      <label>Nom de la course</label>
      {matchedRace ? (
        <div>
          <div className="race-search-matched">
            <span>✓ Rapprochée de <strong>{matchedRace.name}</strong></span>
            <button type="button" className="filter-reset" onClick={onClearMatch}>Changer</button>
          </div>
          <div className="field-hint">
            Le répertoire n'affiche qu'une édition à la fois — si tu as couru une autre année que celle actuellement listée, précise-le dans le champ "Année de réalisation" ci-dessous.
          </div>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          <input
            value={value}
            onChange={(e) => handleType(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="ex. Chasing the Sun"
            autoComplete="off"
          />
          {open && suggestions.length > 0 && (
            <div className="race-search-suggestions">
              {suggestions.map((r) => (
                <button type="button" key={r.id} className="race-search-suggestion" onClick={() => pick(r)}>
                  <div>{r.name}</div>
                  <div className="muted mono" style={{ fontSize: 11 }}>{r.country}{r.organizer?.name ? ` · ${r.organizer.name}` : ""}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="field-hint">
        Si la course existe déjà dans le répertoire (édition passée ou future), sélectionne-la pour rapprocher ton résultat.
      </div>
    </div>
  );
}

function AddResultForm({ onSaved, onCancel }) {
  const { user } = useAuth();
  const [raceName, setRaceName] = useState("");
  const [matchedRace, setMatchedRace] = useState(null);
  const [organizerName, setOrganizerName] = useState("");
  const [matchedOrganizer, setMatchedOrganizer] = useState(null);
  const [eventYear, setEventYear] = useState("");
  const [notes, setNotes] = useState("");
  const [gpxInfo, setGpxInfo] = useState(null);
  const [gpxError, setGpxError] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleMatch = (race) => {
    setMatchedRace(race);
    setRaceName(race.name);
    if (race.organizer?.name && !matchedOrganizer) setOrganizerName(race.organizer.name);
  };
  const clearMatch = () => setMatchedRace(null);

  const handleOrganizerMatch = (o) => { setMatchedOrganizer(o); setOrganizerName(o.name); };
  const clearOrganizerMatch = () => setMatchedOrganizer(null);

  const handleGpx = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setGpxError(null);
    try {
      const result = await parseTrackFile(file);
      setGpxInfo(result);
    } catch (err) {
      setGpxError(err.message);
    }
    setParsing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!raceName.trim()) return;
    if (!gpxInfo) {
      setError("Une trace GPX ou FIT est obligatoire pour ajouter un résultat au palmarès.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      user_id: user.id,
      race_id: matchedRace?.id || null,
      race_name: raceName.trim(),
      organizer_name: organizerName.trim() || null,
      event_date: eventYear ? `${eventYear}-01-01` : null,
      notes: notes.trim() || null,
      distance_km: gpxInfo.distanceKm,
      elevation_gain: gpxInfo.elevationGain,
      total_seconds: gpxInfo.totalSeconds,
      moving_seconds: gpxInfo.movingSeconds,
      gpx_track: gpxInfo.points,
    };

    const { error } = await supabase.from("race_results").insert(payload);
    setSaving(false);
    if (error) setError(error.message);
    else onSaved();
  };

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ marginBottom: 16 }}>
      {error && <div className="error-box">{error}</div>}

      <RaceSearchField
        value={raceName}
        onChangeText={setRaceName}
        onMatch={handleMatch}
        matchedRace={matchedRace}
        onClearMatch={clearMatch}
      />

      <OrganizerSearchField
        value={organizerName}
        onChangeText={setOrganizerName}
        onMatch={handleOrganizerMatch}
        matchedOrganizer={matchedOrganizer}
        onClearMatch={clearOrganizerMatch}
      />

      <div className="field">
        <label>Année de réalisation</label>
        <input
          type="number"
          min="1990"
          max={new Date().getFullYear() + 1}
          value={eventYear}
          onChange={(e) => setEventYear(e.target.value)}
          placeholder={String(new Date().getFullYear())}
        />
        <div className="field-hint">C'est l'année qui permet de situer ton édition — pas besoin du jour ni du mois exacts.</div>
      </div>

      <div className="field">
        <label>Trace FIT <span style={{ color: "var(--brick)" }}>*</span></label>
        <label className="btn image-upload-btn" style={{ display: "inline-flex" }}>
          {parsing ? "Analyse…" : gpxInfo ? "Remplacer le fichier" : "Charger un fichier .fit"}
          <input type="file" accept=".fit" onChange={handleGpx} disabled={parsing} style={{ display: "none" }} />
        </label>
        {gpxInfo && (
          <div className="muted mono" style={{ fontSize: 12, marginTop: 6 }}>
            ✓ {gpxInfo.distanceKm} km · {gpxInfo.elevationGain.toLocaleString("fr-FR")} D+ · {gpxInfo.points.length} points
            {gpxInfo.totalSeconds != null && (
              <>
                <br />
                ✓ {formatDuration(gpxInfo.totalSeconds)} au total ·{" "}
                {formatSpeed(gpxInfo.distanceKm, gpxInfo.totalSeconds)} de moyenne
              </>
            )}
            {gpxInfo.totalSeconds == null && (
              <>
                <br />
                ⚠ Ce fichier .fit ne contient pas d'horodatage exploitable : les temps ne seront pas enregistrés.
              </>
            )}
          </div>
        )}
        {gpxError && <div className="error-box" style={{ marginTop: 6 }}>{gpxError}</div>}
        <div className="field-hint">
          Obligatoire — c'est ta trace qui prouve et illustre ta participation. Seul le format .fit est accepté :
          il garantit l'horodatage nécessaire au calcul des temps. Tu le trouveras dans l'export de ton compteur
          ou de ta montre (Garmin, Wahoo, Coros…).
        </div>
      </div>

      <div className="field">
        <label>Notes (optionnel)</label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions, ressenti, anecdotes..." />
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" type="submit" disabled={saving || parsing || !gpxInfo}>
          {saving ? "Enregistrement…" : "Ajouter au palmarès"}
        </button>
        <button className="btn" type="button" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}

// Passeport Ultra : fiche A4 verticale, masquée à l'écran et révélée
// uniquement à l'impression
// (voir la règle @media print dans index.css). Le visiteur passe par la boîte
// d'impression de son navigateur et choisit "Enregistrer au format PDF".
function AthleteCard({ profile, user, results, stats }) {
  const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="print-sheet">
      <div className="print-head">
        <img src="/logo.png" alt="UltraRide" className="print-logo" />
        <div className="print-doc-type">Passeport Ultra</div>
      </div>

      <div className="print-identity">
        <div className="print-name">{profile?.display_name || "—"}</div>
        <div className="print-email">{user?.email}</div>
      </div>

      <div className="print-section-title">Réalisations</div>
      {results.length === 0 ? (
        <p>Aucune réalisation enregistrée.</p>
      ) : (
        <table className="print-table">
          <thead>
            <tr>
              <th>Année</th>
              <th>Épreuve</th>
              <th>Organisateur</th>
              <th>Distance</th>
              <th>D+</th>
              <th>Temps total</th>
              <th>Moyenne</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td>{r.event_date ? new Date(r.event_date).getFullYear() : "—"}</td>
                <td>{r.race_name}</td>
                <td>{r.organizer_name || "—"}</td>
                <td>{r.distance_km ? `${r.distance_km} km` : "—"}</td>
                <td>{r.elevation_gain ? `${r.elevation_gain.toLocaleString("fr-FR")} m` : "—"}</td>
                <td>{formatDuration(r.total_seconds)}</td>
                <td>{formatSpeed(r.distance_km, r.total_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="print-stats">
        <div>
          <div className="print-stat-num">{stats.count}</div>
          <div className="print-stat-label">Course{stats.count !== 1 ? "s" : ""}</div>
        </div>
        <div>
          <div className="print-stat-num">{Math.round(stats.km).toLocaleString("fr-FR")}</div>
          <div className="print-stat-label">Kilomètres cumulés</div>
        </div>
        <div>
          <div className="print-stat-num">{Math.round(stats.dplus).toLocaleString("fr-FR")}</div>
          <div className="print-stat-label">Mètres de D+ cumulés</div>
        </div>
        {stats.totalSeconds > 0 && (
          <>
            <div>
              <div className="print-stat-num">{formatDuration(stats.totalSeconds)}</div>
              <div className="print-stat-label">Temps total cumulé</div>
            </div>
            <div>
              <div className="print-stat-num">{averageSpeed(stats.km, stats.totalSeconds) || "—"}</div>
              <div className="print-stat-label">km/h de moyenne</div>
            </div>
          </>
        )}
      </div>

      <div className="print-footer">
        Fiche générée le {today} depuis ultraride.eu — chaque réalisation listée est associée à une trace GPS
        déposée par le participant.
      </div>
    </div>
  );
}

export default function PalmaresSection() {
  const { user, profile } = useAuth();
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [openTrackId, setOpenTrackId] = useState(null);

  const load = () => {
    supabase
      .from("race_results")
      .select("*, race:races(id, name)")
      .eq("user_id", user.id)
      .order("event_date", { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setResults(data);
      });
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    if (!results) return null;
    return {
      count: results.length,
      km: results.reduce((sum, r) => sum + (r.distance_km || 0), 0),
      dplus: results.reduce((sum, r) => sum + (r.elevation_gain || 0), 0),
      totalSeconds: results.reduce((sum, r) => sum + (r.total_seconds || 0), 0),
    };
  }, [results]);

  const remove = async (id) => {
    if (!window.confirm("Retirer ce résultat de ton palmarès ?")) return;
    await supabase.from("race_results").delete().eq("id", id);
    setOpenTrackId(null);
    load();
  };

  return (
    <div className="panel" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div className="h2" style={{ margin: 0 }}>Mon palmarès</div>
        {!adding && (
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Ajouter un résultat</button>
        )}
      </div>

      {stats && stats.count > 0 && (
        <>
          <div className="palmares-stats">
            <div>
              <div className="palmares-stat-num">{stats.count}</div>
              <div className="palmares-stat-label">Course{stats.count !== 1 ? "s" : ""}</div>
            </div>
            <div>
              <div className="palmares-stat-num">{Math.round(stats.km).toLocaleString("fr-FR")}</div>
              <div className="palmares-stat-label">km cumulés</div>
            </div>
            <div>
              <div className="palmares-stat-num">{Math.round(stats.dplus).toLocaleString("fr-FR")}</div>
              <div className="palmares-stat-label">m de D+ cumulés</div>
            </div>
            {stats.totalSeconds > 0 && (
              <>
                <div>
                  <div className="palmares-stat-num">{formatDuration(stats.totalSeconds)}</div>
                  <div className="palmares-stat-label">Temps total cumulé</div>
                </div>
                <div>
                  <div className="palmares-stat-num">{averageSpeed(stats.km, stats.totalSeconds) || "—"}</div>
                  <div className="palmares-stat-label">km/h de moyenne</div>
                </div>
              </>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <button className="btn" onClick={() => window.print()}>Télécharger mon Passeport Ultra (PDF)</button>
            <div className="field-hint" style={{ marginTop: 6 }}>
              Ouvre la fenêtre d'impression de ton navigateur — choisis « Enregistrer au format PDF »
              pour obtenir un document A4 à joindre à tes inscriptions.
            </div>
          </div>
        </>
      )}

      {adding && (
        <AddResultForm onSaved={() => { setAdding(false); load(); }} onCancel={() => setAdding(false)} />
      )}

      {error && <div className="error-box">{error}</div>}
      {results === null ? (
        <p className="muted">Chargement…</p>
      ) : results.length === 0 ? (
        <p className="muted">Aucun résultat enregistré pour l'instant.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map((r) => (
            <div key={r.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "var(--disp)", fontWeight: 600 }}>
                    {r.race ? <Link to={`/courses/${r.race.id}`}>{r.race_name}</Link> : r.race_name}
                    {!r.race && r.race_id === null && (
                      <span className="badge" style={{ marginLeft: 8, border: "1px solid var(--line)", color: "var(--paperDim)" }}>Hors répertoire</span>
                    )}
                  </div>
                  <div className="muted mono" style={{ fontSize: 12 }}>
                    {r.organizer_name && `${r.organizer_name} · `}
                    {r.event_date && `${new Date(r.event_date).getFullYear()} · `}
                    {r.distance_km ? `${r.distance_km} km` : ""}
                    {r.elevation_gain ? ` · ${r.elevation_gain.toLocaleString("fr-FR")} D+` : ""}
                  </div>
                  {r.total_seconds != null && (
                    <div className="muted mono" style={{ fontSize: 12 }}>
                      {formatDuration(r.total_seconds)} au total ·{" "}
                      {formatSpeed(r.distance_km, r.total_seconds)} de moyenne
                    </div>
                  )}
                  {r.notes && <p style={{ margin: "6px 0 0", fontSize: 13 }}>{r.notes}</p>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <button
                    className="btn"
                    onClick={() => setOpenTrackId(openTrackId === r.id ? null : r.id)}
                  >
                    {openTrackId === r.id ? "Masquer la trace" : "Voir la trace"}
                  </button>
                  <button className="btn btn-danger" onClick={() => remove(r.id)}>Retirer</button>
                </div>
              </div>

              {openTrackId === r.id && (
                <div style={{ marginTop: 12 }}>
                  <ResultTrackMap track={r.gpx_track} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {results && stats && (
        <AthleteCard profile={profile} user={user} results={results} stats={stats} />
      )}
    </div>
  );
}
