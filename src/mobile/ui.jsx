import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import { dateTile, formatNumber, daysUntil, formatDate } from "./data";

export const DISCIPLINE_BG = {
  Route: "#6E6E66",
  Gravel: "#15793F",
  VTT: "#B4541F",
  Bikepacking: "#1B2B20",
};
export const disciplineBg = (d) => DISCIPLINE_BG[d] || "#1B2B20";

const FORMAT_LABEL = { course: "Course", aventure: "Aventure", endurance: "Endurance" };
export const formatLabel = (f) => FORMAT_LABEL[f] || f;

// ── Icônes (traits, currentColor) ─────────────────────────────────────
const P = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  sliders: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  back: <path d="m15 6-6 6 6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  share: <><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  list: <path d="M3 6h18M3 12h18M3 18h12" />,
  locate: <path d="m3 11 18-8-8 18-2-8z" />,
  external: <path d="M7 17 17 7M8 7h9v9" />,
  plus: <path d="M12 5v14M5 12h14" />,
};
export function Icon({ name, size = 20, fill = "none", stroke = "currentColor", width = 1.9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}

// ── Couverture « roadbook » : courbes de niveau + tracé stylisé ──────
// Le tracé est dérivé de l'identifiant de la fiche : stable d'une visite
// à l'autre, différent d'un ultra à l'autre. Ce n'est pas la vraie trace.
function seeded(id) {
  let h = 2166136261;
  for (const c of String(id)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

export function routePath(id, w, h, loop) {
  const rnd = seeded(id);
  const n = 7;
  const pts = [];
  if (loop) {
    const cx = w * 0.62, cy = h * 0.48, rx = w * 0.22, ry = h * 0.3;
    for (let i = 0; i < n + 3; i++) {
      const a = (i / (n + 3)) * Math.PI * 2;
      const k = 0.75 + rnd() * 0.45;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
    }
    return { d: "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L ") + " Z", start: pts[0], end: pts[0] };
  }
  for (let i = 0; i < n; i++) {
    const x = w * 0.1 + (w * 0.8 * i) / (n - 1);
    const y = h * 0.78 - (h * 0.5 * i) / (n - 1) + (rnd() - 0.5) * h * 0.28;
    pts.push([x, y]);
  }
  return { d: "M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join(" L "), start: pts[0], end: pts[n - 1] };
}

export function Cover({ race, height, showImage = true, children }) {
  const w = 400;
  const loop = race.parcours === "boucle";
  const r = routePath(race.id, w, height, loop);
  const contours = [0.92, 0.76, 0.6, 0.44, 0.28];
  return (
    <div className="m-cover" style={{ height }}>
      <svg className="m-cover-art" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {contours.map((k, i) => (
          <path key={i} d={`M-10 ${height * k} C ${w * 0.2} ${height * (k - 0.12)}, ${w * 0.3} ${height * (k + 0.08)}, ${w * 0.5} ${height * (k - 0.05)} S ${w * 0.8} ${height * (k - 0.2)}, ${w + 10} ${height * (k - 0.1)}`} stroke="#2C4434" strokeWidth="1.2" fill="none" />
        ))}
        {!(showImage && race.image_url) && (
          <>
            <path d={r.d} stroke="#C4622D" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={r.start[0]} cy={r.start[1]} r="6" fill="#F5F1E6" />
            {!loop && <circle cx={r.end[0]} cy={r.end[1]} r="6" fill="#C4622D" stroke="#F5F1E6" strokeWidth="2" />}
          </>
        )}
      </svg>
      {showImage && race.image_url && (
        <div className="m-cover-img"><img src={race.image_url} alt="" loading="lazy" /></div>
      )}
      {children}
    </div>
  );
}

export function Pill({ children, tone = "light", bg }) {
  return <span className={`m-pill m-pill--${tone}`} style={bg ? { background: bg } : undefined}>{children}</span>;
}

export function Stamp({ top, big, rotate = -12 }) {
  return (
    <span className="m-stamp" style={{ transform: `rotate(${rotate}deg)` }}>
      <span className="m-stamp-top">{top}</span>
      <span className="m-stamp-big">{big}</span>
    </span>
  );
}

export function Stat({ label, value }) {
  return (
    <div className="m-stat">
      <span className="m-label">{label}</span>
      <span className="m-stat-val">{value}</span>
    </div>
  );
}

export function raceStats(race) {
  return [
    race.km ? { label: "DISTANCE", value: `${formatNumber(race.km)} km` } : null,
    race.dplus ? { label: "D+", value: `${formatNumber(race.dplus)} m` } : null,
    { label: "DÉPART", value: formatDate(race, { short: true }) },
  ].filter(Boolean);
}

export function DateTile({ race }) {
  const t = dateTile(race);
  return (
    <span className="m-datetile" style={{ background: disciplineBg(race.discipline) }}>
      <span className="m-datetile-big">{t.big}</span>
      <span className="m-datetile-small">{t.small}</span>
    </span>
  );
}

function placeLine(race) {
  const from = race.start_place, to = race.end_place;
  const place = from && to && from !== to ? `${from.split(",")[0]} → ${to.split(",")[0]}` : (from || "").split(",")[0];
  return [place, race.country].filter(Boolean).join(" · ");
}

export function RaceRow({ race }) {
  const bits = [
    race.km ? `${formatNumber(race.km)} km` : null,
    race.dplus ? `${formatNumber(race.dplus)} m D+` : null,
    race.price ? `${formatNumber(race.price)} €` : null,
  ].filter(Boolean).join(" · ");
  return (
    <Link to={`/courses/${race.id}`} className="m-row">
      <DateTile race={race} />
      <span className="m-row-body">
        <span className="m-row-title">{race.name}</span>
        <span className="m-row-sub">{placeLine(race)}</span>
        {bits && <span className="m-row-meta">{bits}</span>}
      </span>
      <span className="m-row-chev"><Icon name="chevron" size={18} /></span>
    </Link>
  );
}

export function MiniCard({ race, extra }) {
  const loop = race.parcours === "boucle";
  const r = routePath(race.id, 156, 84, loop);
  return (
    <Link to={`/courses/${race.id}`} className="m-mini">
      <span className="m-mini-cover" style={{ background: disciplineBg(race.discipline) }}>
        <svg width="100%" height="84" viewBox="0 0 156 84" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <path d={r.d} stroke="#F5F1E6" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={r.start[0]} cy={r.start[1]} r="4" fill="#F5F1E6" />
        </svg>
        {daysUntil(race) != null && <span className="m-mini-j">J-{daysUntil(race)}</span>}
      </span>
      <span className="m-mini-body">
        <span className="m-mini-title">{race.name}</span>
        <span className="m-mini-sub">{[race.discipline, race.km ? `${formatNumber(race.km)} km` : null].filter(Boolean).join(" · ")}</span>
        <span className="m-mini-sub">{extra || formatDate(race, { short: true })}</span>
      </span>
    </Link>
  );
}

// ── Favoris (cœur) ────────────────────────────────────────────────────
export function useFavorite(raceId) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || !raceId) { setIsFav(false); return; }
    supabase.from("favorites").select("id").eq("user_id", user.id).eq("race_id", raceId).maybeSingle()
      .then(({ data }) => setIsFav(!!data));
  }, [user, raceId]);

  const toggle = async () => {
    if (!user) { navigate("/login"); return; }
    if (busy) return;
    setBusy(true);
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("race_id", raceId);
      setIsFav(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, race_id: raceId });
      setIsFav(true);
    }
    setBusy(false);
  };
  return { isFav, toggle, busy };
}

