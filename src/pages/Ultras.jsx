import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import UltrasMap from "../components/UltrasMap";
import SiteFooter from "../components/SiteFooter";
import { RaceRow } from "../components/RaceBits";
import {
  LIST_COLUMNS, DISCIPLINE_COLOR, FORMAT_LABEL, PARCOURS_LABEL,
  normalize, isUpcoming, byStartDate, monthGroup, raceCoords, parseDate, MONTH_NAMES,
} from "../lib/raceDisplay";

const DISCIPLINES = ["Route", "Gravel", "VTT"];
const FORMATS = ["course", "aventure", "endurance"];
const MODES = ["Autonomie", "Semi-autonomie", "Assisté"];
const MIN_KM = [
  { value: 0, label: "Toutes les distances" },
  { value: 300, label: "300 km et plus" },
  { value: 500, label: "500 km et plus" },
  { value: 1000, label: "1 000 km et plus" },
  { value: 2000, label: "2 000 km et plus" },
];
const PAGE = 40;

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// Mois de départ d'une fiche (0-11) : celui de la date, sinon le mois saisi.
function raceMonth(r) {
  const d = parseDate(r.start_date);
  if (d) return d.getMonth();
  const i = MONTH_NAMES.indexOf(r.month);
  return i >= 0 ? i : null;
}

