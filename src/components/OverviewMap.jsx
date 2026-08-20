import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import L from "leaflet";

export default function OverviewMap({ races }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(containerRef.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    const withCoords = races.filter((r) => r.lat != null && r.lon != null);

    if (withCoords.length === 0) {
      map.setView([46.6, 2.5], 5);
    } else {
      const bounds = L.latLngBounds(withCoords.map((r) => [r.lat, r.lon]));
      withCoords.forEach((r) => {
        const marker = L.circleMarker([r.lat, r.lon], {
          radius: 7,
          weight: 2,
          color: r.open ? "#C4622D" : "#C1543F",
          fillColor: r.open ? "#C4622D" : "#C1543F",
          fillOpacity: r.open ? 0.85 : 0.15,
        });
        marker.bindTooltip(
          `<div style="font-family:'Anton',sans-serif;font-weight:400;font-size:13px;">${r.name}</div><div style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#A9BBAE;margin-top:2px;">${r.km ?? "—"} km · ${r.dplus ? r.dplus.toLocaleString("fr-FR") : "—"} D+ · ${r.month ?? ""}</div>`,
          { direction: "top", offset: [0, -6] }
        );
        marker.on("click", () => navigate(`/courses/${r.id}`));
        marker.addTo(map);
      });
      map.fitBounds(bounds.pad(0.3), { maxZoom: 11 });
    }

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [races, navigate]);

  return (
    <div className="map-box">
      <div className="map-box-head">
        <span>Carte</span>
        <span className="muted">{races.length} balise{races.length !== 1 ? "s" : ""}</span>
      </div>
      <div ref={containerRef} className="map-box-canvas" />
      <div className="map-box-legend">
        <span><span className="dot" style={{ background: "var(--amber)" }} /> Inscription ouverte</span>
        <span><span className="dot" style={{ border: "1.5px solid var(--brick)" }} /> Fermée</span>
        <span className="map-box-attrib">© OpenStreetMap contributors</span>
      </div>
    </div>
  );
}
