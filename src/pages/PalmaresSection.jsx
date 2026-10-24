import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
      <label>Nom de l'ultra</label>
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
        Si l'ultra existe déjà dans le répertoire (édition passée ou future), sélectionne-le pour rapprocher ton résultat.
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
// uniquement à l'impression (voir « Passeport Ultra — impression » dans
// index.css). Le visiteur passe par la boîte d'impression de son navigateur
// et choisit « Enregistrer au format PDF ».
const ROLE_LABEL = { participant: "Participant", organizer: "Organisateur", admin: "Administrateur" };
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function initials(name, email) {
  const src = (name || email || "?").replace(/@.*/, "").replace(/[._-]+/g, " ").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

function AthleteCard({ profile, user, results, stats }) {
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const since = profile?.created_at ? new Date(profile.created_at) : null;
  const name = profile?.display_name || user?.email?.split("@")[0] || "—";
  // Numéro de passeport stable, tiré de l'identifiant du compte.
  const number = (user?.id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
  const countries = new Set(results.map((r) => r.race?.country).filter(Boolean)).size;
  const fmt = (n) => Math.round(n || 0).toLocaleString("fr-FR");

  // Rendue directement sous <body> : à l'impression, le reste du site est
  // retiré de la mise en page (pas seulement masqué), donc aucune page blanche.
  return createPortal(
    <div className="pp-portal">
    <div className="print-sheet pp-sheet">
      <header className="pp-head">
        <div className="pp-brand">
          <span className="pp-wordmark">ULTRA<span>RIDE</span></span>
          <span className="pp-tagline">ULTRA-CYCLING ALMANAC</span>
        </div>
        <div className="pp-doc">
          <span className="pp-doc-title">PASSEPORT ULTRA</span>
          <span className="pp-doc-meta">N° {number} · délivré le {today}</span>
        </div>
      </header>

      <section className="pp-holder">
        <div className="pp-holder-id">
          <div className="pp-initials">{initials(profile?.display_name, user?.email)}</div>
          <div className="pp-holder-text">
            <span className="pp-label">TITULAIRE</span>
            <span className="pp-name">{name}</span>
            <span className="pp-meta">
              {[ROLE_LABEL[profile?.role] || "Participant",
                since ? `membre depuis ${MONTHS[since.getMonth()]} ${since.getFullYear()}` : null,
                user?.email].filter(Boolean).join(" · ")}
            </span>
          </div>
        </div>
        {stats.count > 0 && (
          <div className="pp-stamp"><span>FINISHER</span><span>×{stats.count}</span></div>
        )}
      </section>

      <section className="pp-stats">
        <div><b>{stats.count}</b><span>ULTRA{stats.count !== 1 ? "S" : ""} TERMINÉ{stats.count !== 1 ? "S" : ""}</span></div>
        <div><b>{fmt(stats.km)}</b><span>KM CUMULÉS</span></div>
        <div><b>{fmt(stats.dplus)}</b><span>M DE D+ CUMULÉS</span></div>
        <div><b>{countries}</b><span>PAYS TRAVERSÉ{countries !== 1 ? "S" : ""}</span></div>
      </section>

      <section className="pp-results">
        <span className="pp-label pp-section">RÉALISATIONS</span>
        {results.length === 0 ? (
          <p className="pp-empty">Aucune réalisation enregistrée.</p>
        ) : (
          <table className="pp-table">
            <thead>
              <tr>
                <th>ANNÉE</th>
                <th>ÉPREUVE</th>
                <th>ORGANISATEUR</th>
                <th className="pp-num">DISTANCE</th>
                <th className="pp-num">D+</th>
                <th className="pp-num">TEMPS</th>
                <th className="pp-center">TRACE</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="pp-mono">{r.event_date ? new Date(r.event_date).getFullYear() : "—"}</td>
                  <td className="pp-strong">{r.race_name}</td>
                  <td>{r.organizer_name || "—"}</td>
                  <td className="pp-num">{r.distance_km ? `${fmt(r.distance_km)} km` : "—"}</td>
                  <td className="pp-num">{r.elevation_gain ? `${fmt(r.elevation_gain)} m` : "—"}</td>
                  <td className="pp-num">{r.total_seconds != null ? formatDuration(r.total_seconds) : "—"}</td>
                  <td className="pp-center pp-mono">{r.gpx_track ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="pp-footer">
        <span className="pp-footer-title">ATTESTATION</span>
        <p>
          Chaque réalisation listée est associée à une trace GPS (.FIT) déposée par le titulaire sur ultraride.eu.
          Ce passeport résume des déclarations du participant ; il ne remplace pas le classement officiel de
          l'organisateur.
        </p>
        <span className="pp-mono">Édité par ultraride.eu</span>
      </footer>
    </div>
    </div>,
    document.body
  );
}

export default function PalmaresSection({ onChange }) {
  const { user, profile } = useAuth();
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [openTrackId, setOpenTrackId] = useState(null);

  const load = () => {
    supabase
      .from("race_results")
      .select("*, race:races(id, name, country)")
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
    onChange?.();
  };

  return (
    <section id="palmares" className="acc-section" aria-labelledby="h-palmares">
      <div className="acc-section-head">
        <h2 id="h-palmares" className="acc-h2">Palmarès</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {stats && stats.count > 0 && (
            <button type="button" className="v2-btn v2-btn-outline acc-btn" onClick={() => window.print()} title="Enregistre ton Passeport Ultra en PDF depuis la fenêtre d'impression">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6" /><rect x="6" y="14" width="12" height="7" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /></svg>
              Passeport PDF
            </button>
          )}
          {!adding && (
            <button type="button" className="v2-btn v2-btn-rust acc-btn" onClick={() => setAdding(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              Ajouter un ultra terminé
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div className="acc-card acc-card-accent">
          <AddResultForm onSaved={() => { setAdding(false); load(); onChange?.(); }} onCancel={() => setAdding(false)} />
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
      {results === null ? (
        <p className="muted">Chargement…</p>
      ) : results.length === 0 ? (
        !adding && (
          <div className="acc-empty">
            <span>Ajoute tes ultras terminés : dépose le fichier .FIT de ta trace, la distance, le dénivelé et le temps sont lus automatiquement.</span>
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {results.map((r, i) => {
            const year = r.event_date ? new Date(r.event_date).getFullYear() : null;
            return (
              <article key={r.id} className="acc-card acc-result">
                <div className="acc-result-row">
                  <span className="acc-year" style={{ transform: `rotate(${i % 2 ? 6 : -8}deg)` }}>{year || "—"}</span>
                  <div className="acc-result-main">
                    <span className="acc-result-name">
                      {r.race ? <Link to={`/courses/${r.race.id}`}>{r.race_name}</Link> : r.race_name}
                      {!r.race && r.race_id === null && <span className="acc-tag">Hors répertoire</span>}
                    </span>
                    <span className="acc-result-sub">{[r.organizer_name, r.notes].filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="acc-result-stats">
                    <div><span className="v2-label">Distance</span><b>{r.distance_km ? `${Math.round(r.distance_km).toLocaleString("fr-FR")} km` : "—"}</b></div>
                    <div><span className="v2-label">D+</span><b>{r.elevation_gain ? `${Math.round(r.elevation_gain).toLocaleString("fr-FR")} m` : "—"}</b></div>
                    <div><span className="v2-label">Temps</span><b>{r.total_seconds != null ? formatDuration(r.total_seconds) : "—"}</b></div>
                    <div><span className="v2-label">Moyenne</span><b>{r.total_seconds != null ? formatSpeed(r.distance_km, r.total_seconds) : "—"}</b></div>
                  </div>
                </div>
                <div className="acc-result-actions">
                  <button type="button" className="acc-linkbtn" onClick={() => setOpenTrackId(openTrackId === r.id ? null : r.id)} aria-expanded={openTrackId === r.id}>
                    {openTrackId === r.id ? "Masquer la trace" : "Voir la trace"}
                  </button>
                  <button type="button" className="acc-linkbtn acc-danger" onClick={() => remove(r.id)}>Retirer</button>
                </div>
                {openTrackId === r.id && (
                  <div style={{ marginTop: 12 }}>
                    <ResultTrackMap track={r.gpx_track} />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {results && stats && (
        <AthleteCard profile={profile} user={user} results={results} stats={stats} />
      )}
    </section>
  );
}