// Menu déroulant à cases à cocher : plusieurs mois possibles.
function MonthPicker({ selected, onChange, counts }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const list = [...selected].sort((a, b) => a - b);
  const label = list.length === 0 ? "Tous"
    : list.length <= 2 ? list.map((m) => MONTH_NAMES[m]).join(", ")
    : `${list.length} mois`;

  return (
    <div className="v2-months" ref={ref}>
      <button type="button" className="v2-input v2-months-btn" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="muted" style={{ fontSize: 14 }}>Mois :</span>
        <strong>{label}</strong>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="v2-months-pop" role="group" aria-label="Mois de départ">
          <div className="v2-months-grid">
            {MONTH_NAMES.map((name, i) => (
              <label key={name} className={`v2-month${selected.has(i) ? " on" : ""}${counts[i] ? "" : " empty"}`}>
                <input type="checkbox" checked={selected.has(i)} onChange={() => onChange(toggleInSet(selected, i))} />
                <span>{name}</span>
                <small>{counts[i] || 0}</small>
              </label>
            ))}
          </div>
          <div className="v2-months-foot">
            <button type="button" className="v2-months-clear" disabled={!selected.size} onClick={() => onChange(new Set())}>Effacer</button>
            <button type="button" className="v2-btn v2-btn-ink" onClick={() => setOpen(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

function toggleInSet(set, value) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

export default function Ultras() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);

  // Les liens de l'accueil arrivent avec ?q=… ou ?discipline=… ; ?mois=5 (1-12) filtre par mois.
  const [search, setSearch] = useState(params.get("q") || "");
  const [disciplines, setDisciplines] = useState(() => new Set(params.getAll("discipline")));
  const [formats, setFormats] = useState(() => new Set());
  const [minKm, setMinKm] = useState(0);
  const [country, setCountry] = useState("");
  const [mode, setMode] = useState("");
  const [parcours, setParcours] = useState("");
  const [openOnly, setOpenOnly] = useState(false);
  const [months, setMonths] = useState(
    () => new Set(params.getAll("mois").map((m) => Number(m) - 1).filter((m) => m >= 0 && m < 12))
  );
  // Tri unique par date de départ (le menu « Trier » a été retiré).
  const sort = "date";
  const [view, setView] = useState("split");
  const [zoneOnly, setZoneOnly] = useState(false);
  const [bounds, setBounds] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [limit, setLimit] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Garde la recherche, les disciplines et les mois dans l'URL : la page
  // filtrée se partage telle quelle.
  useEffect(() => {
    const next = new URLSearchParams();
    if (search.trim()) next.set("q", search.trim());
    disciplines.forEach((d) => next.append("discipline", d));
    [...months].sort((a, b) => a - b).forEach((m) => next.append("mois", String(m + 1)));
    setParams(next, { replace: true });
  }, [search, disciplines, months, setParams]);

  useEffect(() => { setLimit(PAGE); }, [search, disciplines, formats, minKm, country, mode, parcours, openOnly, months, sort, zoneOnly]);

  const countries = useMemo(
    () => (races ? [...new Set(races.map((r) => r.country).filter(Boolean))].sort((a, b) => a.localeCompare(b)) : []),
    [races]
  );

  // Base commune : départs à venir + fiches sans date. Sur douze mois glissants,
  // chaque mois coché désigne donc un seul mois du calendrier.
  const base = useMemo(() => {
    if (!races) return [];
    return races.filter((r) => !r.start_date || isUpcoming(r));
  }, [races]);

  const monthCounts = useMemo(() => {
    const c = Array(12).fill(0);
    base.forEach((r) => { const m = raceMonth(r); if (m !== null) c[m] += 1; });
    return c;
  }, [base]);

  const disciplineCounts = useMemo(
    () => Object.fromEntries(DISCIPLINES.map((d) => [d, base.filter((r) => r.discipline === d).length])),
    [base]
  );

  const filtered = useMemo(() => {
    const q = normalize(search.trim());
    const list = base.filter((r) => {
      if (months.size && !months.has(raceMonth(r))) return false;
      if (disciplines.size && !disciplines.has(r.discipline)) return false;
      if (formats.size && !formats.has(r.format)) return false;
      if (minKm && !(Number(r.km) >= minKm)) return false;
      if (country && r.country !== country) return false;
      if (mode && r.mode !== mode) return false;
      if (parcours && r.parcours !== parcours) return false;
      if (openOnly && !r.open) return false;
      if (q) {
        const hay = normalize([r.name, r.country, r.discipline, r.start_place, r.end_place, r.organizer?.name, r.organizer_name, r.blurb].filter(Boolean).join(" "));
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorters = {
      date: byStartDate,
      km: (a, b) => (Number(b.km) || 0) - (Number(a.km) || 0),
      dplus: (a, b) => (Number(b.dplus) || 0) - (Number(a.dplus) || 0),
      recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    };
    return list.sort(sorters[sort]);
  }, [base, search, months, disciplines, formats, minKm, country, mode, parcours, openOnly, sort]);

  // Filtre « zone visible » : la liste suit la carte quand on la déplace.
  const listed = useMemo(() => {
    if (!zoneOnly || !bounds) return filtered;
    return filtered.filter((r) => {
      const c = raceCoords(r);
      return c && bounds.contains(c);
    });
  }, [filtered, zoneOnly, bounds]);

  const activeCount =
    (months.size ? 1 : 0) + (disciplines.size ? 1 : 0) + (formats.size ? 1 : 0) + (minKm ? 1 : 0) + (country ? 1 : 0) +
    (mode ? 1 : 0) + (parcours ? 1 : 0) + (openOnly ? 1 : 0);

  const reset = () => {
    setMonths(new Set()); setDisciplines(new Set()); setFormats(new Set()); setMinKm(0); setCountry("");
    setMode(""); setParcours(""); setOpenOnly(false); setSearch(""); setZoneOnly(false);
  };

  const summary = [
    `${listed.length} ultra${listed.length !== 1 ? "s" : ""}`,
    months.size ? [...months].sort((a, b) => a - b).map((m) => MONTH_NAMES[m]).join(", ") : null,
    disciplines.size ? [...disciplines].join(", ") : null,
    formats.size ? [...formats].map((f) => FORMAT_LABEL[f]).join(", ") : null,
    openOnly ? "inscriptions ouvertes" : null,
    zoneOnly ? "dans la zone visible" : null,
  ].filter(Boolean).join(" · ");

  const shown = listed.slice(0, limit);
  const grouped = sort === "date";
  let lastGroup = null;

  return (
    <div className="v2">
      <div className="v2-wrap">
        <div className="v2-ultras-top">
          <h1>ULTRAS</h1>
          <label className="v2-input" style={{ flex: "1 1 300px" }}>
            <SearchIcon />
            <span className="sr-only">Rechercher un ultra</span>
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, lieu, pays, organisateur…" />
          </label>
          <MonthPicker selected={months} onChange={setMonths} counts={monthCounts} />
          <div className="v2-toggle" role="group" aria-label="Affichage">
            <button type="button" aria-pressed={view === "split"} onClick={() => setView("split")}>Liste<span className="v2-desk-only"> + carte</span></button>
            <button type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Carte<span className="v2-desk-only"> seule</span></button>
          </div>
          <button
            type="button"
            className="v2-btn v2-btn-ink v2-filters-toggle"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            Filtres{activeCount ? ` · ${activeCount}` : ""}
          </button>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className={`v2-ultras-layout${view === "map" ? " v2-map-only" : ""}`}>
          <aside className={`v2-filters${filtersOpen ? " v2-filters-open" : ""}`} aria-label="Filtres">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span className="v2-h3" style={{ fontSize: 12 }}>Filtres{activeCount ? ` · ${activeCount}` : ""}</span>
              <button type="button" onClick={reset} style={{ border: "none", background: "none", padding: "8px 0", fontSize: 13, color: "var(--rust-text)", fontWeight: 600 }}>
                Réinitialiser
              </button>
            </div>

            <fieldset>
              <legend>Discipline</legend>
              {DISCIPLINES.map((d) => (
                <label key={d} className="v2-check">
                  <input type="checkbox" checked={disciplines.has(d)} onChange={() => setDisciplines((s) => toggleInSet(s, d))} />
                  <span className="v2-dot" style={{ background: DISCIPLINE_COLOR[d] }} />{d}
                  <small>{disciplineCounts[d]}</small>
                </label>
              ))}
            </fieldset>

            <fieldset>
              <legend>Format</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {FORMATS.map((f) => (
                  <button key={f} type="button" className="v2-fchip" aria-pressed={formats.has(f)} onClick={() => setFormats((s) => toggleInSet(s, f))}>
                    {FORMAT_LABEL[f]}
                  </button>
                ))}
              </div>
            </fieldset>

            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="v2-flabel">Distance</span>
              <select className="v2-select" value={minKm} onChange={(e) => setMinKm(Number(e.target.value))}>
                {MIN_KM.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="v2-flabel">Pays</span>
              <select className="v2-select" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Tous les pays ({countries.length})</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="v2-flabel">Mode</span>
              <select className="v2-select" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="">Tous les modes</option>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="v2-flabel">Parcours</span>
              <select className="v2-select" value={parcours} onChange={(e) => setParcours(e.target.value)}>
                <option value="">Tous les parcours</option>
                {Object.entries(PARCOURS_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>

            <label className="v2-check">
              <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} />
              Inscriptions ouvertes
            </label>
          </aside>

          <section className="v2-results" aria-label="Résultats">
            <div className="v2-label" style={{ textTransform: "none", fontSize: 12, paddingBottom: 6 }}>
              {races === null ? "Chargement…" : summary}
            </div>

            {races && listed.length === 0 && (
              <div className="v2-geo" style={{ marginTop: 12 }}>
                <p className="muted" style={{ margin: 0, fontSize: 15 }}>Aucun ultra ne correspond à ces filtres.</p>
                <button type="button" className="v2-btn v2-btn-outline" onClick={reset}>Réinitialiser</button>
              </div>
            )}

            {shown.map((r) => {
              const g = monthGroup(r);
              const header = grouped && g.key !== lastGroup ? <div className="v2-month">{g.label}</div> : null;
              lastGroup = g.key;
              return (
                <Fragment key={r.id}>
                  {header}
                  <RaceRow race={r} highlighted={hoveredId === r.id} onHover={setHoveredId} />
                </Fragment>
              );
            })}

            {listed.length > shown.length && (
              <button type="button" className="v2-btn v2-btn-outline" style={{ marginTop: 18 }} onClick={() => setLimit((n) => n + PAGE)}>
                Afficher les {Math.min(PAGE, listed.length - shown.length)} suivants
              </button>
            )}
          </section>

          <section className="v2-mapcol" aria-label="Carte">
            <div className="v2-mapbox">
              <UltrasMap
                races={filtered}
                hoveredId={hoveredId}
                onBoundsChange={setBounds}
                onOpen={(id) => navigate(`/courses/${id}`)}
              />
              <label className="v2-map-overlay v2-map-zone">
                <input type="checkbox" checked={zoneOnly} onChange={(e) => setZoneOnly(e.target.checked)} />
                Filtrer selon la zone visible
              </label>
              <div className="v2-map-overlay v2-map-legend">
                {DISCIPLINES.map((d) => (
                  <span key={d} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="v2-dot" style={{ background: DISCIPLINE_COLOR[d] }} />{d}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}

