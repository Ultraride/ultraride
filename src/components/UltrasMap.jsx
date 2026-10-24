import { useEffect, useRef } from "react";
import L from "leaflet";
import { disciplineColor, raceCoords, countdownLabel, statsLine, formatShortDate } from "../lib/raceDisplay";

// Vue par défaut bornée à l'Europe : les rares ultras lointains restent sur
// la carte, hors champ tant qu'on ne s'y déplace pas.
const EUROPE_BOUNDS = [[35.5, -10.5], [60, 26]];

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Carte Leaflet de la page Ultras. Les marqueurs suivent la liste filtrée
// sans recréer la carte ; `hoveredId` grossit le marqueur survolé dans la
// liste ; `onBoundsChange` remonte la zone visible pour le filtre « zone ».
export default function UltrasMap({ races, hoveredId, onBoundsChange, onOpen }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef(new Map());
  const onBoundsRef = useRef(onBoundsChange);
  const onOpenRef = useRef(onOpen);
  onBoundsRef.current = onBoundsChange;
  onOpenRef.current = onOpen;

  useEffect(() => {
    const map = L.map(containerRef.current, { scrollWheelZoom: true, zoomControl: false });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    map.fitBounds(EUROPE_BOUNDS);
    layerRef.current = L.layerGroup().addTo(map);
    const emit = () => onBoundsRef.current?.(map.getBounds());
    map.on("moveend", emit);
    mapRef.current = map;

    // La carte change de taille avec la mise en page (carte seule, mobile) :
    // Leaflet doit recalculer, sinon des tuiles restent grises.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    emit();

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markersRef.current = new Map();

    races.forEach((r) => {
      const c = raceCoords(r);
      if (!c) return;
      const marker = L.circleMarker(c, {
        radius: 7,
        color: "#FFFFFF",
        weight: 2,
        fillColor: disciplineColor(r.discipline),
        fillOpacity: 0.95,
      });
      const when = countdownLabel(r) || formatShortDate(r.start_date) || r.month || "";
      marker.bindPopup(
        `<div class="v2-popup">
          <span class="v2-popup-tag">${escapeHtml([r.start_place || r.country, when].filter(Boolean).join(" · ").toUpperCase())}</span>
          <span class="v2-popup-name">${escapeHtml(r.name)}</span>
          <span class="v2-popup-stats">${escapeHtml([r.discipline, statsLine(r)].filter(Boolean).join(" · "))}</span>
          <a href="/courses/${encodeURIComponent(r.id)}" data-race="${escapeHtml(r.id)}" style="color:#9A4519;font-weight:600;margin-top:4px">Voir la fiche →</a>
        </div>`,
        { closeButton: true, autoPan: true }
      );
      marker.on("popupopen", (e) => {
        const link = e.popup.getElement()?.querySelector("a[data-race]");
        if (link) {
          link.onclick = (ev) => { ev.preventDefault(); onOpenRef.current?.(r.id); };
        }
      });
      marker.bindTooltip(escapeHtml(r.name), { direction: "top", offset: [0, -8] });
      marker.addTo(layer);
      markersRef.current.set(r.id, marker);
    });
  }, [races]);

  useEffect(() => {
    markersRef.current.forEach((m, id) => {
      const active = id === hoveredId;
      m.setRadius(active ? 12 : 7);
      m.setStyle({ weight: active ? 3 : 2 });
      if (active) m.bringToFront();
    });
  }, [hoveredId, races]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
