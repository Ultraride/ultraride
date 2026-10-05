import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const PERIODS = [
  { days: 7, label: "7 jours" },
  { days: 30, label: "30 jours" },
  { days: 90, label: "90 jours" },
];

// Séries affichables dans l'histogramme. Une seule à la fois : superposer
// des vues (souvent des dizaines) et des inscriptions (souvent zéro ou une)
// sur la même échelle rendrait ces dernières invisibles.
const SERIES = [
  { key: "visits", label: "Visites du site" },
  { key: "bots", label: "Robots" },
  { key: "views", label: "Vues de fiches" },
  { key: "comments", label: "Avis déposés" },
  { key: "signups", label: "Inscriptions" },
  { key: "favorites", label: "Favoris ajoutés" },
  { key: "results", label: "Résultats palmarès" },
];

const fr = (n) => Number(n || 0).toLocaleString("fr-FR");

function formatDay(iso, days) {
  const d = new Date(iso);
  // Sur 90 jours, une étiquette par jour serait illisible : on n'affiche
  // que le jour du mois, et seulement un sur cinq (voir le rendu).
  return days > 30
    ? String(d.getDate())
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function Trend({ week, prevWeek }) {
  if (!prevWeek) return null;
  const pct = Math.round(((week - prevWeek) / prevWeek) * 100);
  const up = pct >= 0;
  return (
    <span style={{ color: up ? "var(--green, #15793F)" : "#C4622D", fontWeight: 600 }}>
      {up ? "▲ +" : "▼ "}{pct} % vs semaine précédente
    </span>
  );
}

// Bloc « hier / 7 derniers jours / 30 derniers jours », identique au digest.
function RecentBlock({ title, m, footer }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="stat-label" style={{ marginBottom: 8, textTransform: "uppercase", letterSpacing: ".1em" }}>{title}</div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-num">{fr(m.day)}</div>
          <div className="stat-label">Hier</div>
          {m.today != null && <div className="stat-sub">{fr(m.today)} aujourd'hui (en cours)</div>}
        </div>
        <div className="stat-card">
          <div className="stat-num">{fr(m.week)}</div>
          <div className="stat-label">7 derniers jours</div>
          <div className="stat-sub"><Trend week={m.week} prevWeek={m.prev_week} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{fr(m.month)}</div>
          <div className="stat-label">30 derniers jours</div>
          {m.alltime != null && <div className="stat-sub">{fr(m.alltime)} depuis le début</div>}
        </div>
      </div>
      {footer && <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{footer}</p>}
    </div>
  );
}

function Histogram({ data, seriesKey, days }) {
  const max = Math.max(1, ...data.map((d) => d[seriesKey] || 0));
  const labelEvery = days > 30 ? 5 : days > 14 ? 2 : 1;

  return (
    <div className="chart">
      <div className="chart-bars">
        {data.map((d, i) => {
          const value = d[seriesKey] || 0;
          return (
            <div className="chart-col" key={d.day}>
              {/* Au-delà de 30 colonnes, les barres deviennent trop étroites
                  pour accueillir un chiffre lisible : on s'en remet alors à
                  l'infobulle et au tableau du détail quotidien. */}
              {value > 0 && days <= 30 && (
                <div className="chart-value">{value}</div>
              )}
              <div
                className="chart-bar"
                style={{ height: `${(value / max) * 100}%` }}
                title={`${d.day} — ${value}`}
              />
              <div className="chart-label">
                {i % labelEvery === 0 ? formatDay(d.day, days) : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="chart-max">max {max}</div>
    </div>
  );
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [series, setSeries] = useState("visits");
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase.rpc("admin_traffic_stats", { days }).then(({ data, error }) => {
      if (error) setError(error.message);
      else setStats(data);
      setLoading(false);
    });
  }, [days]);

  const r = stats?.recent;

  return (
    <div>
      <h1 className="h1">Supervision</h1>

      {error && <div className="error-box">{error}</div>}
      {loading && !stats && <p className="muted">Chargement…</p>}

      {stats && (
        <>
          {/* ── Fréquentation : mêmes chiffres que le digest quotidien ── */}
          <div className="h2">Fréquentation</div>
          {r && (
            <>
              <RecentBlock
                title="Visites du site"
                m={r.site}
                footer={
                  <>
                    🤖 Robots (comptés à part) : <strong>{fr(r.bots.day)}</strong> hier ·{" "}
                    <strong>{fr(r.bots.week)}</strong> sur 7 j · <strong>{fr(r.bots.month)}</strong> sur 30 j
                    {!r.tracking_since && " — comptage des visites actif depuis le 5 octobre 2026 (hors admin)."}
                  </>
                }
              />
              <RecentBlock title="Consultations des fiches ultras" m={r.views} />
            </>
          )}

          <div className="h2" style={{ marginTop: 12 }}>Top 10 des ultras</div>
          {stats.top_races.length === 0 ? (
            <p className="muted">Aucune consultation enregistrée.</p>
          ) : (
            <div className="table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Ultra</th>
                    <th>Pays</th>
                    <th>Hier</th>
                    <th>7 j</th>
                    <th>30 j</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_races.map((t, i) => (
                    <tr key={t.id}>
                      <td className="mono muted">{i + 1}</td>
                      <td><Link to={`/courses/${t.id}`} target="_blank">{t.name}</Link></td>
                      <td>{t.country}</td>
                      <td className="mono">{fr(t.day)}</td>
                      <td className="mono">{fr(t.week)}</td>
                      <td className="mono">{fr(t.month)}</td>
                      <td className="mono"><strong>{fr(t.total_views)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Classé par vues sur 7 jours, puis par total.</p>

          {/* ── Activité sur la période choisie ── */}
          <div className="h2" style={{ marginTop: 32 }}>Activité sur la période</div>
          <div className="filter-row" style={{ marginBottom: 20 }}>
            {PERIODS.map((p) => (
              <button
                key={p.days}
                className={`chip ${days === p.days ? "chip-active" : ""}`}
                onClick={() => setDays(p.days)}
              >
                {p.label}
              </button>
            ))}
            {loading && <span className="muted" style={{ alignSelf: "center" }}>Chargement…</span>}
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-num">{fr(stats.totals.visits)}</div>
              <div className="stat-label">Visites du site</div>
              <div className="stat-sub">+ {fr(stats.totals.bots)} robots</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{fr(stats.totals.views)}</div>
              <div className="stat-label">Vues de fiches</div>
              <div className="stat-sub">{fr(stats.alltime.views)} depuis le début</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{stats.totals.comments}</div>
              <div className="stat-label">Avis déposés</div>
              <div className="stat-sub">{stats.alltime.comments} au total</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{stats.totals.signups}</div>
              <div className="stat-label">Inscriptions</div>
              <div className="stat-sub">{stats.alltime.profiles} comptes</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{stats.totals.favorites}</div>
              <div className="stat-label">Favoris ajoutés</div>
              <div className="stat-sub">{stats.alltime.favorites} au total</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{stats.totals.results}</div>
              <div className="stat-label">Résultats palmarès</div>
              <div className="stat-sub">{stats.alltime.results} au total</div>
            </div>
          </div>

          <div className="h2" style={{ marginTop: 32 }}>Activité par jour</div>
          <div className="filter-row" style={{ marginBottom: 12 }}>
            {SERIES.map((s) => (
              <button
                key={s.key}
                className={`chip ${series === s.key ? "chip-active" : ""}`}
                onClick={() => setSeries(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Histogram data={stats.daily} seriesKey={series} days={days} />

          <div className="h2" style={{ marginTop: 32 }}>Détail quotidien</div>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Jour</th>
                  <th>Visites</th>
                  <th>Robots</th>
                  <th>Vues</th>
                  <th>Avis</th>
                  <th>Inscriptions</th>
                  <th>Favoris</th>
                  <th>Palmarès</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.daily].reverse().map((d) => (
                  <tr key={d.day}>
                    <td className="mono">{new Date(d.day).toLocaleDateString("fr-FR")}</td>
                    <td className="mono">{d.visits}</td>
                    <td className="mono muted">{d.bots}</td>
                    <td className="mono">{d.views}</td>
                    <td className="mono">{d.comments}</td>
                    <td className="mono">{d.signups}</td>
                    <td className="mono">{d.favorites}</td>
                    <td className="mono">{d.results}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
            Visites : une par onglet ouvert, sans cookie ni donnée personnelle, hors visites admin.
            Robots : seuls ceux qui exécutent le JavaScript sont comptés (minimum, pas un total).
            Pour la volumétrie complète des robots, voir « Statistiques et logs » dans l'espace client OVH.
          </p>
        </>
      )}
    </div>
  );
}