// ── Menu secondaire (feuille) ────────────────────────────────────────
export function MenuButton({ variant = "light" }) {
  const [open, setOpen] = useState(false);
  const { user, isAdmin, isOrganizer, signOut } = useAuth();
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <button type="button" className={`m-roundbtn m-roundbtn--${variant}`} aria-label="Menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      {open && (
        <div className="m-sheet-backdrop" onClick={close}>
          <div className="m-sheet" role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="m-sheet-head">
              <span className="m-wordmark">ULTRA<span>RIDE</span></span>
              <button type="button" className="m-roundbtn m-roundbtn--light" aria-label="Fermer" onClick={close}><Icon name="close" /></button>
            </div>
            <nav className="m-sheet-links">
              <NavLink to="/proposer-course" onClick={close}>Proposer un ultra</NavLink>
              <NavLink to="/le-projet" onClick={close}>Le projet</NavLink>
              <NavLink to="/mode-d-emploi" onClick={close}>Mode d'emploi</NavLink>
              {(isOrganizer || isAdmin) && <NavLink to="/organizer/races" onClick={close}>Mes ultras (organisateur)</NavLink>}
              {(isOrganizer || isAdmin) && <NavLink to="/organizer/profile" onClick={close}>Fiche organisateur</NavLink>}
              {isAdmin && <NavLink to="/admin" onClick={close}>Admin</NavLink>}
              <NavLink to="/cgu" onClick={close}>Conditions générales</NavLink>
              <NavLink to="/confidentialite" onClick={close}>Confidentialité</NavLink>
              <a href="mailto:hello@ultraride.eu">Contact</a>
            </nav>
            <div className="m-sheet-foot">
              {user ? (
                <button type="button" className="m-btn m-btn--ghost" onClick={() => { close(); signOut(); }}>Déconnexion</button>
              ) : (
                <>
                  <Link to="/login" className="m-btn m-btn--ghost" onClick={close}>Connexion</Link>
                  <Link to="/login?mode=signup" className="m-btn m-btn--primary" onClick={close}>Créer un compte</Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
