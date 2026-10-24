import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import SupervisionHeader from "./SupervisionHeader";

export const fr = (n) => Number(n || 0).toLocaleString("fr-FR");

function ago(iso) {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days} j`;
}

function dateFr(iso) {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

export function Kpi({ value, label, sub, tone }) {
  return (
    <div className={`sv-kpi${tone ? ` sv-kpi-${tone}` : ""}`}>
      <div className="sv-kpi-num">{value}</div>
      <div className="sv-kpi-label">{label}</div>
      {sub && <div className="sv-kpi-sub">{sub}</div>}
    </div>
  );
}

// Barre horizontale « libellé · valeur / total ».
export function Bar({ label, value, total, tone }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className="sv-bar">
      <div className="sv-bar-head">
        <span>{label}</span>
        <span className="mono">{fr(value)}{total ? <span className="sv-dim"> · {pct} %</span> : null}</span>
      </div>
      <div className="sv-bar-track"><div className={`sv-bar-fill${tone ? ` sv-fill-${tone}` : ""}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

const QUALITY = [
  { key: "to_renew", label: "Édition passée, à renouveler", tone: "rust" },
  { key: "no_signup", label: "Sans lien d'inscription" },
  { key: "no_dplus", label: "Sans dénivelé" },
  { key: "no_image", label: "Sans image" },
  { key: "no_org", label: "Sans organisateur rattaché" },
  { key: "no_date", label: "Sans date" },
  { key: "odd_disc", label: "Discipline hors filtres", tone: "rust" },
];

