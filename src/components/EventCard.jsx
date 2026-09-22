import { useState } from "react";
import { Link } from "react-router-dom";
import PriceTag from "./PriceTag";
import ClampedBlurb from "./ClampedBlurb";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// Carte représentant un événement décliné en plusieurs formats. Elle
// remplace les cartes individuelles dans la grille : afficher cinq fois
// « Race Across France » avec une distance différente noie le répertoire.
export default function EventCard({ event }) {
  const { slug, name, races } = event;
  const [expanded, setExpanded] = useState(false);

  const distances = races.map((r) => r.km).filter((k) => k != null).sort((a, b) => a - b);
  const disciplines = [...new Set(races.map((r) => r.discipline).filter(Boolean))];
  const countries = [...new Set(races.map((r) => r.country).filter(Boolean))];
  const months = [...new Set(races.map((r) => r.month).filter(Boolean))]
    .sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const anyOpen = races.some((r) => r.open);
  // Un événement à plusieurs formats a plusieurs tarifs : on annonce le
  // plus bas, comme le font les organisateurs eux-mêmes.
  const prices = races.map((r) => r.price).filter((p) => p != null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const image = races.find((r) => r.image_url)?.image_url;
  const organizer = races.find((r) => r.organizer)?.organizer;

  const distanceLabel =
    distances.length === 0
      ? null
      : distances[0] === distances[distances.length - 1]
        ? `${distances[0]} km`
        : `${distances[0]} à ${distances[distances.length - 1]} km`;

  return (
    <div
      className="race-card-wrapper"
      style={expanded ? { height: "auto", overflow: "visible" } : undefined}
    >
      <Link to={`/evenements/${slug}`} className="race-card">
        <div className="race-card-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />

        <div className="race-card-top">
          <div>
            <div className="race-card-loc">
              {countries.join(" · ")} · {disciplines.join(" · ")}
            </div>
            <div className="race-card-title" title={name}>{name}</div>
          </div>
          <span className={`badge ${anyOpen ? "badge-published" : "badge-rejected"}`}>
            {anyOpen ? "Ouvert" : "Fermé"}
          </span>
        </div>

        <ClampedBlurb expanded={expanded} onToggle={() => setExpanded((v) => !v)}>
          <strong>{races.length} format{races.length > 1 ? "s" : ""}</strong>
          {distanceLabel ? ` · ${distanceLabel}` : ""}
          {months.length > 0 ? ` · ${months.join(", ")}` : ""}
        </ClampedBlurb>

        <div className="event-card-price-slot" style={{ visibility: minPrice != null ? "visible" : "hidden" }}>
          <span className="muted mono" style={{ fontSize: 11, marginRight: 6 }}>à partir de</span>
          <PriceTag price={minPrice ?? 0} showAmount />
        </div>

        <div className="event-card-formats">
          {races.map((r) => (
            <span className="tag" key={r.id}>
              {r.km ? `${r.km} km` : r.name}
            </span>
          ))}
        </div>
      </Link>

      {organizer && (organizer.name || organizer.logo_url) ? (
        organizer.id ? (
          <Link to={`/organizers/${organizer.id}`} className="race-card-organizer race-card-organizer-link">
            {organizer.logo_url && <img src={organizer.logo_url} alt="" className="race-card-organizer-logo" />}
            <span>{organizer.name}</span>
          </Link>
        ) : (
          <div className="race-card-organizer">
            {organizer.logo_url && <img src={organizer.logo_url} alt="" className="race-card-organizer-logo" />}
            <span>{organizer.name}</span>
          </div>
        )
      ) : (
        <div className="race-card-organizer" style={{ visibility: "hidden" }} aria-hidden="true">
          <span>—</span>
        </div>
      )}
    </div>
  );
}
