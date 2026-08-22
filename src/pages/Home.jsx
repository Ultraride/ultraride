import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import OverviewMap from "../components/OverviewMap";
import RaceCard from "../components/RaceCard";

const DISCIPLINES = ["Gravel", "Route", "VTT"];
const FORMATS = [
  { id: "course", label: "Course" },
  { id: "aventure", label: "Aventure" },
  { id: "endurance", label: "Endurance" },
];
const PARCOURS = [
  { id: "boucle", label: "Boucle" },
  { id: "point", label: "Point à point" },
  { id: "ar", label: "Aller-retour" },
];
const MODES = ["Autonomie", "Semi-autonomie", "Assisté"];
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const EMPTY_FILTERS = { discipline: null, format: null, parcours: null, mode: "", country: "", month: "", reg: "" };

// Rayon maximum et nombre de fiches du bloc « Près de chez moi ».
const NEARBY_RADIUS_KM = 400;
const NEARBY_LIMIT = 5;

function normalize(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Distance à vol d'oiseau entre deux points, en km.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Position chronologique d'une course dans l'année. On utilise start_date
// quand elle existe, sinon on retombe sur le mois pour que les fiches sans
// date restent mêlées aux autres au bon endroit.
function monthIndex(month) {
  const i = MONTHS.indexOf(month);
  return i === -1 ? 12 : i;
}

function chronoKey(race) {
  if (race.start_date) {
    const d = new Date(race.start_date);
    if (!Number.isNaN(d.getTime())) return d.getMonth() + d.getDate() / 100;
  }
  return monthIndex(race.month);
}

function byChrono(a, b) {
  const diff = chronoKey(a) - chronoKey(b);
  if (diff !== 0) return diff;
  return (a.name || "").localeCompare(b.name || "");
}

// Carrousel horizontal en scroll-snap natif : pas de librairie, tactile sur
// mobile, navigable au clavier. Les flèches sont masquées quand tout tient
// déjà à l'écran.
function RaceCarousel({ title, subtitle, races }) {
  const trackRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 8);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [races]);

  const scrollBy = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(280, el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (!races || races.length === 0) return null;

  return (
    <section className="carousel-section">
      <div className="carousel-head">
        <div>
          <h2 className="carousel-title">{title}</h2>
          {subtitle && <div className="carousel-sub">{subtitle}</div>}
        </div>
        {overflowing && (
          <div className="carousel-nav">
            <button type="button" onClick={() => scrollBy(-1)} aria-label="Voir les courses précédentes">←</button>
            <button type="button" onClick={() => scrollBy(1)} aria-label="Voir les courses suivantes">→</button>
          </div>
        )}
      </div>
      <div className="carousel-track" ref={trackRef}>
        {races.map((r) => (
          <div className="carousel-item" key={r.id}>
            <RaceCard race={r} />
            {r._distanceKm != null && (
              <div className="carousel-item-distance">
                à {Math.round(r._distanceKm)} km de toi
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");

  // Géolocalisation : "idle" tant que le visiteur n'a rien demandé, on ne
  // déclenche jamais la popup du navigateur sans une action de sa part —
  // sauf si la permission a déjà été accordée lors d'une visite précédente.
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | loading | granted | denied | unsupported
  const [coords, setCoords] = useState(null);

  const requestLocation = () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoStatus("granted");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  };

  // Si le visiteur a déjà accepté par le passé, on relance sans le solliciter.
  useEffect(() => {
    if (!navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((res) => {
        if (res.state === "granted") requestLocation();
      })
      .catch(() => { /* Permissions API indisponible, on garde le bouton */ });
  }, []);

  useEffect(() => {
    supabase
      .from("races")
      .select("id, name, country, discipline, format, mode, parcours, month, km, dplus, open, lat, lon, start_lat, start_lon, start_date, view_count, blurb, image_url, organizer:organizers!races_organizer_id_fkey(id, name, logo_url)")
      .eq("status", "published")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRaces(data);
      });
  }, []);

  const countries = useMemo(
    () => (races ? [...new Set(races.map((r) => r.country).filter(Boolean))].sort() : []),
    [races]
  );

  const filtered = useMemo(() => {
    if (!races) return [];
    const q = normalize(search.trim());
    const result = races.filter((r) => {
      if (filters.discipline && r.discipline !== filters.discipline) return false;
      if (filters.format && r.format !== filters.format) return false;
      if (filters.parcours && r.parcours !== filters.parcours) return false;
      if (filters.mode && r.mode !== filters.mode) return false;
      if (filters.country && r.country !== filters.country) return false;
      if (filters.month && r.month !== filters.month) return false;
      if (filters.reg === "open" && !r.open) return false;
      if (filters.reg === "closed" && r.open) return false;

      if (q) {
        const haystack = normalize([
          r.name, r.country, r.discipline, r.format, r.parcours,
          r.mode, r.month, r.blurb, r.organizer?.name,
        ].filter(Boolean).join(" "));
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    return result.sort(byChrono);
  }, [races, filters, search]);

  // Les carrousels sont une vitrine éditoriale : dès que le visiteur filtre
  // ou cherche, ils laissent place à la seule liste qui l'intéresse.
  const isBrowsing = useMemo(
    () =>
      search.trim() === "" &&
      Object.keys(EMPTY_FILTERS).every((k) => filters[k] === EMPTY_FILTERS[k]),
    [filters, search]
  );

  // Mois en cours, ou le prochain mois qui contient des courses.
  const monthlyBlock = useMemo(() => {
    if (!races || races.length === 0) return null;
    const start = new Date().getMonth();
    for (let offset = 0; offset < 12; offset++) {
      const idx = (start + offset) % 12;
      const label = MONTHS[idx];
      const list = races.filter((r) => monthIndex(r.month) === idx).sort(byChrono);
      if (list.length > 0) {
        const picked = list.slice(0, 12);
        // L'année vient des courses elles-mêmes quand start_date est
        // renseignée : c'est plus fiable que de la calculer, et ça reste
        // juste quand le bloc bascule sur janvier de l'année suivante.
        const dated = picked.find((r) => r.start_date);
        const year = dated
          ? new Date(dated.start_date).getFullYear()
          : new Date().getFullYear() + (idx < start ? 1 : 0);
        return { label, year, races: picked, isCurrent: offset === 0 };
      }
    }
    return null;
  }, [races]);

  const mostViewed = useMemo(() => {
    if (!races) return [];
    return races
      .filter((r) => (r.view_count || 0) > 0)
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 12);
  }, [races]);

  const nearby = useMemo(() => {
    if (!races || !coords) return [];
    return races
      .map((r) => {
        const lat = r.start_lat ?? r.lat;
        const lon = r.start_lon ?? r.lon;
        if (lat == null || lon == null) return null;
        return { ...r, _distanceKm: haversineKm(coords.lat, coords.lon, lat, lon) };
      })
      .filter((r) => r && r._distanceKm <= NEARBY_RADIUS_KM)
      .sort((a, b) => a._distanceKm - b._distanceKm)
      .slice(0, NEARBY_LIMIT);
  }, [races, coords]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: f[key] === value ? (typeof value === "string" ? "" : null) : value }));
  const resetFilters = () => { setFilters(EMPTY_FILTERS); setSearch(""); };

  return (
    <div>
      <div className="wrap" style={{ paddingTop: 40 }}>
        <div className="eyebrow">Répertoire ultra-distance · France &amp; Europe</div>
        <h1 className="hero-title">Trouve ta trace.</h1>
        <p className="hero-sub">
          Courses, aventures et défis d'endurance à vélo. Gravel, route, VTT — filtre par mode, terrain et calendrier
          pour construire ta prochaine sortie.
        </p>

        {races && (
          <div className="hero-stats">
            <div><div className="hero-stat-num">{races.length}</div><div className="hero-stat-label">Courses référencées</div></div>
            <div><div className="hero-stat-num">{countries.length}</div><div className="hero-stat-label">Pays couverts</div></div>
            <div><div className="hero-stat-num">{DISCIPLINES.length}</div><div className="hero-stat-label">Disciplines</div></div>
          </div>
        )}
      </div>

      {error && <div className="wrap"><div className="error-box">{error}</div></div>}

      {races === null ? (
        <div className="wrap"><p className="muted">Chargement…</p></div>
      ) : (
        <>
          <div className="wrap">
            <div className="search-bar">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une course, un lieu, un organisateur…"
                aria-label="Rechercher"
              />
              {search && (
                <button type="button" className="filter-reset" onClick={() => setSearch("")}>
                  Effacer
                </button>
              )}
            </div>
          </div>

          <div className="wrap">
            <div className="filter-panel">
              <div className="filter-panel-head">
                <span>Filtres</span>
                <button onClick={resetFilters} className="filter-reset">Réinitialiser</button>
              </div>

              <div className="filter-row">
                {DISCIPLINES.map((d) => (
                  <button key={d} className={`chip ${filters.discipline === d ? "chip-active" : ""}`} onClick={() => setFilter("discipline", d)}>
                    {d}
                  </button>
                ))}
              </div>

              <div className="filter-row">
                {FORMATS.map((f) => (
                  <button key={f.id} className={`chip ${filters.format === f.id ? "chip-active" : ""}`} onClick={() => setFilter("format", f.id)}>
                    {f.label}
                  </button>
                ))}
                <span className="filter-divider" />
                {PARCOURS.map((p) => (
                  <button key={p.id} className={`chip ${filters.parcours === p.id ? "chip-active" : ""}`} onClick={() => setFilter("parcours", p.id)}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="filter-row">
                <select value={filters.mode} onChange={(e) => setFilters((f) => ({ ...f, mode: e.target.value }))}>
                  <option value="">Mode : tous</option>
                  {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filters.country} onChange={(e) => setFilters((f) => ({ ...f, country: e.target.value }))}>
                  <option value="">Pays : tous</option>
                  {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filters.month} onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}>
                  <option value="">Mois : tous</option>
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={filters.reg} onChange={(e) => setFilters((f) => ({ ...f, reg: e.target.value }))}>
                  <option value="">Inscription : toutes</option>
                  <option value="open">Ouvertes</option>
                  <option value="closed">Fermées</option>
                </select>
              </div>
            </div>
          </div>

          <div className="wrap">
            <OverviewMap races={filtered} />
          </div>

          {isBrowsing && (
            <div className="wrap">
              {monthlyBlock && (
                <RaceCarousel
                  title={monthlyBlock.isCurrent
                    ? `Ce mois-ci · ${monthlyBlock.label} ${monthlyBlock.year}`
                    : `Prochainement · ${monthlyBlock.label} ${monthlyBlock.year}`}
                  subtitle={monthlyBlock.isCurrent
                    ? "Les départs du mois en cours"
                    : "Aucun départ ce mois-ci, voici la suite"}
                  races={monthlyBlock.races}
                />
              )}

              {geoStatus === "granted" && nearby.length > 0 ? (
                <RaceCarousel
                  title="Près de chez moi"
                  subtitle={`Les ${nearby.length} départs les plus proches, à moins de ${NEARBY_RADIUS_KM} km`}
                  races={nearby}
                />
              ) : (
                <section className="carousel-section">
                  <div className="carousel-head">
                    <div>
                      <h2 className="carousel-title">Près de chez moi</h2>
                      <div className="carousel-sub">Les départs à moins de {NEARBY_RADIUS_KM} km</div>
                    </div>
                  </div>
                  <div className="geo-prompt">
                    {geoStatus === "loading" && (
                      <p className="muted" style={{ margin: 0 }}>Localisation en cours…</p>
                    )}
                    {geoStatus === "granted" && nearby.length === 0 && (
                      <p className="muted" style={{ margin: 0 }}>
                        Aucun départ référencé à moins de {NEARBY_RADIUS_KM} km de toi pour l'instant.
                      </p>
                    )}
                    {geoStatus === "denied" && (
                      <>
                        <p className="muted" style={{ margin: 0 }}>
                          Localisation refusée. Autorise-la dans les réglages de ton navigateur pour voir les courses proches.
                        </p>
                        <button type="button" className="btn" onClick={requestLocation}>Réessayer</button>
                      </>
                    )}
                    {geoStatus === "unsupported" && (
                      <p className="muted" style={{ margin: 0 }}>
                        Ton navigateur ne permet pas la géolocalisation.
                      </p>
                    )}
                    {geoStatus === "idle" && (
                      <>
                        <p className="muted" style={{ margin: 0 }}>
                          Autorise la géolocalisation pour découvrir les courses les plus proches de toi.
                          Ta position reste dans ton navigateur, elle n'est ni envoyée ni enregistrée.
                        </p>
                        <button type="button" className="btn btn-primary" onClick={requestLocation}>
                          Activer la géolocalisation
                        </button>
                      </>
                    )}
                  </div>
                </section>
              )}

              <RaceCarousel
                title="Les plus consultées"
                subtitle="Ce que regardent les autres coureurs"
                races={mostViewed}
              />
            </div>
          )}

          <div className="wrap" style={{ paddingBottom: 60 }}>
            {isBrowsing && <h2 className="carousel-title" style={{ marginBottom: 4 }}>Toutes les courses</h2>}
            <div className="results-count">
              {filtered.length} course{filtered.length !== 1 ? "s" : ""} trouvée{filtered.length !== 1 ? "s" : ""}
            </div>
            {filtered.length === 0 ? (
              <div className="empty-box">
                <p className="muted">Aucune trace ne correspond à ces filtres.</p>
                <button className="filter-reset" onClick={resetFilters}>Réinitialiser les filtres</button>
              </div>
            ) : (
              <div className="race-grid">
                {filtered.map((r) => <RaceCard key={r.id} race={r} />)}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
