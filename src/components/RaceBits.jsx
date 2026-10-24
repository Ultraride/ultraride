import { Link } from "react-router-dom";
import {
  disciplineColor, dateTileParts, countdownLabel, statsLine, placeLine,
  FORMAT_LABEL, FORMAT_BG,
} from "../lib/raceDisplay";

export function DateTile({ race, size = 64 }) {
  const { day, month } = dateTileParts(race);
  return (
    <div className="v2-datetile" style={{ width: size, height: size, background: disciplineColor(race.discipline) }}>
      <span className="v2-datetile-day">{day}</span>
      <span className="v2-datetile-month">{month}</span>
    </div>
  );
}

export function Countdown({ race }) {
  const label = countdownLabel(race);
  if (!label) return null;
  if (label === "Aujourd'hui") return <span className="v2-pill v2-pill-rust">AUJOURD'HUI</span>;
  return <span className="v2-countdown">{label}</span>;
}

export function DisciplineBadge({ discipline, light = false }) {
  if (!discipline) return null;
  return (
    <span
      className="v2-pill"
      style={light
        ? { background: "#F5F1E6", color: "#1B2B20" }
        : { background: disciplineColor(discipline), color: "#FFFFFF" }}
    >
      {discipline.toUpperCase()}
    </span>
  );
}

export function FormatBadge({ format }) {
  if (!format) return null;
  return (
    <span className="v2-pill" style={{ background: FORMAT_BG[format] || "#1B2B20", color: "#FFFFFF" }}>
      {(FORMAT_LABEL[format] || format).toUpperCase()}
    </span>
  );
}

// Ligne de liste : vignette date, nom, lieu, chiffres, compte à rebours.
export function RaceRow({ race, highlighted = false, onHover, extra }) {
  return (
    <Link
      to={`/courses/${race.id}`}
      className={`v2-row${highlighted ? " v2-row-active" : ""}`}
      onMouseEnter={onHover ? () => onHover(race.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(race.id) : undefined}
    >
      <DateTile race={race} />
      <div className="v2-row-body">
        <span className="v2-row-name">{race.name}</span>
        <span className="v2-row-place">{placeLine(race) || race.country}</span>
        {statsLine(race, { withPrice: true }) && <span className="v2-row-stats">{statsLine(race, { withPrice: true })}</span>}
      </div>
      {extra}
      <Countdown race={race} />
    </Link>
  );
}

// Tracé décoratif quand l'ultra n'a pas d'image.
function RouteDoodle({ variant = 0 }) {
  const paths = [
    "M24 118 C 70 70, 110 104, 156 62 S 236 34, 258 26",
    "M140 24 C 220 24, 236 104, 170 120 C 90 136, 46 98, 70 62 C 88 36, 116 24, 140 24 Z",
    "M30 110 C 80 80, 120 116, 170 82 S 240 50, 254 40",
  ];
  return (
    <svg width="100%" height="100%" viewBox="0 0 280 150" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path d={paths[variant % paths.length]} stroke="#F5F1E6" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Carte avec visuel : logo ou image de l'ultra sur fond de la discipline.
export function RaceTile({ race, index = 0, footer }) {
  return (
    <Link to={`/courses/${race.id}`} className="v2-tile">
      <div className="v2-tile-media" style={{ background: disciplineColor(race.discipline) }}>
        {race.image_url
          ? <img src={race.image_url} alt="" loading="lazy" decoding="async" />
          : <RouteDoodle variant={index} />}
        <span className="v2-pill v2-tile-badge" style={{ background: "#F5F1E6", color: "#1B2B20" }}>
          {(race.discipline || "").toUpperCase()}
        </span>
      </div>
      <div className="v2-tile-body">
        <span className="v2-tile-name">{race.name}</span>
        <span className="v2-tile-place">{placeLine(race) || race.country}</span>
        <span className="v2-tile-stats">
          {[race.km ? `${Math.round(race.km).toLocaleString("fr-FR")} km` : null, countdownLabel(race)].filter(Boolean).join(" · ")}
        </span>
        {footer}
      </div>
    </Link>
  );
}
