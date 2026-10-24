import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import SiteFooter from "../components/SiteFooter";
import DataFreshness from "../components/DataFreshness";
import { RaceRow, RaceTile, DisciplineBadge, FormatBadge } from "../components/RaceBits";
import {
  LIST_COLUMNS, DISCIPLINE_COLOR, isUpcoming, byStartDate, countdownLabel,
  formatLongDate, formatNumber, haversineKm, raceCoords, placeLine,
} from "../lib/raceDisplay";

// Rayon maximum et nombre de fiches du bloc « Près de toi ».
const NEARBY_RADIUS_KM = 400;
const NEARBY_LIMIT = 4;
const DISCIPLINES = ["Route", "Gravel", "VTT"];

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// Courbes de niveau du bloc « À la une », plus un tracé quand l'ultra n'a pas de visuel.
function FeatureArt({ withRoute }) {
  return (
    <svg viewBox="0 0 600 380" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      {[330, 290, 250, 210, 170].map((y, i) => (
        <path key={y} d={`M-20 ${y} C 90 ${y - 50}, ${160 + i * 10} ${y + 10}, ${280 + i * 10} ${y - 30} S ${470 + i * 10} ${y - 110}, 620 ${y - 70}`} stroke="#2C4434" strokeWidth="1.4" />
      ))}
      {withRoute && (
        <>
          <path d="M560 230 L 520 200 L 536 160 L 480 150 L 450 176 L 400 130" stroke="#C4622D" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="560" cy="230" r="8" fill="#F5F1E6" />
          <circle cx="400" cy="130" r="8" fill="#C4622D" stroke="#F5F1E6" strokeWidth="3" />
        </>
      )}
    </svg>
  );
}

