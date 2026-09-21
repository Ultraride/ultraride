import { Link } from "react-router-dom";
import FavoriteButton from "./FavoriteButton";
import PriceTag from "./PriceTag";
import { getFlagEmoji } from "../lib/emea";
import { DISCIPLINE_COLORS, darken } from "../lib/disciplineColors";
import { getCheckerStyle, FORMAT_CHECKER_COLORS } from "../lib/formatStyles";

const FORMAT_LABEL = { course: "Course", aventure: "Aventure", endurance: "Endurance" };
const PARCOURS_LABEL = { boucle: "Boucle", point: "Point à point", ar: "Aller-retour" };

function DisciplineBadge({ discipline }) {
  const color = DISCIPLINE_COLORS[discipline] || "#6E6E66";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: "999px",
        border: `2px solid ${darken(color, 0.25)}`,
        color: "#FFFFFF",
        textShadow: "0 1px 2px rgba(0,0,0,0.35)",
        background: `${color}E6`,
        fontSize: "0.75rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        lineHeight: 1,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {discipline}
    </span>
  );
}

function FormatBadge({ format }) {
  const color = FORMAT_CHECKER_COLORS[format] || "#000000";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px",
        borderRadius: "999px",
        ...getCheckerStyle(color),
      }}
    >
      <span
        style={{
          display: "block",
          padding: "2px 10px",
          borderRadius: "999px",
          backgroundColor: color,
          color: "#FFFFFF",
          textShadow: "0 1px 2px rgba(0,0,0,0.35)",
          fontSize: "0.75rem",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          whiteSpace: "nowrap",
        }}
      >
        {format}
      </span>
    </span>
  );
}

export default function RaceCard({ race }) {
  return (
    <div className="race-card-wrapper">
      <Link to={`/courses/${race.id}`} className="race-card">
        {race.image_url && (
          <div className="race-card-image" style={{ backgroundImage: `url(${race.image_url})` }} />
        )}

        <div className="race-card-top">
          <div>
            <div className="race-card-loc" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              {getFlagEmoji(race.country) && (
                <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>
                  {getFlagEmoji(race.country)}
                </span>
              )}
              <span style={{ fontSize: "0.8rem", fontWeight: 600, letterSpacing: "0.03em", lineHeight: 1 }}>
                {race.country?.toUpperCase()}
              </span>
              {race.discipline && <DisciplineBadge discipline={race.discipline} />}
            </div>
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
          <PriceTag price={race.price} />
        </div>

        <div className="race-card-tags">
          {race.format && <FormatBadge format={FORMAT_LABEL[race.format] || race.format} />}
          {race.parcours && <span className="tag">{PARCOURS_LABEL[race.parcours] || race.parcours}</span>}
          {race.mode && <span className="tag">{race.mode}</span>}
        </div>
      </Link>

      {/* Organizer footer lives OUTSIDE the race Link to avoid click conflicts */}
      {race.organizer && (race.organizer.name || race.organizer.logo_url) && (
        race.organizer.id ? (
          <Link to={`/organizers/${race.organizer.id}`} className="race-card-organizer race-card-organizer-link">
            {race.organizer.logo_url && (
              <img src={race.organizer.logo_url} alt="" className="race-card-organizer-logo" />
            )}
            <span>{race.organizer.name}</span>
          </Link>
        ) : (
          <div className="race-card-organizer">
            {race.organizer.logo_url && (
              <img src={race.organizer.logo_url} alt="" className="race-card-organizer-logo" />
            )}
            <span>{race.organizer.name}</span>
          </div>
        )
      )}
    </div>
  );
}
