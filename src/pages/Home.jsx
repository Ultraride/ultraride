import { useEffect, useMemo, useState } from "react";
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

function normalize(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function Home() {
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("races")
      .select("id, name, country, discipline, format, mode, parcours, month, km, dplus, open, lat, lon, start_lat, start_lon, blurb, image_url, organizer:organizers!races_organizer_id_fkey(id, name, logo_url)")
      .eq("status", "published")
      .order("created_at", { ascending: false })
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
    return races.filter((r) => {
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
          r.name,
          r.country,
          r.discipline,
          r.format,
          r.parcours,
          r.mode,
          r.month,
          r.blurb,
          r.organizer?.name,
        ].filter(Boolean).join(" "));
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [races, filters, search]);

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

          <div className="wrap" style={{ paddingBottom: 60 }}>
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