function FeaturedRace({ race }) {
  const countdown = countdownLabel(race);
  return (
    <Link to={`/courses/${race.id}`} className="v2-feature">
      <div className="v2-feature-media">
        <FeatureArt withRoute={!race.image_url} />
        <span className="v2-feature-tag">À LA UNE</span>
        {countdown && (
          <div className="v2-stamp"><span>DÉPART</span><span>{countdown === "Aujourd'hui" ? "J-0" : countdown}</span></div>
        )}
        {race.image_url && <img className="v2-feature-logo" src={race.image_url} alt="" />}
        <div className="v2-feature-bottom">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <DisciplineBadge discipline={race.discipline} light />
            <FormatBadge format={race.format} />
            {race.country && (
              <span className="v2-pill" style={{ background: "rgba(245,241,230,0.16)", color: "#F5F1E6", fontWeight: 600 }}>
                {race.country.toUpperCase()}
              </span>
            )}
          </div>
          <div className="v2-feature-name">{race.name}</div>
        </div>
      </div>
      <div className="v2-statgrid">
        <div className="v2-stat"><span className="v2-label">Distance</span><b>{race.km ? `${formatNumber(race.km)} km` : "—"}</b></div>
        <div className="v2-stat"><span className="v2-label">D+</span><b>{race.dplus ? `${formatNumber(race.dplus)} m` : "—"}</b></div>
        <div className="v2-stat"><span className="v2-label">Départ</span><b>{formatLongDate(race.start_date) || race.month || "—"}</b></div>
        <div className="v2-stat"><span className="v2-label">Lieu</span><b style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{placeLine({ ...race, country: null }) || race.country || "—"}</b></div>
      </div>
    </Link>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

  // Géolocalisation : jamais demandée sans action du visiteur, sauf si la
  // permission a déjà été accordée lors d'une visite précédente.
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | loading | granted | denied | unsupported
  const [coords, setCoords] = useState(null);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) { setGeoStatus("unsupported"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGeoStatus("granted"); },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  };

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    navigator.permissions.query({ name: "geolocation" })
      .then((res) => { if (res.state === "granted") requestLocation(); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    supabase
      .from("races")
      .select(LIST_COLUMNS)
      .eq("status", "published")
      .eq("is_current", true)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRaces(data || []);
      });
  }, []);

  const stats = useMemo(() => {
    if (!races) return null;
    const organizers = new Set(races.map((r) => r.organizer?.id || r.organizer_name).filter(Boolean));
    const countries = new Set(races.map((r) => r.country).filter(Boolean));
    const byDiscipline = Object.fromEntries(DISCIPLINES.map((d) => [d, races.filter((r) => r.discipline === d).length]));
    return { total: races.length, organizers: organizers.size, countries: countries.size, byDiscipline };
  }, [races]);

  const upcoming = useMemo(
    () => (races || []).filter(isUpcoming).sort(byStartDate),
    [races]
  );

  // « À la une » : l'ultra à venir illustré le plus consulté, sinon le prochain départ.
  const featured = useMemo(() => {
    const withImage = upcoming.filter((r) => r.image_url);
    const pool = withImage.length ? withImage : upcoming;
    if (!pool.length) return null;
    return [...pool].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];
  }, [upcoming]);

  const nextDepartures = useMemo(
    () => upcoming.filter((r) => r.id !== featured?.id).slice(0, 6),
    [upcoming, featured]
  );

  const nearby = useMemo(() => {
    if (!coords) return [];
    return upcoming
      .map((r) => {
        const c = raceCoords(r);
        return c ? { ...r, _distanceKm: haversineKm(coords.lat, coords.lon, c[0], c[1]) } : null;
      })
      .filter((r) => r && r._distanceKm <= NEARBY_RADIUS_KM)
      .sort((a, b) => a._distanceKm - b._distanceKm)
      .slice(0, NEARBY_LIMIT);
  }, [upcoming, coords]);

  const submitSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    navigate(`/ultras${params.toString() ? `?${params}` : ""}`);
  };

  return (
    <div className="v2">
      <div className="v2-wrap">
        <section className="v2-hero">
          <div className="v2-hero-text">
            <div className="v2-eyebrow">
              {stats ? `${stats.total} ultras · ${stats.organizers} organisateurs · ${stats.countries} pays` : "Répertoire ultra-distance"}
            </div>
            <h1 className="v2-hero-title">TROUVE TON<br />PROCHAIN ULTRA</h1>
            <p className="v2-hero-sub">
              Route, gravel et VTT en autonomie, en Europe et en Afrique du Nord. Les dates, les parcours et les
              inscriptions au même endroit.
            </p>

            <form className="v2-search" onSubmit={submitSearch} role="search">
              <label className="v2-search-field">
                <SearchIcon />
                <span className="sr-only">Rechercher un ultra</span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nom, pays, organisateur…"
                />
              </label>
              <button type="submit" className="v2-btn v2-btn-rust">Rechercher</button>
            </form>

            <div className="v2-chips">
              <Link to="/ultras" className="v2-chip v2-chip-active">Tous</Link>
              {DISCIPLINES.map((d) => (
                <Link key={d} to={`/ultras?discipline=${encodeURIComponent(d)}`} className="v2-chip">
                  <span className="v2-dot" style={{ background: DISCIPLINE_COLOR[d] }} />
                  {d}{stats ? ` · ${stats.byDiscipline[d]}` : ""}
                </Link>
              ))}
            </div>
          </div>

          {featured && <FeaturedRace race={featured} />}
        </section>

        <DataFreshness />

        {error && <div className="error-box">{error}</div>}
        {races === null && !error && <p className="muted">Chargement…</p>}

        {nextDepartures.length > 0 && (
          <section className="v2-section">
            <div className="v2-section-head">
              <h2 className="v2-h2">Prochains départs</h2>
              <Link to="/ultras" className="v2-link">Voir les {upcoming.length} départs à venir →</Link>
            </div>
            <div className="v2-grid-rows">
              {nextDepartures.map((r) => <RaceRow key={r.id} race={r} />)}
            </div>
          </section>
        )}

        {races && (
          <section className="v2-section">
            <div className="v2-section-head">
              <h2 className="v2-h2">Près de toi</h2>
              <Link to="/ultras" className="v2-link">Voir sur la carte →</Link>
            </div>
            {geoStatus === "granted" && nearby.length > 0 ? (
              <div className="v2-grid-tiles">
                {nearby.map((r, i) => (
                  <RaceTile
                    key={r.id}
                    race={r}
                    index={i}
                    footer={<span className="v2-countdown" style={{ color: "#15793F" }}>à {Math.round(r._distanceKm)} km de toi</span>}
                  />
                ))}
              </div>
            ) : (
              <div className="v2-geo">
                <p className="muted" style={{ margin: 0, fontSize: 15, maxWidth: 640 }}>
                  {geoStatus === "loading" && "Localisation en cours…"}
                  {geoStatus === "granted" && `Aucun départ à venir à moins de ${NEARBY_RADIUS_KM} km de toi pour l'instant.`}
                  {geoStatus === "denied" && "Localisation refusée. Autorise-la dans les réglages de ton navigateur pour voir les ultras proches."}
                  {geoStatus === "unsupported" && "Ton navigateur ne permet pas la géolocalisation."}
                  {geoStatus === "idle" && `Active la géolocalisation pour voir les départs à moins de ${NEARBY_RADIUS_KM} km. Ta position reste dans ton navigateur : elle n'est ni envoyée ni enregistrée.`}
                </p>
                {(geoStatus === "idle" || geoStatus === "denied") && (
                  <button type="button" className="v2-btn v2-btn-ink" onClick={requestLocation}>
                    {geoStatus === "denied" ? "Réessayer" : "Activer la géolocalisation"}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {stats && (
          <section className="v2-section" style={{ paddingBottom: 56 }}>
            <div className="v2-disc-tiles">
              {DISCIPLINES.map((d) => (
                <Link
                  key={d}
                  to={`/ultras?discipline=${encodeURIComponent(d)}`}
                  className="v2-disc-tile"
                  style={{ background: d === "VTT" ? "#9A4519" : DISCIPLINE_COLOR[d] }}
                >
                  <b>{stats.byDiscipline[d]}</b>
                  <span>ULTRAS {d.toUpperCase()} →</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="v2-band">
        <div className="v2-wrap v2-band-inner">
          <div style={{ flex: "1 1 460px", display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="v2-eyebrow" style={{ color: "#E9A27A" }}>Organisateurs</span>
            <h2>TU ORGANISES UN ULTRA ?</h2>
            <p>Crée ton espace, ajoute tes éditions et tiens tes dates à jour. Chaque nouvelle édition garde l'historique des précédentes.</p>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link to="/proposer-course" className="v2-btn v2-btn-rust">Proposer un ultra</Link>
            <Link to="/login?mode=signup" className="v2-btn v2-btn-outline-light">Créer mon espace</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
