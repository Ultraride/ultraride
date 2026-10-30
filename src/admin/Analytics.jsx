import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import SupervisionHeader from "./SupervisionHeader";
import { Bar, Kpi, fr } from "./AdminOverview";

const DISC_TONE = { Route: "route", Gravel: "gravel", VTT: "vtt" };
const ROLE_LABEL = { participant: "Participants", organizer: "Organisateurs", admin: "Admins" };

function daysSince(iso) {
  if (!iso) return 90;
  return Math.min(365, Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) + 1));
}

function Trend({ now, prev }) {
  if (!prev) return null;
  const pct = Math.round(((now - prev) / prev) * 100);
  return <span className={pct >= 0 ? "sv-up" : "sv-down"}>{pct >= 0 ? "▲ +" : "▼ "}{pct} % vs 7 j précédents</span>;
}

// Colonnes jour par jour : visites (plein) et vues de fiches (contour), même échelle.
function DailyBars({ daily }) {
  const max = Math.max(1, ...daily.map((d) => Math.max(d.visits || 0, d.views || 0)));
  const every = daily.length > 45 ? 7 : daily.length > 14 ? 3 : 1;
  return (
    <div className="sv-chart" role="img" aria-label="Visites et vues de fiches par jour">
      <div className="sv-chart-grid">
        {daily.map((d, i) => (
          <div className="sv-chart-col" key={d.day} title={`${new Date(d.day).toLocaleDateString("fr-FR")} · ${d.visits} visites · ${d.views} vues`}>
            <div className="sv-chart-pair">
              <span className="sv-chart-bar sv-chart-visits" style={{ height: `${((d.visits || 0) / max) * 100}%` }} />
              <span className="sv-chart-bar sv-chart-views" style={{ height: `${((d.views || 0) / max) * 100}%` }} />
            </div>
            <span className="sv-chart-label">
              {i % every === 0 ? new Date(d.day).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="sv-chart-legend">
        <span><i className="sv-chart-visits" />Visites</span>
        <span><i className="sv-chart-views" />Vues de fiches</span>
        <span className="sv-dim mono">max {fr(max)}</span>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState(30); // 7, 30 ou "all"
  const [trackingSince, setTrackingSince] = useState(null);
  const [stats, setStats] = useState(null);
  const [bd, setBd] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const days = period === "all" ? daysSince(trackingSince) : period;

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      supabase.rpc("admin_traffic_stats", { days }),
      supabase.rpc("admin_breakdowns", { days }),
    ]).then(([s, b]) => {
      const err = s.error || b.error;
      if (err) setError(err.message);
      else {
        setStats(s.data);
        setBd(b.data);
        if (s.data?.recent?.tracking_since) setTrackingSince(s.data.recent.tracking_since);
      }
      setLoading(false);
    });
  }, [days]);

  const r = stats?.recent;
  const t = stats?.totals || {};
  const discTotal = useMemo(() => (bd?.by_discipline || []).reduce((a, x) => a + (x.views || 0), 0), [bd]);
  const countryTotal = useMemo(() => (bd?.by_country || []).reduce((a, x) => a + (x.views || 0), 0), [bd]);
  const roles = bd?.profiles_by_role || {};
  const rolesTotal = Object.values(roles).reduce((a, n) => a + n, 0);

  const periodLabel = period === "all" ? "depuis le début" : `sur ${period} jours`;

  return (
    <div className="sv">
      <SupervisionHeader>
        <div className="sv-seg" role="group" aria-label="Période">
          {[[7, "7 jours"], [30, "30 jours"], ["all", "Depuis le début"]].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={period === v} onClick={() => setPeriod(v)}>{l}</button>
          ))}
        </div>
      </SupervisionHeader>

      {error && <div className="error-box">{error}</div>}
      {!stats && !error && <p className="muted">Chargement…</p>}

      {stats && (
        <div className={loading ? "sv-loading" : ""}>
          <div className="sv-kpis">
            <Kpi value={fr(t.visits)} label="Visites" sub={r && <Trend now={r.site.week} prev={r.site.prev_week} />} />
            <Kpi value={fr(t.views)} label="Vues de fiches" sub={`${fr(bd?.races_viewed)} fiches consultées`} />
            <Kpi value={fr(t.signups)} label="Inscriptions" sub={`${fr(stats.alltime?.profiles)} comptes au total`} />
            <Kpi value={fr(t.favorites)} label="Favoris ajoutés" sub={`${fr(stats.alltime?.favorites)} au total`} />
            <Kpi value={fr(t.comments)} label="Avis déposés" sub={`${fr(stats.alltime?.comments)} au total`} />
            <Kpi value={fr(t.results)} label="Résultats palmarès" sub={`+ ${fr(t.bots)} robots exclus des visites`} />
          </div>

          <section className="sv-card">
            <div className="sv-card-head">
              <h2>Jour par jour</h2>
              <span className="sv-dim">{periodLabel}</span>
            </div>
            <DailyBars daily={stats.daily || []} />
          </section>

          <div className="sv-grid sv-grid-3">
            <section className="sv-card">
              <div className="sv-card-head"><h2>Vues par discipline</h2></div>
              {(bd?.by_discipline || []).map((x) => (
                <Bar key={x.label} label={x.label} value={x.views} total={discTotal} tone={DISC_TONE[x.label] || "dim"} />
              ))}
              {!bd?.by_discipline?.length && <p className="sv-empty">Aucune vue.</p>}
            </section>
            <section className="sv-card">
              <div className="sv-card-head"><h2>Vues par pays</h2></div>
              {(bd?.by_country || []).map((x) => (
                <Bar key={x.label} label={x.label} value={x.views} total={countryTotal} />
              ))}
              {!bd?.by_country?.length && <p className="sv-empty">Aucune vue.</p>}
            </section>
            <section className="sv-card">
              <div className="sv-card-head"><h2>Comptes par type</h2><span className="sv-dim">+{fr(bd?.signups7)} sur 7 j</span></div>
              {Object.entries(roles).map(([role, n]) => (
                <Bar key={role} label={ROLE_LABEL[role] || role} value={n} total={rolesTotal} tone={role === "organizer" ? "rust" : null} />
              ))}
            </section>
          </div>

          <section className="sv-card">
            <div className="sv-card-head"><h2>Fiches les plus vues</h2><span className="sv-dim">{periodLabel}</span></div>
            {stats.top_races?.length ? (
              <div className="table-scroll">
                <table className="sv-table">
                  <thead><tr><th>#</th><th>Ultra</th><th>Pays</th><th className="num">Hier</th><th className="num">7 j</th><th className="num">Période</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {stats.top_races.map((x, i) => (
                      <tr key={x.id}>
                        <td className="mono sv-dim">{i + 1}</td>
                        <td><Link to={`/courses/${x.id}`} target="_blank">{x.name}</Link></td>
                        <td>{x.country}</td>
                        <td className="num mono">{fr(x.day)}</td>
                        <td className="num mono">{fr(x.week)}</td>
                        <td className="num mono">{fr(x.period_views ?? x.month)}</td>
                        <td className="num mono"><strong>{fr(x.total_views)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="sv-empty">Aucune consultation enregistrée.</p>}
          </section>

          <details className="sv-card sv-details">
            <summary>Détail quotidien</summary>
            <div className="table-scroll">
              <table className="sv-table">
                <thead><tr><th>Jour</th><th className="num">Visites</th><th className="num">Robots</th><th className="num">Vues</th><th className="num">Avis</th><th className="num">Inscriptions</th><th className="num">Favoris</th><th className="num">Palmarès</th></tr></thead>
                <tbody>
                  {[...(stats.daily || [])].reverse().map((d) => (
                    <tr key={d.day}>
                      <td className="mono">{new Date(d.day).toLocaleDateString("fr-FR")}</td>
                      <td className="num mono">{d.visits}</td>
                      <td className="num mono sv-dim">{d.bots}</td>
                      <td className="num mono">{d.views}</td>
                      <td className="num mono">{d.comments}</td>
                      <td className="num mono">{d.signups}</td>
                      <td className="num mono">{d.favorites}</td>
                      <td className="num mono">{d.results}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <p className="sv-foot">
            Visites : une par onglet ouvert, sans cookie ni donnée personnelle, hors visites admin. Comptage actif depuis le{" "}
            {r?.tracking_since ? new Date(r.tracking_since).toLocaleDateString("fr-FR") : "5 octobre 2026"}.
            Robots : seuls ceux qui exécutent le JavaScript sont comptés.
          </p>
        </div>
      )}
    </div>
  );
}
