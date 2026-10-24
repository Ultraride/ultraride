import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useRaces, chronoRank, groupLabel, matchesSearch, MONTHS } from "./data";
import { RaceRow, MenuButton, Icon, disciplineBg, formatLabel } from "./ui";

const DISCIPLINES = ["Route", "Gravel", "VTT", "Bikepacking"];
const FORMATS = ["course", "aventure", "endurance"];
const MODES = ["Autonomie", "Semi-autonomie", "Assisté"];
const EMPTY = { d: "", f: "", m: "", c: "", mo: "", reg: "" };

export default function MobileList() {
  const { races, error } = useRaces();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [filters, setFilters] = useState({ ...EMPTY, d: params.get("d") || "" });
  const [sheet, setSheet] = useState(false);
  const [showPast, setShowPast] = useState(false);

  // La recherche reste dans l'URL : retour arrière depuis une fiche = même liste.
  useEffect(() => {
    const next = {};
    if (q) next.q = q;
    if (filters.d) next.d = filters.d;
    setParams(next, { replace: true });
  }, [q, filters.d]);

  const countries = useMemo(
    () => (races ? [...new Set(races.map((r) => r.country).filter(Boolean))].sort() : []),
    [races]
  );

  const results = useMemo(() => {
    if (!races) return [];
    return races
      .filter((r) =>
        (!filters.d || r.discipline === filters.d) &&
        (!filters.f || r.format === filters.f) &&
        (!filters.m || r.mode === filters.m) &&
        (!filters.c || r.country === filters.c) &&
        (!filters.mo || r.month === filters.mo) &&
        (filters.reg !== "open" || r.open) &&
        matchesSearch(r, q.trim())
      )
      .sort((a, b) => chronoRank(a) - chronoRank(b));
  }, [races, filters, q]);

  const groups = useMemo(() => {
    const out = [];
    let cur = null;
    results.forEach((r) => {
      const label = groupLabel(r);
      if (label === "Éditions passées" && !showPast) return;
      if (!cur || cur.label !== label) { cur = { label, items: [] }; out.push(cur); }
      cur.items.push(r);
    });
    return out;
  }, [results, showPast]);

  const pastCount = useMemo(() => results.filter((r) => groupLabel(r) === "Éditions passées").length, [results]);
  const activeCount = Object.keys(EMPTY).filter((k) => k !== "d" && filters[k]).length;
  const set = (k, v) => setFilters((f) => ({ ...f, [k]: f[k] === v ? "" : v }));

  return (
    <div className="m-screen">
      <div className="m-stickyhead">
        <div className="m-pad m-stack m-stack--tight">
          <div className="m-topbar">
            <h1 className="m-h1 m-h1--page">ULTRAS</h1>
            <div className="m-topbar-right">
              <span className="m-label">{races ? `${results.length} résultat${results.length !== 1 ? "s" : ""}` : ""}</span>
              <MenuButton />
            </div>
          </div>
          <div className="m-searchrow">
            <label className="m-search">
              <Icon name="search" size={18} />
              <span className="m-sr">Rechercher un ultra</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, lieu, organisateur…" enterKeyHint="search" />
            </label>
            <button type="button" className="m-squarebtn" aria-label={`Filtres${activeCount ? ` (${activeCount} actifs)` : ""}`} onClick={() => setSheet(true)}>
              <Icon name="sliders" size={18} />
              {activeCount > 0 && <span className="m-badge">{activeCount}</span>}
            </button>
          </div>
          <div className="m-chips">
            <button type="button" className={`m-chip${!filters.d ? " m-chip--on" : ""}`} onClick={() => setFilters((f) => ({ ...f, d: "" }))}>Tous</button>
            {DISCIPLINES.map((d) => (
              <button key={d} type="button" className={`m-chip${filters.d === d ? " m-chip--on" : ""}`} onClick={() => set("d", d)}>
                <span className="m-chip-dot" style={{ background: disciplineBg(d) }} />{d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="m-pad">
        {error && <div className="m-error">Impossible de charger les ultras ({error}).</div>}
        {!races && !error && <div className="m-skeleton" style={{ height: 400, marginTop: 16 }} />}
        {races && results.length === 0 && (
          <div className="m-empty">
            <p>Aucun ultra ne correspond.</p>
            <button type="button" className="m-btn m-btn--ghost" onClick={() => { setQ(""); setFilters(EMPTY); }}>Réinitialiser</button>
          </div>
        )}
        {groups.map((g) => (
          <section key={g.label}>
            <h2 className="m-label m-label--green m-group">{g.label.toUpperCase()}</h2>
            {g.items.map((r) => <RaceRow key={r.id} race={r} />)}
          </section>
        ))}
        {pastCount > 0 && !showPast && (
          <button type="button" className="m-btn m-btn--ghost m-btn--block" style={{ marginTop: 20 }} onClick={() => setShowPast(true)}>
            Afficher les {pastCount} éditions passées
          </button>
        )}
      </div>

      {sheet && (
        <div className="m-sheet-backdrop" onClick={() => setSheet(false)}>
          <div className="m-sheet" role="dialog" aria-label="Filtres" onClick={(e) => e.stopPropagation()}>
            <div className="m-sheet-head">
              <span className="m-h2">Filtres</span>
              <button type="button" className="m-roundbtn m-roundbtn--light" aria-label="Fermer" onClick={() => setSheet(false)}><Icon name="close" /></button>
            </div>
            <div className="m-filter-group">
              <span className="m-label">FORMAT</span>
              <div className="m-chips m-chips--wrap">
                {FORMATS.map((f) => (
                  <button key={f} type="button" className={`m-chip${filters.f === f ? " m-chip--on" : ""}`} onClick={() => set("f", f)}>{formatLabel(f)}</button>
                ))}
              </div>
            </div>
            <div className="m-filter-group">
              <span className="m-label">MODE</span>
              <div className="m-chips m-chips--wrap">
                {MODES.map((m) => (
                  <button key={m} type="button" className={`m-chip${filters.m === m ? " m-chip--on" : ""}`} onClick={() => set("m", m)}>{m}</button>
                ))}
              </div>
            </div>
            <div className="m-filter-group">
              <label className="m-label" htmlFor="m-f-country">PAYS</label>
              <select id="m-f-country" className="m-select" value={filters.c} onChange={(e) => setFilters((f) => ({ ...f, c: e.target.value }))}>
                <option value="">Tous les pays</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="m-filter-group">
              <label className="m-label" htmlFor="m-f-month">MOIS</label>
              <select id="m-f-month" className="m-select" value={filters.mo} onChange={(e) => setFilters((f) => ({ ...f, mo: e.target.value }))}>
                <option value="">Tous les mois</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="m-filter-group">
              <span className="m-label">INSCRIPTIONS</span>
              <div className="m-chips m-chips--wrap">
                <button type="button" className={`m-chip${filters.reg === "open" ? " m-chip--on" : ""}`} onClick={() => set("reg", "open")}>Ouvertes uniquement</button>
              </div>
            </div>
            <div className="m-sheet-foot">
              <button type="button" className="m-btn m-btn--ghost" onClick={() => setFilters((f) => ({ ...EMPTY, d: f.d }))}>Réinitialiser</button>
              <button type="button" className="m-btn m-btn--primary" onClick={() => setSheet(false)}>Voir {results.length} ultra{results.length !== 1 ? "s" : ""}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
