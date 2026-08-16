import { Link } from "react-router-dom";

const FORMAT_LABEL = { course: "Course", aventure: "Aventure", endurance: "Endurance" };
const PARCOURS_LABEL = { boucle: "Boucle", point: "Point à point", ar: "Aller-retour" };

export default function RaceCard({ race }) {
  return (
    <Link to={`/courses/${race.id}`} className="race-card">
      <div className="race-card-top">
        <div>
          <div className="race-card-loc">{race.country} · {race.discipline}</div>
          <div className="race-card-title">{race.name}</div>
        </div>
        <span className={`badge ${race.open ? "badge-published" : "badge-rejected"}`}>
          {race.open ? "Ouvert" : "Fermé"}
        </span>
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
    </Link>
  );
}
