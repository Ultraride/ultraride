import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { QUALITY, fr } from "./AdminOverview";

// Ce que l'IA ne sait pas corriger : on l'explique au lieu d'afficher le bouton.
const MANUAL_REASON = {
  no_image: "L'IA ne récupère pas d'images : ajoute-les à la main ou laisse les organisateurs déposer leur logo.",
  no_org: "Sans organisateur rattaché, il n'y a pas de site suivi à vérifier. Rattache chaque fiche à un organisateur.",
  odd_disc: "La discipline se corrige à la main dans la fiche (Route, Gravel ou VTT).",
};

function dateFr(iso) {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function since(iso) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `il y a ${h} h` : `le ${dateFr(iso)}`;
}

export default function QualityFamily() {
  const { family } = useParams();
  const meta = QUALITY.find((q) => q.key === family);
  const [races, setRaces] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [onlyUncovered, setOnlyUncovered] = useState(false);

  const loadRaces = useCallback(() => {
    supabase.rpc("admin_quality_races", { p_family: family }).then(({ data, error }) => {
      if (error) setError(error.message);
      else setRaces(data || []);
    });
  }, [family]);

  const loadCampaigns = useCallback(() => {
    supabase
      .from("race_check_campaigns")
      .select("*")
      .eq("family", family)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setCampaigns(data || []));
  }, [family]);

  useEffect(() => { loadRaces(); loadCampaigns(); }, [loadRaces, loadCampaigns]);

  const running = campaigns.find((c) => c.status === "running");
  const lastDone = campaigns.find((c) => c.status !== "running");

  // Suivi en direct pendant une campagne ; la liste des fiches est rechargée
  // à la fin, puisque les suggestions acceptées peuvent la faire maigrir.
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(loadCampaigns, 5000);
    return () => clearInterval(t);
  }, [running, loadCampaigns]);
  useEffect(() => { if (lastDone && !running) loadRaces(); }, [lastDone?.id, running]); // eslint-disable-line react-hooks/exhaustive-deps

  const covered = useMemo(() => (races || []).filter((r) => r.has_source).length, [races]);
  const shown = useMemo(() => (races || []).filter((r) => !onlyUncovered || !r.has_source), [races, onlyUncovered]);

  const start = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("start_quality_campaign", { p_family: family });
    if (error) setError(error.message);
    else {
      // Premier lot tout de suite, sans attendre la tâche de la minute suivante.
      supabase.functions.invoke("check-race-updates", { body: { campaign: true } }).then(loadCampaigns);
    }
    await loadCampaigns();
    setBusy(false);
  };

  const cancel = async () => {
    if (!running || !window.confirm("Arrêter la campagne ? Les suggestions déjà créées restent à valider.")) return;
    const { error } = await supabase.rpc("cancel_quality_campaign", { p_id: running.id });
    if (error) setError(error.message);
    loadCampaigns();
  };

  if (!meta) return <div className="sv"><p>Famille inconnue. <Link to="/admin" className="sv-link">Retour à la supervision</Link></p></div>;

  const back = `/admin/qualite/${family}`;
  const pct = running ? Math.round((running.sources_done / Math.max(1, running.sources_total)) * 100) : 0;
  const minutesLeft = running ? Math.max(1, Math.ceil((running.sources_total - running.sources_done) / 5)) : 0;

  return (
    <div className="sv qf">
      <header className="sv-head">
        <Link to="/admin" className="sv-link">← Supervision</Link>
        <div className="sv-head-top">
          <div>
            <div className="sv-eyebrow">Qualité des fiches</div>
            <h1 className="sv-title">{meta.label}</h1>
          </div>
          <div className="qf-count"><b>{races ? fr(races.length) : "…"}</b> fiches</div>
        </div>
      </header>

      {error && <div className="error-box">{error}</div>}

      <section className="sv-card qf-ai">
        <div className="sv-card-head">
          <h2>Vérification IA</h2>
          {meta.ai && <Link to="/admin/mises-a-jour" className="sv-link">Suggestions à valider ›</Link>}
        </div>

        {!meta.ai ? (
          <p className="qf-text">{MANUAL_REASON[family]}</p>
        ) : running ? (
          <>
            <p className="qf-text">
              Campagne lancée {since(running.created_at)} · <b>{running.sources_done}</b> sites vérifiés sur {running.sources_total}
              {" "}· <b>{running.suggestions_created}</b> suggestions{running.errors ? ` · ${running.errors} sites en erreur` : ""}
            </p>
            <div className="sv-bar-track qf-progress"><div className="sv-bar-fill sv-fill-rust" style={{ width: `${pct}%` }} /></div>
            <div className="qf-actions">
              <span className="sv-dim">Environ {minutesLeft} min restantes · continue même si tu fermes la page.</span>
              <button type="button" className="sv-btn" onClick={cancel}>Arrêter</button>
            </div>
          </>
        ) : (
          <>
            <p className="qf-text">
              <b>{fr(covered)}</b> fiches sur {races ? fr(races.length) : "…"} sont couvertes par un site d'organisateur suivi.
              L'IA relit ces sites en cherchant en priorité ce qui manque, et crée des suggestions :
              rien n'est modifié sans ta validation.
            </p>
            {lastDone && (
              <p className="sv-dim qf-last">
                Dernière campagne {since(lastDone.created_at)}{lastDone.status === "cancelled" ? " (arrêtée)" : ""} : {lastDone.sources_done}/{lastDone.sources_total} sites,
                {" "}{lastDone.suggestions_created} suggestions{lastDone.errors ? `, ${lastDone.errors} erreurs` : ""}.
              </p>
            )}
            <div className="qf-actions">
              <button type="button" className="sv-btn sv-btn-primary" onClick={start} disabled={busy || !covered}>
                {busy ? "Lancement…" : "Lancer la vérification IA"}
              </button>
              {races && races.length > covered && (
                <span className="sv-dim">{fr(races.length - covered)} fiches sans site suivi ne seront pas vérifiées.</span>
              )}
            </div>
          </>
        )}
      </section>

      <section className="sv-card">
        <div className="sv-card-head">
          <h2>Fiches</h2>
          {meta.ai && races && races.length > covered && (
            <label className="qf-filter">
              <input type="checkbox" checked={onlyUncovered} onChange={(e) => setOnlyUncovered(e.target.checked)} />
              Sans site suivi seulement
            </label>
          )}
        </div>
        {!races ? (
          <p className="sv-dim">Chargement…</p>
        ) : shown.length === 0 ? (
          <p className="sv-dim">Aucune fiche dans cette famille. 🎉</p>
        ) : (
          <ul className="qf-list">
            {shown.map((r) => (
              <li key={r.id}>
                <Link to={`/admin/races?edit=${r.id}&back=${encodeURIComponent(back)}`} className="qf-row">
                  <span className="qf-main">
                    <span className="qf-name">{r.name}</span>
                    <span className="qf-sub">{[r.organizer, r.country, dateFr(r.start_date)].filter(Boolean).join(" · ")}</span>
                  </span>
                  {meta.ai && !r.has_source && <span className="qf-tag">Sans site suivi</span>}
                  <span className="qf-edit">Modifier ›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
