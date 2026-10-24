import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import L from "leaflet";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import OrganizerBox from "../components/OrganizerBox";
import FavoriteButton from "../components/FavoriteButton";
import { formatPrice } from "../lib/price";
import { normalizeUrl } from "../lib/organizerLinks";
import SiteFooter from "../components/SiteFooter";
import { RaceTile, DisciplineBadge, FormatBadge } from "../components/RaceBits";
import {
  countdownLabel, formatLongDate, formatNumber, PARCOURS_LABEL, isUpcoming, parseDate, byStartDate,
} from "../lib/raceDisplay";

function RaceMap({ race }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!race || !ref.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(ref.current, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const isLoop = race.parcours === "boucle";
    const start = [race.start_lat, race.start_lon];
    const end = isLoop ? start : [race.end_lat, race.end_lon];
    const bounds = [start, end];

    if (race.gpx_track?.length > 1) {
      const latlngs = race.gpx_track.map((p) => [p.lat, p.lon]);
      L.polyline(latlngs, { color: "#C4622D", weight: 3.5 }).addTo(map);
      bounds.push(...latlngs);
    } else if (!isLoop) {
      L.polyline([start, end], { color: "#2FA05C", weight: 2, dashArray: "6,6" }).addTo(map);
    }

    L.circleMarker(start, { radius: 7, color: "#C4622D", fillColor: "#C4622D", fillOpacity: 0.9 })
      .bindTooltip(race.start_place || "Départ").addTo(map);
    if (!isLoop) {
      L.circleMarker(end, { radius: 7, color: "#C1543F", fillColor: "#C1543F", fillOpacity: 0.9 })
        .bindTooltip(race.end_place || "Arrivée").addTo(map);
    }

    const latLngBounds = L.latLngBounds(bounds);
    // A loop with no GPX track collapses start/end to the same point — fitBounds on a
    // zero-area box zooms to street level. Fall back to a fixed regional zoom instead.
    const isSinglePoint = latLngBounds.getNorthEast().distanceTo(latLngBounds.getSouthWest()) < 500;
    if (isSinglePoint) {
      map.setView(start, 8);
    } else {
      map.fitBounds(latLngBounds.pad(0.15));
    }
    mapRef.current = map;
    return () => map.remove();
  }, [race]);

  return <div className="v2-race-map"><div ref={ref} style={{ width: "100%", height: "100%" }} /></div>;
}

function Comments({ raceId }) {
  const { user, isOrganizer } = useAuth();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const load = () => {
    supabase
      .from("comments")
      .select("*, author:profiles(email, display_name)")
      .eq("race_id", raceId)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .then(({ data }) => setComments(data || []));
  };

  useEffect(() => { load(); }, [raceId]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.from("comments").insert({ race_id: raceId, author_id: user.id, body, status: "pending" });
    if (error) setError(error.message);
    else { setBody(""); setInfo("Avis envoyé — il sera visible après validation par un administrateur."); load(); }
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 className="v2-h3">Avis des participants</h2>
      {comments.length === 0 && <p className="muted">Aucun avis pour l'instant.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {comments.map((c) => (
          <div key={c.id} className="card">
            <div className="mono muted" style={{ fontSize: 11 }}>{c.author?.display_name || c.author?.email || "Utilisateur supprimé"}</div>
            <p style={{ margin: "6px 0 0" }}>{c.body}</p>
          </div>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}
      {info && <div className="success-box">{info}</div>}

      {!user ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            <Link to="/login" style={{ color: "var(--amber)", textDecoration: "underline" }}>Connecte-toi ou crée un compte</Link> pour laisser un avis.
          </p>
        </div>
      ) : isOrganizer ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>Les comptes organisateur ne peuvent pas laisser d'avis.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="panel">
          <div className="field">
            <label>Ton avis</label>
            <textarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">Envoyer</button>
          <div className="field-hint" style={{ marginTop: 8 }}>Ton avis sera visible après validation par un administrateur.</div>
        </form>
      )}
    </section>
  );
}

function editionYear(r) {
  if (r?.start_date) return String(r.start_date).slice(0, 4);
  return r?.next_edition || null;
}

// Profil d'élévation réel : elevation_profile = [[km, altitude], …].
function Elevation({ profile, km }) {
  if (!Array.isArray(profile) || profile.length < 2) return null;
  const xs = profile.map((p) => Number(p[0]));
  const ys = profile.map((p) => Number(p[1]));
  const maxX = Math.max(...xs) || 1;
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = maxY - minY || 1;
  const pts = profile.map((p) => `${((Number(p[0]) / maxX) * 800).toFixed(1)} ${(130 - ((Number(p[1]) - minY) / span) * 115).toFixed(1)}`);
  const line = `M${pts.join(" L ")}`;
  return (
    <div className="v2-panel" style={{ padding: "18px 18px 10px" }}>
      <svg width="100%" height="140" viewBox="0 0 800 140" preserveAspectRatio="none" role="img" aria-label="Profil d'élévation du parcours">
        <path d={`${line} L 800 140 L 0 140 Z`} fill="var(--elev-fill)" />
        <path d={line} fill="none" stroke="#B4541F" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 11, color: "var(--text2)", paddingTop: 6 }}>
        <span>0 km · {formatNumber(minY)} m</span>
        <span>Altitude max {formatNumber(maxY)} m</span>
        <span>{formatNumber(km || maxX)} km</span>
      </div>
    </div>
  );
}

