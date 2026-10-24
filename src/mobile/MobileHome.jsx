import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useRaces, useGeo, isUpcoming, chronoRank, daysUntil, haversineKm, startCoords } from "./data";
import { Cover, Pill, Stamp, Stat, raceStats, MiniCard, MenuButton, Icon, disciplineBg } from "./ui";

const DISCIPLINES = ["Route", "Gravel", "VTT"];
const NEARBY_RADIUS_KM = 400;

function Section({ title, action, children }) {
  return (
    <section className="m-section">
      <div className="m-section-head">
        <h2 className="m-label m-label--strong">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Featured({ race }) {
  const j = daysUntil(race);
  return (
    <Link to={`/courses/${race.id}`} className="m-feature">
      <Cover race={race} height={190}>
        <div className="m-cover-tags">
          <Pill>{(race.discipline || "Ultra").toUpperCase()}</Pill>
          {race.country && <Pill tone="glass">{race.country.toUpperCase()}</Pill>}
        </div>
        {j != null && <span className="m-cover-stamp"><Stamp top="DÉPART" big={`J-${j}`} /></span>}
        <div className="m-cover-title">{race.name}</div>
      </Cover>
      <div className="m-stats3">
        {raceStats(race).map((s) => <Stat key={s.label} {...s} />)}
      </div>
    </Link>
  );
}

export default function MobileHome() {
  const { races, error } = useRaces();
  const geo = useGeo();

  const upcoming = useMemo(
    () => (races ? races.filter(isUpcoming).sort((a, b) => chronoRank(a) - chronoRank(b)) : []),
    [races]
  );

  // À la une : l'ultra à venir le plus consulté, de préférence illustré.
  const featured = useMemo(() => {
    if (!upcoming.length) return null;
    return [...upcoming].sort((a, b) => (b.view_count || 0) - (a.view_count || 0))[0];
  }, [upcoming]);

  const nextDepartures = useMemo(
    () => upcoming.filter((r) => r.id !== featured?.id).slice(0, 10),
    [upcoming, featured]
  );

  const nearby = useMemo(() => {
    if (!geo.coords || !races) return [];
    return races
      .map((r) => {
        const c = startCoords(r);
        return c ? { race: r, km: haversineKm(geo.coords.lat, geo.coords.lon, c[0], c[1]) } : null;
      })
      .filter((x) => x && x.km <= NEARBY_RADIUS_KM && (isUpcoming(x.race) || !x.race.start_date))
      .sort((a, b) => a.km - b.km)
      .slice(0, 8);
  }, [races, geo.coords]);

  const countries = useMemo(() => (races ? new Set(races.map((r) => r.country).filter(Boolean)).size : 0), [races]);

  return (
    <div className="m-screen">
      <div className="m-pad m-stack">
        <div className="m-topbar">
          <span className="m-wordmark m-wordmark--lg">ULTRA<span>RIDE</span></span>
          <MenuButton />
        </div>

        <div className="m-hero">
          <div className="m-label m-label--green">
            {races ? `${races.length} ULTRAS · ${countries} PAYS` : "RÉPERTOIRE ULTRA-DISTANCE"}
          </div>
          <h1 className="m-h1">TROUVE TON<br />PROCHAIN ULTRA</h1>
        </div>

        <Link to="/ultras" className="m-searchpill">
          <Icon name="search" />
          <span>Nom, pays, organisateur…</span>
          <span className="m-searchpill-btn"><Icon name="sliders" size={18} /></span>
        </Link>

        <div className="m-chips">
          <Link to="/ultras" className="m-chip m-chip--on">Tous</Link>
          {DISCIPLINES.map((d) => (
            <Link key={d} to={`/ultras?d=${encodeURIComponent(d)}`} className="m-chip">
              <span className="m-chip-dot" style={{ background: disciplineBg(d) }} />{d}
            </Link>
          ))}
        </div>

        {error && <div className="m-error">Impossible de charger les ultras ({error}).</div>}
        {!races && !error && <div className="m-skeleton" style={{ height: 260 }} />}

        {featured && (
          <Section title="À LA UNE" action={<Link to="/ultras" className="m-link">Tout voir</Link>}>
            <Featured race={featured} />
          </Section>
        )}

        {races && (
          <Section title="PRÈS DE TOI" action={<Link to="/carte" className="m-link">Carte</Link>}>
            {geo.status === "granted" && nearby.length > 0 ? (
              <div className="m-hscroll">
                {nearby.map(({ race, km }) => (
                  <MiniCard key={race.id} race={race} extra={`à ${Math.round(km)} km`} />
                ))}
              </div>
            ) : (
              <div className="m-card m-geo">
                {geo.status === "loading" && <p>Localisation en cours…</p>}
                {geo.status === "granted" && <p>Aucun départ référencé à moins de {NEARBY_RADIUS_KM} km.</p>}
                {geo.status === "denied" && <p>Localisation refusée : autorise-la dans les réglages pour voir les ultras proches.</p>}
                {geo.status === "unsupported" && <p>Ton appareil ne permet pas la géolocalisation.</p>}
                {geo.status === "idle" && (
                  <>
                    <p>Active la localisation pour voir les départs autour de toi. Ta position reste sur ton téléphone.</p>
                    <button type="button" className="m-btn m-btn--dark" onClick={geo.request}>
                      <Icon name="locate" size={16} /> Me localiser
                    </button>
                  </>
                )}
              </div>
            )}
          </Section>
        )}

        {nextDepartures.length > 0 && (
          <Section title="PROCHAINS DÉPARTS" action={<Link to="/ultras" className="m-link">Tout voir</Link>}>
            <div className="m-hscroll">
              {nextDepartures.map((r) => <MiniCard key={r.id} race={r} />)}
            </div>
          </Section>
        )}

        {races && (
          <Link to="/ultras" className="m-btn m-btn--primary m-btn--block">Voir les {races.length} ultras</Link>
        )}
      </div>
    </div>
  );
}
