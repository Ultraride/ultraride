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
  { key: "views", label: "Vues de fiches" },
  { key: "comments", label: "Avis déposés" },
  { key: "signups", label: "Inscriptions" },
  { key: "favorites", label: "Favoris ajoutés" },
  { key: "results", label: "Résultats palmarès" },
];

function formatDay(iso, days) {
  const d = new Date(iso);
  // Sur 90 jours, une étiquette par jour serait illisible : on n'affiche
  // que le jour du mois, et seulement un sur cinq (voir le rendu).
  return days > 30
    ? String(d.getDate())
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
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
  const [series, setSeries] = useState("views");
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

  return (
    <div>
      <h1 className="h1">Supervision</h1>

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
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && <p className="muted">Chargement…</p>}

      {stats && !loading && (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-num">{stats.totals.views.toLocaleString("fr-FR")}</div>
              <div className="stat-label">Vues de fiches</div>
              <div className="stat-sub">{stats.alltime.views.toLocaleString("fr-FR")} depuis le début</div>
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

          <div className="h2" style={{ marginTop: 32 }}>Fiches les plus consultées</div>
          {stats.top_races.length === 0 ? (
            <p className="muted">Aucune consultation enregistrée.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Pays</th>
                  <th>Sur la période</th>
                  <th>Depuis le début</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_races.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/courses/${r.id}`} target="_blank">{r.name}</Link></td>
                    <td>{r.country}</td>
                    <td className="mono">{r.period_views}</td>
                    <td className="mono">{r.total_views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
            Ces chiffres portent sur l'activité enregistrée en base. Pour le trafic global du site
            (visiteurs, pages vues, provenance), Cloudflare Web Analytics est inclus gratuitement
            avec l'hébergement Pages et s'active depuis le tableau de bord Cloudflare.
          </p>
        </>
      )}
    </div>
  );
}
