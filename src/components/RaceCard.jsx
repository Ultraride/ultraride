import { useState } from "react";
import { Link } from "react-router-dom";
import FavoriteButton from "./FavoriteButton";
import PriceTag from "./PriceTag";
import ClampedBlurb from "./ClampedBlurb";
import { getFlagEmoji } from "../lib/emea";
import { DISCIPLINE_COLORS, darken } from "../lib/disciplineColors";
import { FORMAT_COLORS, FORMAT_EMOJI } from "../lib/formatStyles";

const FORMAT_LABEL = { course: "Course", aventure: "Aventure", endurance: "Endurance" };
const PARCOURS_LABEL = { boucle: "Boucle", point: "Point à point", ar: "Aller-retour" };
const PARCOURS_EMOJI = { boucle: "🔁", point: "📌", ar: "🔄" };
const MODE_EMOJI = { Autonomie: "🎒", "Semi-autonomie": "🧳", Assisté: "🚚" };

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
  const color = FORMAT_COLORS[format] || "#6E6E66";
  const emoji = FORMAT_EMOJI[format] || "";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 10px",
        borderRadius: "999px",
        border: `2px solid ${darken(color, 0.25)}`,
        color: "#FFFFFF",
        textShadow: "0 1px 2px rgba(0,0,0,0.35)",
        background: color,
        fontSize: "0.75rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {format}
      <span style={{ fontSize: "0.85em" }}>{emoji}</span>
    </span>
  );
}

export default function RaceCard({ race }) {
  const hasOrganizerFooter = race.organizer && (race.organizer.name || race.organizer.logo_url);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="race-card-wrapper"
      style={expanded ? { height: "auto", overflow: "visible" } : undefined}
    >
      <Link to={`/courses/${race.id}`} className="race-card">
        <div
          className="race-card-image"
          style={race.image_url ? { backgroundImage: `url(${race.image_url})` } : undefined}
        />

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
            <div className="race-card-title" title={race.name}>{race.name}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FavoriteButton raceId={race.id} />
            <span className={`badge ${race.open ? "badge-published" : "badge-rejected"}`}>
              {race.open ? "Ouvert" : "Fermé"}
            </span>
          </div>
        </div>

        <ClampedBlurb expanded={expanded} onToggle={() => setExpanded((v) => !v)}>
          {race.blurb}
        </ClampedBlurb>

        <div className="race-card-stats">
          <span>{race.km ?? "—"} <small>km</small></span>
          <span>{race.dplus ? race.dplus.toLocaleString("fr-FR") : "—"} <small>D+</small></span>
          <span className="race-card-month">{race.month}</span>
          <PriceTag price={race.price} />
        </div>

        <div className="race-card-tags">
          {race.format && <FormatBadge format={FORMAT_LABEL[race.format] || race.format} />}
        </div>

        <div
          className="race-card-parcours-mode"
          style={{ visibility: race.parcours || race.mode ? "visible" : "hidden" }}
        >
          <span style={{ whiteSpace: "nowrap" }}>
            {race.parcours && (
              <>{PARCOURS_EMOJI[race.parcours]} {PARCOURS_LABEL[race.parcours] || race.parcours}</>
            )}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>
            {race.mode && <>{MODE_EMOJI[race.mode]} {race.mode}</>}
          </span>
        </div>
      </Link>

      {/* Organizer footer lives OUTSIDE the race Link to avoid click conflicts.
          Always rendered so every card reserves the same footer height. */}
      {hasOrganizerFooter ? (
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
      ) : (
        <div className="race-card-organizer" style={{ visibility: "hidden" }} aria-hidden="true">
          <span>—</span>
        </div>
      )}
    </div>
  );
}
