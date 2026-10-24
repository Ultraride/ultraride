import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { formatPrice } from "../lib/price";
import { RaceMap, Comments } from "../pages/RaceDetail";
import { daysUntil, formatDate, formatNumber } from "./data";
import { Cover, Pill, Icon, useFavorite, disciplineBg, formatLabel } from "./ui";

const PARCOURS_LABEL = { boucle: "Boucle", point: "Point à point", ar: "Aller-retour" };

function Elevation({ profile }) {
  if (!Array.isArray(profile) || profile.length < 2) return null;
  const w = 320, h = 80;
  const maxKm = profile[profile.length - 1][0] || 1;
  const alts = profile.map((p) => p[1]);
  const lo = Math.min(...alts), hi = Math.max(...alts);
  const span = hi - lo || 1;
  const pts = profile.map(([km, alt]) => [(km / maxKm) * w, h - 6 - ((alt - lo) / span) * (h - 14)]);
  const line = "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
  return (
    <div className="m-card m-elev">
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Profil d'élévation, de ${Math.round(lo)} à ${Math.round(hi)} m`}>
        <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill="#F3DCCD" />
        <path d={line} stroke="#B4541F" strokeWidth="2" fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="m-elev-legend m-label"><span>{Math.round(lo)} m</span><span>max {Math.round(hi)} m</span></div>
    </div>
  );
}

function initials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

export default function MobileRaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [race, setRace] = useState(null);
  const [error, setError] = useState(null);
  const fav = useFavorite(id);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    supabase
      .from("races")
      .select("*, organizer:organizers!races_organizer_id_fkey(id, name, website, email, instagram, facebook, strava, logo_url)")
      .eq("id", id)
      .single()
      .then(({ data, error }) => (error ? setError(error.message) : setRace(data)));
    supabase.rpc("increment_race_view", { p_race_id: id }).then(({ error }) => {
      if (error) console.warn("increment_race_view:", error.message);
    });
  }, [id]);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: race?.name, url });
      else { await navigator.clipboard.writeText(url); setShared(true); setTimeout(() => setShared(false), 2000); }
    } catch { /* partage annulé */ }
  };

  const topButtons = (
    <div className="m-detail-top">
      <button type="button" className="m-roundbtn m-roundbtn--light" aria-label="Retour" onClick={back}><Icon name="back" /></button>
      <div className="m-detail-top-right">
        <button type="button" className="m-roundbtn m-roundbtn--light" aria-label={shared ? "Lien copié" : "Partager"} onClick={share}><Icon name="share" size={18} /></button>
        <button type="button" className="m-roundbtn m-roundbtn--light" aria-label={fav.isFav ? "Retirer des favoris" : "Ajouter aux favoris"} aria-pressed={fav.isFav} onClick={fav.toggle} disabled={fav.busy}>
          <Icon name="heart" fill={fav.isFav ? "#B4541F" : "none"} stroke="#B4541F" width={2} />
        </button>
      </div>
    </div>
  );

  if (error) return <div className="m-screen m-pad" style={{ paddingTop: 80 }}>{topButtons}<div className="m-error">{error}</div></div>;
  if (!race) return <div className="m-screen"><div className="m-skeleton" style={{ height: 300, borderRadius: 0 }} /></div>;

  const j = daysUntil(race);
  const price = formatPrice(race.price);
  const loop = race.parcours === "boucle";
  const from = (race.start_place || "Départ").split(",")[0];
  const to = loop ? "Boucle" : (race.end_place || "Arrivée").split(",")[0];
  const stats = [
    race.km && { label: "DISTANCE", value: `${formatNumber(race.km)} KM` },
    race.dplus && { label: "DÉNIVELÉ +", value: `${formatNumber(race.dplus)} M` },
    { label: "DÉPART", value: formatDate(race, { short: true }).toUpperCase() },
    race.parcours && { label: "PARCOURS", value: (PARCOURS_LABEL[race.parcours] || race.parcours).toUpperCase() },
    race.mode && !race.parcours && { label: "MODE", value: race.mode.toUpperCase() },
  ].filter(Boolean).slice(0, 4);
  const ctaUrl = race.registration_url || race.organizer?.website;

  return (
    <div className="m-screen m-screen--detail">
      <Cover race={race} height={300}>
        {topButtons}
        <div className="m-cover-bottom">
          <div className="m-cover-tags m-cover-tags--static">
            {race.discipline && <Pill>{race.discipline.toUpperCase()}</Pill>}
            {race.format && <Pill tone="solid" bg="#000">{formatLabel(race.format).toUpperCase()}</Pill>}
            {race.mode && <Pill tone="glass">{race.mode.toUpperCase()}</Pill>}
          </div>
          <h1 className="m-detail-title">{race.name}</h1>
        </div>
      </Cover>

      <div className="m-pad m-stack" style={{ paddingTop: 18 }}>
        <div className="m-org-row">
          {race.organizer?.id ? (
            <Link to={`/organizers/${race.organizer.id}`} className="m-org">
              <span className="m-org-badge">
                {race.organizer.logo_url ? <img src={race.organizer.logo_url} alt="" /> : initials(race.organizer.name)}
              </span>
              <span className="m-org-text"><span className="m-org-by">Organisé par</span><span className="m-org-name">{race.organizer.name}</span></span>
            </Link>
          ) : <span />}
          {j != null && <span className="m-label m-label--rust">J-{j}</span>}
        </div>

        <div className="m-stats4">
          {stats.map((s) => (
            <div key={s.label} className="m-card m-stat4">
              <span className="m-label">{s.label}</span>
              <span className="m-stat4-val">{s.value}</span>
            </div>
          ))}
        </div>

        <div className="m-stack m-stack--tight">
          <h2 className="m-label m-label--strong">ROADBOOK</h2>
          <div className="m-roadbook">
            <span className="m-rb-dot" />
            <span className="m-rb-place">{from}</span>
            <span className="m-rb-line" />
            {race.km && <span className="m-label">{formatNumber(race.km)} km</span>}
            <span className="m-rb-line" />
            <span className="m-rb-place">{to}</span>
            <span className="m-rb-dot m-rb-dot--end" />
          </div>
          <Elevation profile={race.elevation_profile} />
          <div className="m-detail-map"><RaceMap race={race} /></div>
        </div>

        {(race.long_blurb || race.blurb) && <p className="m-body">{race.long_blurb || race.blurb}</p>}

        <div className="m-facts">
          {race.country && <div><span className="m-label">PAYS</span><span>{race.country}</span></div>}
          {race.mode && <div><span className="m-label">MODE</span><span>{race.mode}</span></div>}
          {race.departure_time && <div><span className="m-label">HEURE DE DÉPART</span><span>{race.departure_time}</span></div>}
          <div><span className="m-label">INSCRIPTIONS</span><span>{race.open ? "Ouvertes" : "Fermées ou à venir"}</span></div>
        </div>

        <div className="m-comments"><Comments raceId={race.id} /></div>
      </div>

      <div className="m-ctabar">
        <div className="m-ctabar-price">
          <span className="m-label">TARIF</span>
          <span className="m-ctabar-val">{price || "Voir le site"}</span>
        </div>
        {ctaUrl ? (
          <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="m-btn m-btn--primary m-btn--grow">
            {race.registration_url ? "S'inscrire" : "Site de l'organisateur"} <Icon name="external" size={16} width={2.4} />
          </a>
        ) : (
          <button type="button" className="m-btn m-btn--primary m-btn--grow" onClick={fav.toggle}>
            {fav.isFav ? "Dans tes favoris" : "Ajouter aux favoris"}
          </button>
        )}
      </div>
    </div>
  );
}
