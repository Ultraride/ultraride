import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { normalizeUrl } from "../lib/organizerLinks";

// Suggestions produites chaque semaine par l'Edge Function check-race-updates.
// Rien n'est écrit dans `races` sans un clic sur « Valider ».

const TABS = [
  { key: "suggestions", label: "Suggestions" },
  { key: "sources", label: "Sources" },
  { key: "history", label: "Historique" },
];

const FIELD_LABEL = {
  start_date: "Date de début",
  end_date: "Date de fin",
  month: "Mois",
  km: "Distance (km)",
  dplus: "D+ (m)",
  open: "Inscriptions",
  next_edition: "Prochaine édition",
  registration_url: "Lien d'inscription",
};

const CONFIDENCE = {
  high: { label: "Élevée", bg: "#15793F" },
  medium: { label: "Moyenne", bg: "#D9822B" },
  low: { label: "Faible", bg: "#8A8A80" },
};

const SOURCE_STATUS = {
  ok: { label: "Suggestions", bg: "#15793F" },
  no_change: { label: "Aucun changement", bg: "#8A8A80" },
  unreadable: { label: "Illisible", bg: "#D9822B" },
  error: { label: "Erreur", bg: "#B8432E" },
};

const MAX_CHECK = 5;

// Tarif Claude Haiku 5.5, en $ par token.
const INPUT_PRICE = 0.1 / 1_000_000;
const OUTPUT_PRICE = 0.5 / 1_000_000;

function Pill({ label, bg, title }) {
  return (
    <span className="ru-pill" style={{ background: bg }} title={title}>
      {label}
    </span>
  );
}

function displayValue(field, value) {
  if (value === null || value === undefined || value === "") return <span className="muted">—</span>;
  if (field === "open") return value === "true" ? "Ouvert" : "Fermé";
  if (field === "start_date" || field === "end_date") {
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("fr-FR");
  }
  if (field === "registration_url") {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" style={{ wordBreak: "break-all" }}>
        {value}
      </a>
    );
  }
  return value;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// Convertit la valeur proposée (texte) dans le type de la colonne, comme le
// fait RaceForm avant d'enregistrer.
function convertValue(field, raw) {
  const v = (raw ?? "").trim();
  if (field === "km" || field === "dplus") {
    const n = Number(v.replace(/[\s  ]/g, "").replace(",", "."));
    if (!Number.isFinite(n)) throw new Error(`Valeur numérique invalide : « ${raw} »`);
    return n;
  }
  if (field === "open") {
    if (v === "true") return true;
    if (v === "false") return false;
    throw new Error(`Valeur booléenne invalide : « ${raw} »`);
  }
  if (field === "start_date" || field === "end_date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(`${v}T00:00:00`).getTime())) {
      throw new Error(`Date invalide : « ${raw} » (format attendu AAAA-MM-JJ)`);
    }
    return v;
  }
  return v || null;
}

/* ---------- onglet Suggestions ---------- */

