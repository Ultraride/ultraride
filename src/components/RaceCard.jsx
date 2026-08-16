import { Link } from "react-router-dom";
import FavoriteButton from "./FavoriteButton";

const FORMAT_LABEL = { course: "Course", aventure: "Aventure", endurance: "Endurance" };
const PARCOURS_LABEL = { boucle: "Boucle", point: "Point à point", ar: "Aller-retour" };

export default function RaceCard({ race }) {
  return (
    <Link to={`/courses/${race.id}`} className="race-card">
      {race.image_url && (
        <div className="race-card-image" style={{ backgroundImage: `url(${race.image_url})` }} />
      )}

      <div className="race-card-top">
        <div>
          <div className="race-card-loc">{race.country} · {race.discipline}</div>
          <div className="race-card-title">{race.name}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FavoriteButton raceId={race.id} />
          <span className={`badge ${race.open ? "badge-published" : "badge-rejected"}`}>
            {race.open ? "Ouvert" : "Fermé"}
          </span>
        </div>
      </div>

      {race.blurb && <p className="race-card-blurb">{race.blurb}</p>}

      <div className="race-card-stats">
        <span>{race.km ?? "—"} <small>km</small></span>
        <span>{race.dplus ? race.dplus.toLocaleString("fr-FR") : "—"} <small>D+</small></span>
        <span className="race-card-month">{race.month}</span>
      </div>

      <div className="race-card-tags">
        {race.format && <span className="tag">{FORMAT_LABEL[race.format] || race.format}</span>}
        {race.parcours && <span className="tag">{PARCOURS_LABEL[race.parcours] || race.parcours}</span>}
        {race.mode && <span className="tag">{race.mode}</span>}
      </div>

      {race.organizer && (race.organizer.name || race.organizer.logo_url) && (
        <div className="race-card-organizer">
          {race.organizer.logo_url && (
            <img src={race.organizer.logo_url} alt="" className="race-card-organizer-logo" />
          )}
          <span>{race.organizer.name}</span>
        </div>
      )}
    </Link>
  );
}
