import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import L from "leaflet";
import { useRaces, useGeo, startCoords, isUpcoming, daysUntil } from "./data";
import { Icon, Pill, Stat, raceStats, disciplineBg } from "./ui";

// Vue par défaut : l'Europe, comme sur le site.
const EUROPE_BOUNDS = [[38.57, -8.75], [58.57, 24.25]];

export default function MobileMap() {
  const { races, error } = useRaces();
  const geo = useGeo();
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const [selected, setSelected] = useState(null);

  // Sur la carte : les départs à venir et ceux sans date connue.
  const visible = useMemo(
    () => (races ? races.filter((r) => startCoords(r) && (isUpcoming(r) || !r.start_date)) : []),
    [races]
  );

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return;
    const map = L.map(boxRef.current, { zoomControl: false, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    map.fitBounds(EUROPE_BOUNDS);
    map.on("click", () => setSelected(null));
    mapRef.current = map;
    // Safari ajuste la hauteur visible (barres qui apparaissent/disparaissent) :
    // la carte recalcule sa taille à chaque changement pour rester pleine page.
    const fit = () => map.invalidateSize();
    const ro = new ResizeObserver(fit);
    ro.observe(boxRef.current);
    const t = setTimeout(fit, 50);
    return () => { clearTimeout(t); ro.disconnect(); map.remove(); mapRef.current = null; markersRef.current.clear(); };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    visible.forEach((r) => {
      const m = L.circleMarker(startCoords(r), {
        radius: 9,
        color: "#FFFFFF",
        weight: 2.5,
        fillColor: disciplineBg(r.discipline),
        fillOpacity: 1,
      });
      m.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        setSelected(r);
      });
      m.addTo(map);
      markersRef.current.set(r.id, m);
    });
  }, [visible]);

  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const on = selected?.id === id;
      m.setStyle({ radius: on ? 13 : 9, weight: on ? 3.5 : 2.5 });
      if (on) m.bringToFront();
    });
    if (selected && mapRef.current) {
      const map = mapRef.current;
      // Le point choisi se place au-dessus de la fiche qui monte du bas.
      const pt = map.project(startCoords(selected), map.getZoom()).add([0, 110]);
      map.panTo(map.unproject(pt, map.getZoom()), { animate: true });
    }
  }, [selected]);

  useEffect(() => {
    if (geo.coords && mapRef.current) mapRef.current.setView([geo.coords.lat, geo.coords.lon], 7);
  }, [geo.coords]);

  const j = selected ? daysUntil(selected) : null;

  return (
    <div className="m-mapscreen">
      <div ref={boxRef} className="m-map" role="region" aria-label="Carte des ultras" />

      <div className="m-map-top">
        <Link to="/ultras" className="m-searchpill m-searchpill--float">
          <Icon name="search" />
          <span>Chercher un ultra…</span>
        </Link>
        <Link to="/ultras" className="m-roundbtn m-roundbtn--dark m-roundbtn--lg" aria-label="Voir en liste">
          <Icon name="list" />
        </Link>
      </div>

      {races && (
        <span className="m-map-count m-label">{visible.length} DÉPARTS À VENIR</span>
      )}
      {error && <div className="m-error m-map-error">Impossible de charger les ultras ({error}).</div>}

      <button
        type="button"
        className={`m-roundbtn m-roundbtn--light m-roundbtn--lg m-map-locate${selected ? " is-raised" : ""}`}
        aria-label="Me localiser"
        onClick={geo.request}
      >
        <Icon name="locate" />
      </button>

      {selected && (
        <div className="m-mapsheet">
          <span className="m-grabber" />
          <div className="m-mapsheet-row">
            <span className="m-label m-label--green">
              {selected.start_place ? `DÉPART · ${selected.start_place.split(",")[0].toUpperCase()}` : (selected.country || "").toUpperCase()}
            </span>
            <button type="button" className="m-iconbtn" aria-label="Fermer" onClick={() => setSelected(null)}><Icon name="close" size={18} /></button>
          </div>
          <div className="m-mapsheet-tags">
            {selected.discipline && <Pill bg={disciplineBg(selected.discipline)} tone="solid">{selected.discipline.toUpperCase()}</Pill>}
            {j != null && <span className="m-label m-label--rust">J-{j}</span>}
          </div>
          <div className="m-mapsheet-title">{selected.name}</div>
          {selected.blurb && <p className="m-mapsheet-blurb">{selected.blurb}</p>}
          <div className="m-stats3 m-stats3--dashed">
            {raceStats(selected).map((s) => <Stat key={s.label} {...s} />)}
          </div>
          <Link to={`/courses/${selected.id}`} className="m-btn m-btn--dark m-btn--block">Voir la fiche</Link>
        </div>
      )}
    </div>
  );
}
