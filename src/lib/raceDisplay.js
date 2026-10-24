// Libellés, couleurs et dates partagés par les pages de la version web v2.

export const DISCIPLINE_COLOR = {
  Route: "#6E6E66",
  Gravel: "#15793F",
  VTT: "#B4541F",
};
// Discipline hors des trois filtres (ex. « Bikepacking ») : vert sombre neutre.
export const DEFAULT_DISCIPLINE_COLOR = "#1B2B20";

export function disciplineColor(d) {
  return DISCIPLINE_COLOR[d] || DEFAULT_DISCIPLINE_COLOR;
}

export const FORMAT_LABEL = { course: "Course", aventure: "Aventure", endurance: "Endurance" };
export const FORMAT_BG = { course: "#000000", aventure: "#8A6220", endurance: "#B3382C" };
export const PARCOURS_LABEL = { boucle: "Boucle", point: "Point à point", ar: "Aller-retour" };

const MONTHS_SHORT = ["JANV.", "FÉVR.", "MARS", "AVR.", "MAI", "JUIN", "JUIL.", "AOÛT", "SEPT.", "OCT.", "NOV.", "DÉC."];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

// start_date arrive en "AAAA-MM-JJ" : on le lit en date locale pour éviter
// le décalage d'un jour que provoque new Date("AAAA-MM-JJ") (UTC).
export function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = String(str).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfToday() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

// Nombre de jours avant le départ (0 = aujourd'hui, négatif = passé).
export function daysUntil(race) {
  const d = parseDate(race?.start_date);
  if (!d) return null;
  return Math.round((d - startOfToday()) / 86400000);
}

export function countdownLabel(race) {
  const n = daysUntil(race);
  if (n === null) return null;
  if (n === 0) return "Aujourd'hui";
  if (n < 0) return null;
  return `J-${n}`;
}

export function isUpcoming(race) {
  const n = daysUntil(race);
  return n !== null && n >= 0;
}

export function dateTileParts(race) {
  const d = parseDate(race?.start_date);
  if (d) return { day: String(d.getDate()), month: MONTHS_SHORT[d.getMonth()] };
  const i = MONTH_NAMES.indexOf(race?.month);
  return { day: "—", month: i >= 0 ? MONTHS_SHORT[i] : "DATE ?" };
}

export function formatLongDate(str) {
  const d = parseDate(str);
  if (!d) return null;
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

const MONTHS_ABBR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export function formatShortDate(str) {
  const d = parseDate(str);
  if (!d) return null;
  return `${d.getDate()} ${MONTHS_ABBR[d.getMonth()]} ${d.getFullYear()}`;
}

// Clé de regroupement par mois pour la liste : "2027-03" et son libellé.
export function monthGroup(race) {
  const d = parseDate(race?.start_date);
  if (d) {
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${MONTH_NAMES[d.getMonth()].toUpperCase()} ${d.getFullYear()}`,
    };
  }
  return { key: "9999", label: "DATE À CONFIRMER" };
}

export function formatNumber(n) {
  if (n === null || n === undefined || n === "") return null;
  const v = Number(n);
  if (Number.isNaN(v)) return null;
  return Math.round(v).toLocaleString("fr-FR");
}

export function statsLine(race, { withPrice = false } = {}) {
  const parts = [];
  if (race.km) parts.push(`${formatNumber(race.km)} km`);
  if (race.dplus && Number(race.dplus) > 100) parts.push(`${formatNumber(race.dplus)} m D+`);
  if (withPrice && race.price) parts.push(`${formatNumber(race.price)} €`);
  return parts.join(" · ");
}

export function placeLine(race) {
  const start = race.start_place;
  const end = race.end_place;
  let route = start || "";
  if (start && end && race.parcours !== "boucle" && end !== start) route = `${start} → ${end}`;
  const country = race.country && !normalize(route).includes(normalize(race.country)) ? race.country : null;
  return [route, country].filter(Boolean).join(" · ");
}

export function normalize(str) {
  return (str || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function raceCoords(r) {
  const lat = r.start_lat ?? r.lat;
  const lon = r.start_lon ?? r.lon;
  if (lat == null || lon == null) return null;
  return [Number(lat), Number(lon)];
}

// Tri chronologique : les départs datés d'abord, puis les fiches sans date.
export function byStartDate(a, b) {
  const da = parseDate(a.start_date);
  const db = parseDate(b.start_date);
  if (da && db) return da - db || (a.name || "").localeCompare(b.name || "");
  if (da) return -1;
  if (db) return 1;
  return (a.name || "").localeCompare(b.name || "");
}

// Colonnes lues par l'accueil et la page Ultras.
export const LIST_COLUMNS =
  "id, name, country, discipline, format, mode, parcours, month, km, dplus, price, open, lat, lon, start_lat, start_lon, start_place, end_place, start_date, created_at, view_count, blurb, image_url, organizer_name, organizer:organizers!races_organizer_id_fkey(id, name, logo_url)";