const ROLE_LABEL = { participant: "Participants", organizer: "Organisateurs", admin: "Admins" };

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.rpc("admin_overview").then(({ data, error }) => {
      if (error) setError(error.message);
      else setData(data);
    });
  }, []);

  if (error) return <><SupervisionHeader /><div className="error-box">{error}</div></>;
  if (!data) return <><SupervisionHeader /><p className="muted">Chargement…</p></>;

  const q = data.quality || {};
  const checks = data.checks || {};
  const lastCron = checks.last_cron_run;
  // La vérification IA des sites tourne chaque semaine : au-delà de 8 jours
  // sans passage automatique, c'est que la tâche planifiée est en panne.
  const cronLate = !lastCron || Date.now() - new Date(lastCron).getTime() > 8 * 86400000;
  const roles = data.profiles_by_role || {};
  const waiting = (data.pending?.length || 0) + (data.deletion_requests || 0) + (data.comments_pending || 0)
    + (data.submissions_new || 0) + (data.suggestions_pending || 0);

  return (
    <div className="sv">
      <SupervisionHeader />

      {cronLate && (
        <div className="sv-alert" role="alert">
          <strong>La vérification hebdomadaire des sites ne tourne plus.</strong>{" "}
          {lastCron ? `Dernier passage automatique ${ago(lastCron)}.` : "Aucun passage automatique enregistré."}{" "}
          <Link to="/admin/mises-a-jour">Lancer une vérification</Link>
        </div>
      )}

      <div className="sv-kpis">
        <Kpi value={fr(data.published)} label="Ultras publiés" sub={`${fr(data.upcoming)} à venir`} />
        <Kpi value={fr(waiting)} label="En attente d'action" sub={`${data.pending?.length || 0} fiches · ${data.comments_pending || 0} avis · ${data.submissions_new || 0} propositions`} tone={waiting ? "rust" : null} />
        <Kpi value={fr(data.visits7)} label="Visites · 7 jours" sub={`${fr(data.visits_all)} depuis le ${dateFr(data.tracking_since)}`} />
        <Kpi value={fr(data.profiles)} label="Comptes" sub={`+${fr(data.signups30)} sur 30 j · ${fr(data.org_signups30)} organisateurs`} />
        <Kpi value={fr(data.suggestions_pending)} label="Mises à jour proposées" sub={`${fr(data.suggestions_accepted)} acceptées au total`} />
        <Kpi value={fr(data.instagram_published)} label="Posts Instagram" sub="publiés" />
      </div>

      <div className="sv-grid">
        <div className="sv-col">
        <section className="sv-card">
          <div className="sv-card-head">
            <h2>À valider</h2>
            <Link to="/admin/a-valider" className="sv-link">Tout voir →</Link>
          </div>
          {data.pending?.length ? (
            <div className="table-scroll">
              <table className="sv-table">
                <thead><tr><th>Ultra</th><th>Organisateur</th><th>Type</th><th>Soumis</th></tr></thead>
                <tbody>
                  {data.pending.slice(0, 8).map((p) => (
                    <tr key={p.id}>
                      <td><Link to="/admin/a-valider">{p.name}</Link></td>
                      <td>{p.organizer || <span className="sv-dim">—</span>}</td>
                      <td><span className={`sv-pill${p.has_published_version ? "" : " sv-pill-new"}`}>{p.has_published_version ? "Modification" : "Nouvelle fiche"}</span></td>
                      <td className="sv-dim" style={{ whiteSpace: "nowrap" }}>{ago(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="sv-empty">Rien à valider. 👌</p>}
          {data.deletion_requests > 0 && (
            <p className="sv-note">{data.deletion_requests} demande(s) de suppression en attente.</p>
          )}
        </section>

        <section className="sv-card">
          <div className="sv-card-head">
            <h2>Organisateurs</h2>
            <Link to="/admin/organizers" className="sv-link">Gérer →</Link>
          </div>
          {data.organizers?.length ? (
            <div className="table-scroll">
              <table className="sv-table">
                <thead><tr><th>Organisateur</th><th>Inscrit</th><th className="num">Ultras</th><th className="num">À renouveler</th><th className="num">En attente</th></tr></thead>
                <tbody>
                  {data.organizers.map((o) => (
                    <tr key={o.name + o.created_at}>
                      <td>{o.name}</td>
                      <td className="sv-dim" style={{ whiteSpace: "nowrap" }}>{dateFr(o.created_at)}</td>
                      <td className="num mono">{fr(o.races)}</td>
                      <td className={`num mono${o.to_renew ? " sv-warn" : ""}`}>{fr(o.to_renew)}</td>
                      <td className="num mono">{fr(o.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="sv-empty">Aucun compte organisateur.</p>}
          <div className="sv-roles">
            {Object.entries(roles).map(([role, n]) => (
              <span key={role}><strong className="mono">{fr(n)}</strong> {ROLE_LABEL[role] || role}</span>
            ))}
          </div>
        </section>
        </div>
        <div className="sv-col">
        <section className="sv-card">
          <div className="sv-card-head">
            <h2>Vérification des sites</h2>
            <Link to="/admin/mises-a-jour" className="sv-link">Ouvrir →</Link>
          </div>
          <dl className="sv-dl">
            <div><dt>Sources suivies</dt><dd className="mono">{fr(checks.sources)}</dd></div>
            <div><dt>Dernier passage</dt><dd>{checks.last_run ? `${ago(checks.last_run.run_at)} · ${checks.last_run.trigger === "cron" ? "auto" : "manuel"}` : "—"}</dd></div>
            <div><dt>Sites vérifiés</dt><dd className="mono">{fr(checks.last_run?.sources_checked)}</dd></div>
            <div><dt>Suggestions créées</dt><dd className="mono">{fr(checks.last_run?.suggestions_created)}</dd></div>
            <div><dt>Erreurs</dt><dd className="mono">{fr(checks.last_run?.errors)}</dd></div>
            <div><dt>Dernier passage auto</dt><dd className={cronLate ? "sv-warn" : ""}>{lastCron ? ago(lastCron) : "jamais"}</dd></div>
          </dl>
        </section>

        <section className="sv-card">
          <div className="sv-card-head">
            <h2>Qualité des fiches</h2>
            <span className="sv-dim">{fr(q.total)} fiches</span>
          </div>
          {QUALITY.map((it) => <Bar key={it.key} label={it.label} value={q[it.key] || 0} total={q.total} tone={it.tone} />)}
        </section>

        </div>
      </div>
    </div>
  );
}