// Fichier agenda (.ics) généré dans le navigateur.
function downloadIcs(race) {
  const start = parseDate(race.start_date);
  if (!start) return;
  const end = parseDate(race.end_date) || start;
  const endExclusive = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
  const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const esc = (t) => String(t || "").replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const url = `${window.location.origin}/courses/${race.id}`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//UltraRide//FR", "BEGIN:VEVENT",
    `UID:${race.id}@ultraride.eu`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${fmt(start)}`,
    `DTEND;VALUE=DATE:${fmt(endExclusive)}`,
    `SUMMARY:${esc(race.name)}`,
    `LOCATION:${esc(race.start_place || race.country)}`,
    `DESCRIPTION:${esc(url)}`,
    `URL:${url}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${race.name.replace(/[^\w\- ]+/g, "").trim() || "ultra"}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function HeroArt() {
  return (
    <svg viewBox="0 0 1440 400" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      {[360, 310, 260, 210, 160].map((y, i) => (
        <path key={y} d={`M-20 ${y} C 220 ${y - 60}, ${400 + i * 20} ${y + 20}, ${680 + i * 20} ${y - 40} S ${1120 + i * 10} ${y - 140}, 1460 ${y - 90}`} stroke="#2C4434" strokeWidth="1.4" />
      ))}
    </svg>
  );
}

export default function RaceDetail() {
  const { id } = useParams();
  const [race, setRace] = useState(null);
  const [error, setError] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [orgRaces, setOrgRaces] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    setRace(null);
    window.scrollTo(0, 0);
    supabase
      .from("races")
      .select("*, organizer:organizers!races_organizer_id_fkey(id, name, website, email, instagram, facebook, strava, logo_url)")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRace(data);
      });
  }, [id]);

  // Autres éditions du même ultra (même lineage_id). La RLS ne renvoie au
  // public que les éditions publiées.
  useEffect(() => {
    if (!race?.lineage_id) { setSiblings([]); return; }
    supabase
      .from("races")
      .select("id, name, edition, start_date, next_edition, km, status, is_current")
      .eq("lineage_id", race.lineage_id)
      .neq("id", race.id)
      .order("edition", { ascending: false })
      .then(({ data }) => setSiblings(data || []));
  }, [race?.id, race?.lineage_id]);

  // Les autres ultras de l'organisateur et des ultras proches dans l'esprit
  // (même discipline, départs à venir).
  useEffect(() => {
    if (!race) return;
    const orgId = race.organizer?.id || race.organizer_id;
    if (orgId) {
      supabase.from("races").select("id, name")
        .eq("organizer_id", orgId).eq("status", "published").eq("is_current", true).neq("id", race.id)
        .then(({ data }) => setOrgRaces(data || []));
    } else setOrgRaces([]);

    supabase.from("races")
      .select("id, name, discipline, country, km, dplus, start_date, start_place, end_place, parcours, image_url")
      .eq("status", "published").eq("is_current", true).eq("discipline", race.discipline).neq("id", race.id)
      .then(({ data }) => {
        const upcoming = (data || []).filter(isUpcoming);
        const ref = parseDate(race.start_date);
        const sameFormat = (r) => (race.km && r.km ? Math.abs(Number(r.km) - Number(race.km)) : 0);
        const list = ref
          ? upcoming.sort((a, b) => Math.abs(parseDate(a.start_date) - ref) - Math.abs(parseDate(b.start_date) - ref) || sameFormat(a) - sameFormat(b))
          : upcoming.sort(byStartDate);
        setSimilar(list.slice(0, 4));
      });
  }, [race?.id]);

  // Comptage des vues, séparé du chargement de la fiche : si l'incrément
  // échoue, ça ne doit jamais empêcher l'affichage de la course.
  useEffect(() => {
    if (!id) return;
    supabase.rpc("increment_race_view", { p_race_id: id }).then(({ error }) => {
      if (error) console.warn("increment_race_view:", error.message);
    });
  }, [id]);

  if (error) return <div className="wrap" style={{ paddingTop: 40 }}><div className="error-box">{error}</div></div>;
  if (!race) return <div className="wrap" style={{ paddingTop: 40 }}><p className="muted">Chargement…</p></div>;

  const newerEdition = !race.is_current
    ? siblings.find((s) => s.is_current && s.status === "published" && s.edition > race.edition)
    : null;
  const previousEditions = siblings.filter((s) => s.edition < race.edition && s.status === "published");
  const year = editionYear(race);
  const countdown = countdownLabel(race);
  const upcoming = isUpcoming(race);
  const isLoop = race.parcours === "boucle";
  const endPlace = isLoop ? race.start_place : race.end_place;
  const website = normalizeUrl(race.organizer?.website);
  const signupUrl = race.registration_url || website;
  const price = formatPrice(race.price);
  const orgName = race.organizer?.name || race.organizer_name;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: race.name, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch { /* partage annulé */ }
  };

  return (
    <div className="v2">
      <section className="v2-race-hero">
        <HeroArt />
        <div className="v2-wrap v2-race-hero-inner">
          <div className="v2-race-hero-top">
            <Link to="/ultras">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
              Tous les ultras
            </Link>
            <div className="v2-race-hero-actions">
              <button type="button" className="v2-hero-btn" onClick={share}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></svg>
                {shared ? "Lien copié" : "Partager"}
              </button>
              <span className="v2-hero-fav"><FavoriteButton raceId={race.id} size={22} /></span>
            </div>
          </div>

          {newerEdition && (
            <div style={{ background: "rgba(245,241,230,0.1)", border: "1px solid #E9A27A", borderRadius: 14, padding: "12px 16px", fontSize: 15 }}>
              Une édition plus récente existe :{" "}
              <Link to={`/courses/${newerEdition.id}`} style={{ fontWeight: 700, textDecoration: "underline" }}>
                {`Édition ${newerEdition.edition}${editionYear(newerEdition) ? ` · ${editionYear(newerEdition)}` : ""}`}
              </Link>
            </div>
          )}

          <div className="v2-race-hero-main">
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <DisciplineBadge discipline={race.discipline} light />
                <FormatBadge format={race.format} />
                {race.mode && <span className="v2-pill" style={{ background: "rgba(245,241,230,0.16)", color: "#F5F1E6", fontWeight: 600 }}>{race.mode.toUpperCase()}</span>}
                {race.country && <span className="v2-pill" style={{ background: "rgba(245,241,230,0.16)", color: "#F5F1E6", fontWeight: 600 }}>{race.country.toUpperCase()}</span>}
                {(race.edition > 1 || siblings.length > 0) && (
                  <span className="v2-pill" style={{ border: "1px solid #E9A27A", color: "#E9A27A" }}>{`ÉDITION ${race.edition}${year ? ` · ${year}` : ""}`}</span>
                )}
              </div>
              <h1 className="v2-race-title">{race.name}</h1>
              {orgName && (
                <span style={{ fontSize: 16, color: "#C9D3C6" }}>
                  Organisé par{" "}
                  {race.organizer?.id
                    ? <Link to={`/organizers/${race.organizer.id}`} style={{ color: "#F5F1E6", fontWeight: 600, textDecoration: "underline" }}>{orgName}</Link>
                    : <b style={{ color: "#F5F1E6" }}>{orgName}</b>}
                </span>
              )}
            </div>
            <div className="v2-race-hero-side">
              {race.image_url && <div className="v2-race-logo"><img src={race.image_url} alt="" /></div>}
              {countdown && (
                <div className="v2-stamp"><span>DÉPART</span><span>{countdown === "Aujourd'hui" ? "J-0" : countdown}</span></div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="v2-wrap v2-race-layout">
        <main className="v2-race-main">
          <div className="v2-bigstats">
            <div className="v2-bigstat"><span className="v2-label">Distance</span><b>{race.km ? `${formatNumber(race.km)} km` : "—"}</b></div>
            <div className="v2-bigstat"><span className="v2-label">Dénivelé +</span><b>{race.dplus && Number(race.dplus) > 100 ? `${formatNumber(race.dplus)} m` : "—"}</b></div>
            <div className="v2-bigstat"><span className="v2-label">Départ</span><b>{race.start_date ? parseDate(race.start_date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : (race.month || "—")}</b></div>
            <div className="v2-bigstat"><span className="v2-label">Parcours</span><b>{PARCOURS_LABEL[race.parcours] || race.parcours || "—"}</b></div>
          </div>

          <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 className="v2-h3">Roadbook</h2>
            {(race.start_place || endPlace) && (
              <div className="v2-roadbook">
                <span style={{ width: 14, height: 14, borderRadius: 7, border: "2px solid var(--paper)", flexShrink: 0 }} />
                <b>{race.start_place || "Départ"}</b>
                <span className="v2-roadbook-line" />
                <span className="mono muted v2-roadbook-stats" style={{ fontSize: 13 }}>
                  {[race.km ? `${formatNumber(race.km)} km` : null, race.dplus && Number(race.dplus) > 100 ? `${formatNumber(race.dplus)} m D+` : null].filter(Boolean).join(" · ") || (isLoop ? "Boucle" : "")}
                </span>
                <span className="v2-roadbook-line" />
                <b>{isLoop ? "Retour au départ" : (endPlace || "Arrivée")}</b>
                <span style={{ width: 14, height: 14, borderRadius: 7, background: "#B4541F", flexShrink: 0 }} />
              </div>
            )}
            <Elevation profile={race.elevation_profile} km={race.km} />
            <RaceMap race={race} />
          </section>

          {(race.long_blurb || race.blurb) && (
            <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h2 className="v2-h3">L'ultra</h2>
              <p className="v2-race-text">{race.long_blurb || race.blurb}</p>
              {race.terrain && <p className="muted" style={{ margin: 0, fontSize: 15 }}>Terrain : {race.terrain}</p>}
            </section>
          )}

          <Comments raceId={race.id} />
        </main>

        <aside className="v2-race-aside" aria-label="Inscription et informations">
          <div className="v2-panel" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 8px 24px rgba(27,43,32,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span className="v2-eyebrow" style={{ fontSize: 12, color: race.open ? "var(--moss)" : "#D9614F" }}>
                {race.open ? "Inscriptions ouvertes" : "Inscriptions fermées"}
              </span>
              {countdown && <span className="v2-countdown">{countdown}</span>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="v2-kv"><span>Départ</span><span>{[formatLongDate(race.start_date) || race.month, race.departure_time, race.start_place].filter(Boolean).join(" · ") || "—"}</span></div>
              {race.end_date && <div className="v2-kv"><span>Fin</span><span>{formatLongDate(race.end_date)}</span></div>}
              <div className="v2-kv"><span>Arrivée</span><span>{isLoop ? "Boucle, retour au départ" : (endPlace || "—")}</span></div>
              <div className="v2-kv"><span>Tarif</span><span>{price || "Voir le site de l'organisateur"}</span></div>
            </div>
            {signupUrl && (
              <a href={signupUrl} target="_blank" rel="noopener noreferrer" className="v2-btn v2-btn-rust" style={{ minHeight: 54, fontSize: 17 }}>
                {race.registration_url ? "S'inscrire sur le site officiel" : "Site de l'organisateur"}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
              </a>
            )}
            {upcoming && (
              <button type="button" className="v2-btn v2-btn-outline" style={{ minHeight: 46, fontSize: 15 }} onClick={() => downloadIcs(race)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
                Ajouter à mon agenda
              </button>
            )}
          </div>

          <OrganizerBox race={race} />
          {orgRaces.length > 0 && (race.organizer?.id) && (
            <div className="v2-panel" style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: -8 }}>
              <span style={{ fontSize: 14, color: "var(--text3)" }}>
                Aussi : {orgRaces.slice(0, 3).map((r) => r.name).join(", ")}{orgRaces.length > 3 ? "…" : "."}
              </span>
              <Link to={`/organizers/${race.organizer.id}`} className="v2-link" style={{ fontSize: 14 }}>
                Voir les {orgRaces.length + 1} ultras de l'organisateur →
              </Link>
            </div>
          )}

          <div className="v2-panel" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="v2-h3" style={{ fontSize: 12 }}>Éditions</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="v2-ed-num">{race.edition || 1}</span>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <b style={{ fontSize: 15 }}>{year ? `Édition ${year}` : "Édition en cours"}</b>
                <span className="muted" style={{ fontSize: 13 }}>
                  {previousEditions.length ? "Éditions précédentes :" : "Les éditions précédentes s'afficheront ici."}
                </span>
              </div>
            </div>
            {previousEditions.map((e) => (
              <Link key={e.id} to={`/courses/${e.id}`} className="mono" style={{ fontSize: 14, color: "var(--rust-text)" }}>
                {[`Édition ${e.edition}`, editionYear(e), e.km ? `${formatNumber(e.km)} km` : null].filter(Boolean).join(" — ")}
              </Link>
            ))}
          </div>
        </aside>
      </div>

      {similar.length > 0 && (
        <section className="v2-wrap" style={{ paddingBottom: 56 }}>
          <div className="v2-section-head">
            <h2 className="v2-h2">Dans le même esprit</h2>
            <Link to={`/ultras?discipline=${encodeURIComponent(race.discipline || "")}`} className="v2-link">Tous les ultras {race.discipline} →</Link>
          </div>
          <div className="v2-grid-tiles">
            {similar.map((r, i) => <RaceTile key={r.id} race={r} index={i} />)}
          </div>
        </section>
      )}

      <SiteFooter />
    </div>
  );
}