function SuggestionsTab({ onChanged }) {
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("race_update_suggestions")
      .select("*, race:races(id, name), source:race_sources(url)")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) setError(error.message);
    else setSuggestions(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map();
    (suggestions || []).forEach((s) => {
      if (!map.has(s.race_id)) map.set(s.race_id, { race: s.race, items: [] });
      map.get(s.race_id).items.push(s);
    });
    return [...map.values()].sort((a, b) => (a.race?.name || "").localeCompare(b.race?.name || ""));
  }, [suggestions]);

  const markReviewed = (id, status) =>
    supabase
      .from("race_update_suggestions")
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq("id", id);

  // Renvoie un message d'erreur, ou null si tout s'est bien passé.
  const accept = async (s) => {
    let value;
    try {
      value = convertValue(s.field, s.new_value);
    } catch (e) {
      return `${s.race?.name} · ${FIELD_LABEL[s.field] || s.field} : ${e.message}`;
    }
    const { error: updateError } = await supabase
      .from("races")
      .update({ [s.field]: value })
      .eq("id", s.race_id);
    if (updateError) return `${s.race?.name} · ${FIELD_LABEL[s.field] || s.field} : ${updateError.message}`;

    const { error: markError } = await markReviewed(s.id, "accepted");
    if (markError) {
      return `${s.race?.name} : l'ultra a été mis à jour, mais la suggestion n'a pas pu être marquée comme validée (${markError.message})`;
    }
    return null;
  };

  const ignore = async (s) => {
    const { error } = await markReviewed(s.id, "ignored");
    return error ? `${s.race?.name} · ${FIELD_LABEL[s.field] || s.field} : ${error.message}` : null;
  };

  const run = async (key, list, action) => {
    setBusy((b) => ({ ...b, [key]: true }));
    setError(null);
    const errors = [];
    for (const s of list) {
      const err = await action(s);
      if (err) errors.push(err);
    }
    if (errors.length) setError(errors.join("\n"));
    setBusy((b) => ({ ...b, [key]: false }));
    await load();
    onChanged();
  };

  if (suggestions === null && !error) return <p className="muted">Chargement…</p>;

  return (
    <div>
      {error && <div className="error-box" style={{ whiteSpace: "pre-line" }}>{error}</div>}
      {suggestions && groups.length === 0 && (
        <p className="muted">Aucune suggestion en attente.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map((g) => {
          const groupKey = `race-${g.race?.id}`;
          return (
            <div key={groupKey} className="panel">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
                <Link to={`/courses/${g.race?.id}`} className="h2" style={{ margin: 0 }} target="_blank">
                  {g.race?.name || "Ultra inconnu"} ↗
                </Link>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" disabled={busy[groupKey]} onClick={() => run(groupKey, g.items, accept)}>
                    Tout valider
                  </button>
                  <button className="btn" disabled={busy[groupKey]} onClick={() => run(groupKey, g.items, ignore)}>
                    Tout ignorer
                  </button>
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Champ</th>
                      <th>Actuel</th>
                      <th>Proposé</th>
                      <th>Confiance</th>
                      <th>Extrait source</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((s) => {
                      const conf = CONFIDENCE[s.confidence] || CONFIDENCE.low;
                      const disabled = busy[groupKey] || busy[s.id];
                      return (
                        <tr key={s.id}>
                          <td style={{ whiteSpace: "nowrap" }}>{FIELD_LABEL[s.field] || s.field}</td>
                          <td className="mono" style={{ fontSize: 12 }}>{displayValue(s.field, s.old_value)}</td>
                          <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{displayValue(s.field, s.new_value)}</td>
                          <td><Pill label={conf.label} bg={conf.bg} /></td>
                          <td style={{ fontSize: 12, maxWidth: 340 }}>
                            {s.evidence && <em>« {s.evidence} »</em>}
                            {s.source?.url && (
                              <>
                                {" "}
                                <a href={s.source.url} target="_blank" rel="noopener noreferrer">source ↗</a>
                              </>
                            )}
                          </td>
                          <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                            <button className="btn btn-primary" disabled={disabled} onClick={() => run(s.id, [s], accept)}>
                              Valider
                            </button>{" "}
                            <button className="btn" disabled={disabled} onClick={() => run(s.id, [s], ignore)}>
                              Ignorer
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- onglet Sources ---------- */

async function invokeError(error) {
  // FunctionsHttpError : le corps de la réponse contient le vrai message.
  try {
    const body = await error.context?.json();
    if (body?.error) return body.error;
  } catch {
    // corps illisible : on garde le message générique
  }
  return error.message;
}

function SourcesTab({ onChanged }) {
  const [sources, setSources] = useState(null);
  const [organizers, setOrganizers] = useState([]);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState([]);
  const [newSource, setNewSource] = useState({ organizer_id: "", url: "" });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);

  const load = useCallback(async () => {
    const [srcRes, orgRes] = await Promise.all([
      supabase
        .from("race_sources")
        .select("*, organizer:organizers(id, name)")
        .order("created_at", { ascending: true }),
      supabase.from("organizers").select("id, name, website").order("name", { ascending: true }),
    ]);
    if (srcRes.error) setError(srcRes.error.message);
    else setSources(srcRes.data);
    if (orgRes.error) setError(orgRes.error.message);
    else setOrganizers(orgRes.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(
    () => [...(sources || [])].sort((a, b) =>
      (a.organizer?.name || "").localeCompare(b.organizer?.name || "") || a.url.localeCompare(b.url)
    ),
    [sources]
  );

  const initFromOrganizers = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const withSource = new Set((sources || []).map((s) => s.organizer_id));
    const rows = organizers
      .filter((o) => o.website?.trim() && !withSource.has(o.id))
      .map((o) => ({ organizer_id: o.id, url: normalizeUrl(o.website.trim()), active: true }));

    if (rows.length === 0) {
      setInfo("Aucune source à créer : chaque organisateur avec un site web a déjà sa source.");
      setBusy(false);
      return;
    }
    const { data, error } = await supabase
      .from("race_sources")
      .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
      .select("id");
    if (error) setError(error.message);
    else setInfo(`${data.length} source${data.length !== 1 ? "s" : ""} créée${data.length !== 1 ? "s" : ""}.`);
    setBusy(false);
    load();
  };

  const addSource = async (e) => {
    e.preventDefault();
    if (!newSource.organizer_id || !newSource.url.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("race_sources")
      .insert({ organizer_id: newSource.organizer_id, url: normalizeUrl(newSource.url.trim()), active: true });
    setBusy(false);
    if (error) setError(error.message);
    else {
      setNewSource({ organizer_id: "", url: "" });
      load();
    }
  };

  const updateSource = async (id, fields) => {
    setError(null);
    const { error } = await supabase.from("race_sources").update(fields).eq("id", id);
    if (error) setError(error.message);
    else load();
    return !error;
  };

  const saveEdit = async () => {
    if (!editing?.url.trim()) return;
    if (await updateSource(editing.id, { url: normalizeUrl(editing.url.trim()) })) setEditing(null);
  };

  const remove = async (source) => {
    if (!window.confirm(`Supprimer la source ${source.url} ?`)) return;
    setError(null);
    const { error } = await supabase.from("race_sources").delete().eq("id", source.id);
    if (error) setError(error.message);
    else {
      setSelected((sel) => sel.filter((id) => id !== source.id));
      load();
    }
  };

  const toggleSelected = (id) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  const checkNow = async () => {
    if (selected.length === 0) return;
    setChecking(true);
    setError(null);
    setCheckResult(null);
    const { data, error } = await supabase.functions.invoke("check-race-updates", {
      body: { source_ids: selected.slice(0, MAX_CHECK) },
    });
    if (error) setError(`Vérification impossible : ${await invokeError(error)}`);
    else setCheckResult(data);
    setChecking(false);
    setSelected([]);
    load();
    onChanged();
  };

  if (sources === null && !error) return <p className="muted">Chargement…</p>;

  return (
    <div>
      {error && <div className="error-box">{error}</div>}
      {info && <div className="success-box">{info}</div>}

      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn" onClick={initFromOrganizers} disabled={busy}>
            Initialiser depuis les sites des organisateurs
          </button>
          <button className="btn btn-primary" onClick={checkNow} disabled={checking || selected.length === 0}>
            {checking ? "Vérification en cours…" : `Vérifier maintenant (${selected.length}/${MAX_CHECK})`}
          </button>
          {checking && <span className="muted">Jusqu'à une minute par source…</span>}
        </div>

        <form onSubmit={addSource} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 14 }}>
          <div className="field" style={{ margin: 0, minWidth: 200 }}>
            <label>Organisateur</label>
            <select
              value={newSource.organizer_id}
              onChange={(e) => setNewSource((s) => ({ ...s, organizer_id: e.target.value }))}
              required
            >
              <option value="">— Choisir —</option>
              {organizers.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
            <label>URL de la page à surveiller</label>
            <input
              value={newSource.url}
              onChange={(e) => setNewSource((s) => ({ ...s, url: e.target.value }))}
              placeholder="https://…"
              required
            />
          </div>
          <button type="submit" className="btn" disabled={busy}>Ajouter</button>
        </form>
      </div>

      {checkResult && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="mono" style={{ fontSize: 12, marginBottom: 8 }}>
            {checkResult.sources_checked} source{checkResult.sources_checked !== 1 ? "s" : ""} vérifiée
            {checkResult.sources_checked !== 1 ? "s" : ""} · {checkResult.suggestions_created} suggestion
            {checkResult.suggestions_created !== 1 ? "s" : ""} · {checkResult.errors} erreur
            {checkResult.errors !== 1 ? "s" : ""} · {checkResult.input_tokens} tokens en entrée,{" "}
            {checkResult.output_tokens} en sortie
          </div>
          {(checkResult.details || []).map((d) => {
            const st = SOURCE_STATUS[d.status] || SOURCE_STATUS.error;
            return (
              <div key={d.url} style={{ fontSize: 12, marginBottom: 6 }}>
                <Pill label={st.label} bg={st.bg} /> <span className="mono">{d.url}</span>
                {d.suggestions > 0 && <> · {d.suggestions} suggestion{d.suggestions !== 1 ? "s" : ""}</>}
                {d.error && <div style={{ color: "var(--brick)", marginTop: 2, wordBreak: "break-word" }}>{d.error}</div>}
              </div>
            );
          })}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="muted">Aucune source. Initialise-les depuis les sites des organisateurs ou ajoute-en une.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th></th>
                <th>Organisateur</th>
                <th>URL</th>
                <th>Actif</th>
                <th>Dernier contrôle</th>
                <th>Statut</th>
                <th>Dernière erreur</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const st = s.last_status ? SOURCE_STATUS[s.last_status] : null;
                const isSelected = selected.includes(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!isSelected && selected.length >= MAX_CHECK}
                        onChange={() => toggleSelected(s.id)}
                        aria-label="Sélectionner pour vérification"
                      />
                    </td>
                    <td>{s.organizer?.name || <span className="muted">—</span>}</td>
                    <td style={{ fontSize: 12, wordBreak: "break-all", minWidth: 200 }}>
                      {editing?.id === s.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            value={editing.url}
                            onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                            style={{ flex: 1, fontSize: 12, padding: "4px 6px" }}
                          />
                          <button className="btn" onClick={saveEdit}>OK</button>
                          <button className="btn" onClick={() => setEditing(null)}>✕</button>
                        </div>
                      ) : (
                        <a href={s.url} target="_blank" rel="noopener noreferrer">{s.url}</a>
                      )}
                    </td>
                    <td>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={!!s.active}
                          onChange={(e) => updateSource(s.id, { active: e.target.checked })}
                        />
                        {s.active ? "Oui" : "Non"}
                      </label>
                    </td>
                    <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDateTime(s.last_checked_at)}</td>
                    <td>{st ? <Pill label={st.label} bg={st.bg} /> : <span className="muted">—</span>}</td>
                    <td style={{ fontSize: 12, maxWidth: 240 }}>
                      {s.last_error ? (
                        <span title={s.last_error} style={{ color: "var(--brick)" }}>
                          {s.last_error.length > 80 ? `${s.last_error.slice(0, 80)}…` : s.last_error}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      <button className="btn" onClick={() => setEditing({ id: s.id, url: s.url })}>Modifier</button>{" "}
                      <button className="btn btn-danger" onClick={() => remove(s)}>Supprimer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- onglet Historique ---------- */

function HistoryTab() {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("race_check_runs")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRuns(data);
      });
  }, []);

  if (error) return <div className="error-box">{error}</div>;
  if (runs === null) return <p className="muted">Chargement…</p>;
  if (runs.length === 0) return <p className="muted">Aucune vérification pour l'instant.</p>;

  const cost = (r) => (r.input_tokens || 0) * INPUT_PRICE + (r.output_tokens || 0) * OUTPUT_PRICE;
  const total = runs.reduce((n, r) => n + cost(r), 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Déclenchement</th>
            <th>Sources</th>
            <th>Suggestions</th>
            <th>Erreurs</th>
            <th>Tokens (entrée / sortie)</th>
            <th>Coût estimé</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDateTime(r.run_at)}</td>
              <td>{r.trigger === "cron" ? "Automatique" : r.trigger === "manual" ? "Manuel" : r.trigger}</td>
              <td className="mono">{r.sources_checked}</td>
              <td className="mono">{r.suggestions_created}</td>
              <td className="mono">{typeof r.errors === "object" && r.errors !== null ? JSON.stringify(r.errors) : r.errors}</td>
              <td className="mono" style={{ fontSize: 12 }}>
                {(r.input_tokens || 0).toLocaleString("fr-FR")} / {(r.output_tokens || 0).toLocaleString("fr-FR")}
              </td>
              <td className="mono">{cost(r).toFixed(4)} $</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted mono" style={{ fontSize: 12, marginTop: 8 }}>
        Total des {runs.length} dernières vérifications : {total.toFixed(4)} $
      </p>
    </div>
  );
}

/* ---------- page ---------- */

export default function RaceUpdates() {
  const [tab, setTab] = useState("suggestions");
  const [pending, setPending] = useState(null);

  const loadPending = useCallback(async () => {
    const { count } = await supabase
      .from("race_update_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    setPending(count ?? 0);
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  return (
    <div>
      <h1 className="h1">Mises à jour des ultras</h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Chaque semaine, les pages des organisateurs sont relues automatiquement. Les écarts détectés
        apparaissent ici : aucun ultra n'est modifié sans validation.
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`btn${tab === t.key ? " btn-primary" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {t.key === "suggestions" && pending > 0 && <span className="admin-badge">{pending}</span>}
          </button>
        ))}
      </div>

      {tab === "suggestions" && <SuggestionsTab onChanged={loadPending} />}
      {tab === "sources" && <SourcesTab onChanged={loadPending} />}
      {tab === "history" && <HistoryTab />}
    </div>
  );
}
