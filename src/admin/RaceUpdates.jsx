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
  high: { label: "Haute", bg: "#15793F" },
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

const RACE_FIELDS = "id, name, km, dplus, start_date, end_date, month, open, next_edition, registration_url";

function formatThousands(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// « 8 → 15 mai 2027 », « 28 mai → 3 juin 2027 », « 8 mai 2027 »…
function formatDateRange(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  const full = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  if (!s && !e) return null;
  if (!s || !e) return full(s || e);
  if (s.getTime() === e.getTime()) return full(s);
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) return `${s.getDate()} → ${full(e)}`;
    return `${s.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} → ${full(e)}`;
  }
  return `${full(s)} → ${full(e)}`;
}

function UrlValue({ url }) {
  const href = normalizeUrl(url);
  let host = url;
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    // URL illisible : on affiche la valeur brute.
  }
  return <a href={href} target="_blank" rel="noopener noreferrer">{host}</a>;
}

// Champs de la fiche, dans l'ordre d'affichage. `fields` : colonnes de races
// couvertes par la ligne (les dates regroupent début et fin).
const ROWS = [
  {
    key: "km", label: "Distance", fields: ["km"],
    render: (r) => (r.km === null || r.km === undefined || r.km === "" ? "Boucle infinie" : `${formatThousands(r.km)} km`),
  },
  {
    key: "dplus", label: "D+", fields: ["dplus"],
    render: (r) => (r.dplus === null || r.dplus === undefined || r.dplus === "" ? null : `${formatThousands(r.dplus)} m`),
  },
  { key: "dates", label: "Dates", fields: ["start_date", "end_date"], render: (r) => formatDateRange(r.start_date, r.end_date) },
  { key: "month", label: "Mois", fields: ["month"], render: (r) => r.month || null },
  {
    key: "open", label: "Inscriptions", fields: ["open"],
    render: (r) => (r.open === null || r.open === undefined ? null : r.open ? "Ouvertes" : "Fermées"),
  },
  { key: "next_edition", label: "Prochaine édition", fields: ["next_edition"], render: (r) => r.next_edition || null },
  {
    key: "registration_url", label: "Lien d'inscription", fields: ["registration_url"],
    render: (r) => (r.registration_url ? <UrlValue url={r.registration_url} /> : null),
  },
];

const SHORT_LABEL = { start_date: "début", end_date: "fin" };

// Pour l'aperçu, une valeur invalide est affichée telle quelle ; la
// validation, elle, la refusera avec un message clair.
function previewValue(field, raw) {
  try {
    return convertValue(field, raw);
  } catch {
    return raw;
  }
}

// Coche par défaut les confiances high/medium, une seule suggestion par champ.
function defaultSelection(items) {
  const sel = {};
  const taken = new Set();
  items.forEach((s) => {
    const eligible = s.confidence === "high" || s.confidence === "medium";
    sel[s.id] = eligible && !taken.has(s.field);
    if (sel[s.id]) taken.add(s.field);
  });
  return sel;
}

// « tortour.com/fr/race-info » : domaine et chemin, pour voir d'un coup
// d'œil d'où vient l'information.
function shortUrl(url) {
  try {
    const u = new URL(normalizeUrl(url));
    const path = u.pathname.replace(/\/+$/, "");
    const short = `${u.hostname.replace(/^www\./, "")}${path}`;
    return short.length > 70 ? `${short.slice(0, 69)}…` : short;
  } catch {
    return url;
  }
}

function SourceLink({ url }) {
  if (!url) return null;
  return (
    <>
      <a href={normalizeUrl(url)} target="_blank" rel="noopener noreferrer">source ↗</a>
      <span className="ru-source-path" title={url}>{shortUrl(url)}</span>
    </>
  );
}

function RaceCompareCard({ race, items, selection, onToggle, onSelectAll, onValidate, onIgnoreAll, busy, error }) {
  const checked = items.filter((s) => selection[s.id]);
  // « Tout cocher » prend une suggestion par champ : tout est coché quand
  // chaque champ proposé a sa suggestion retenue.
  const allChecked = new Set(checked.map((s) => s.field)).size === new Set(items.map((s) => s.field)).size;
  const suggestedFields = new Set(items.map((s) => s.field));

  const after = { ...race };
  checked.forEach((s) => { after[s.field] = previewValue(s.field, s.new_value); });
  const checkedFields = new Set(checked.map((s) => s.field));

  const show = (v) => (v === null || v === undefined || v === "" ? "—" : v);

  return (
    <div className="panel ru-card">
      <div className="ru-card-head">
        <Link to={`/courses/${race.id}`} className="h2" style={{ margin: 0 }} target="_blank">
          {race.name} ↗
        </Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" disabled={busy} onClick={onIgnoreAll}>Tout ignorer</button>
          <button className="btn" disabled={busy} onClick={() => onSelectAll(!allChecked)}>
            {allChecked ? "Tout décocher" : "Tout cocher"}
          </button>
          <button className="btn btn-primary" disabled={busy || checked.length === 0} onClick={onValidate}>
            Valider la sélection ({checked.length})
          </button>
        </div>
      </div>

      {error && <div className="error-box" style={{ whiteSpace: "pre-line" }}>{error}</div>}

      <div className="ru-compare">
        <div className="ru-block">
          <div className="ru-block-title">Avant · fiche actuelle</div>
          {ROWS.map((row) => {
            const touched = row.fields.some((f) => suggestedFields.has(f));
            return (
              <div key={row.key} className="ru-row">
                <span className="ru-label">{row.label}</span>
                <span className={`ru-value${touched ? " ru-old" : ""}`}>{show(row.render(race))}</span>
              </div>
            );
          })}
        </div>

        <div className="ru-arrow" aria-hidden="true">
          <span className="ru-arrow-side">→</span>
          <span className="ru-arrow-down">↓</span>
        </div>

        <div className="ru-block">
          <div className="ru-block-title">Après · si tu valides</div>
          {ROWS.map((row) => {
            const rowItems = items.filter((s) => row.fields.includes(s.field));
            const changed = row.fields.some((f) => checkedFields.has(f));
            return (
              <div key={row.key} className="ru-row">
                <span className="ru-label">
                  {rowItems.map((s) => (
                    <label key={s.id} className="ru-check" title={`Proposé : ${s.new_value}`}>
                      <input
                        type="checkbox"
                        checked={!!selection[s.id]}
                        onChange={() => onToggle(s)}
                        disabled={busy}
                      />
                      {(rowItems.length > 1 || row.fields.length > 1) && (
                        <span className="ru-check-hint">{SHORT_LABEL[s.field] || s.new_value}</span>
                      )}
                    </label>
                  ))}
                  {row.label}
                </span>
                <span className={`ru-value${changed ? " ru-new" : ""}`}>{show(row.render(changed ? after : race))}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ru-evidence">
        {items.map((s) => {
          const conf = CONFIDENCE[s.confidence] || CONFIDENCE.low;
          return (
            <div key={s.id} className="ru-evidence-line">
              <Pill label={conf.label} bg={conf.bg} />
              <span className="ru-evidence-field">{FIELD_LABEL[s.field] || s.field}</span>
              {s.evidence && <em>« {s.evidence} »</em>}
              <SourceLink url={s.source_url || s.source?.url} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SuggestionsTab({ onChanged }) {
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState(null);
  const [cardErrors, setCardErrors] = useState({});
  const [busy, setBusy] = useState({});
  const [selection, setSelection] = useState({});
  const [flashes, setFlashes] = useState([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("race_update_suggestions")
      .select(`*, race:races(${RACE_FIELDS}), source:race_sources(url)`)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) {
      setError(error.message);
      return;
    }
    setSuggestions(data);
    // Les choix déjà faits sont conservés ; seules les nouvelles suggestions
    // reçoivent la sélection par défaut.
    setSelection((prev) => {
      const fresh = data.filter((s) => !(s.id in prev));
      return { ...prev, ...defaultSelection(fresh) };
    });
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map();
    (suggestions || []).forEach((s) => {
      if (!s.race) return;
      if (!map.has(s.race_id)) map.set(s.race_id, { race: s.race, items: [] });
      map.get(s.race_id).items.push(s);
    });
    return [...map.values()].sort((a, b) => a.race.name.localeCompare(b.race.name));
  }, [suggestions]);

  // Une seule valeur par champ : cocher une suggestion décoche ses rivales.
  const toggle = (group, s) =>
    setSelection((prev) => {
      const next = { ...prev, [s.id]: !prev[s.id] };
      if (next[s.id]) {
        group.items.forEach((o) => {
          if (o.id !== s.id && o.field === s.field) next[o.id] = false;
        });
      }
      return next;
    });

  // Tout cocher : pour chaque champ, la suggestion la plus sûre (haute >
  // moyenne > faible), ou celle déjà cochée. Tout décocher : vide la carte.
  const CONFIDENCE_RANK = { high: 0, medium: 1, low: 2 };
  const selectAll = (group, on) =>
    setSelection((prev) => {
      const next = { ...prev };
      group.items.forEach((o) => { next[o.id] = false; });
      if (!on) return next;
      const best = new Map();
      group.items.forEach((o) => {
        const cur = best.get(o.field);
        const score = (x) => (prev[x.id] ? -1 : CONFIDENCE_RANK[x.confidence] ?? 3);
        if (!cur || score(o) < score(cur)) best.set(o.field, o);
      });
      best.forEach((o) => { next[o.id] = true; });
      return next;
    });

  const flash = (message) => {
    const id = `${Date.now()}-${Math.random()}`;
    setFlashes((f) => [...f, { id, message }]);
    setTimeout(() => setFlashes((f) => f.filter((x) => x.id !== id)), 4000);
  };

  const setCardError = (raceId, message) => setCardErrors((e) => ({ ...e, [raceId]: message }));

  const markReviewed = (ids, status) =>
    ids.length === 0
      ? Promise.resolve({ error: null })
      : supabase
          .from("race_update_suggestions")
          .update({ status, reviewed_at: new Date().toISOString() })
          .in("id", ids);

  const finish = async (raceId) => {
    setBusy((b) => ({ ...b, [raceId]: false }));
    await load();
    onChanged();
  };

  const validate = async (group) => {
    const raceId = group.race.id;
    const accepted = group.items.filter((s) => selection[s.id]);
    const rejected = group.items.filter((s) => !selection[s.id]);
    setCardError(raceId, null);

    const payload = {};
    const conversionErrors = [];
    accepted.forEach((s) => {
      try {
        payload[s.field] = convertValue(s.field, s.new_value);
      } catch (e) {
        conversionErrors.push(`${FIELD_LABEL[s.field] || s.field} : ${e.message}`);
      }
    });
    if (conversionErrors.length) {
      setCardError(raceId, conversionErrors.join("\n"));
      return;
    }

    setBusy((b) => ({ ...b, [raceId]: true }));
    // Un seul update pour tous les champs cochés : en cas d'échec, rien n'est
    // marqué et les suggestions restent en attente.
    const { error: updateError } = await supabase.from("races").update(payload).eq("id", raceId);
    if (updateError) {
      setCardError(raceId, updateError.message);
      setBusy((b) => ({ ...b, [raceId]: false }));
      return;
    }

    const [acc, rej] = await Promise.all([
      markReviewed(accepted.map((s) => s.id), "accepted"),
      markReviewed(rejected.map((s) => s.id), "ignored"),
    ]);
    const markError = acc.error || rej.error;
    if (markError) {
      setError(`${group.race.name} a été mis à jour, mais les suggestions n'ont pas pu être marquées : ${markError.message}`);
    } else {
      flash(`${group.race.name} mis à jour ✓`);
    }
    await finish(raceId);
  };

  const ignoreAll = async (group) => {
    const raceId = group.race.id;
    setCardError(raceId, null);
    setBusy((b) => ({ ...b, [raceId]: true }));
    const { error } = await markReviewed(group.items.map((s) => s.id), "ignored");
    if (error) {
      setCardError(raceId, error.message);
      setBusy((b) => ({ ...b, [raceId]: false }));
      return;
    }
    await finish(raceId);
  };

  if (suggestions === null && !error) return <p className="muted">Chargement…</p>;

  return (
    <div>
      {error && <div className="error-box" style={{ whiteSpace: "pre-line" }}>{error}</div>}
      {flashes.map((f) => (
        <div key={f.id} className="success-box">{f.message}</div>
      ))}
      {suggestions && groups.length === 0 && (
        <p className="muted">Aucune suggestion en attente.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map((g) => (
          <RaceCompareCard
            key={g.race.id}
            race={g.race}
            items={g.items}
            selection={selection}
            onToggle={(s) => toggle(g, s)}
            onSelectAll={(on) => selectAll(g, on)}
            onValidate={() => validate(g)}
            onIgnoreAll={() => ignoreAll(g)}
            busy={!!busy[g.race.id]}
            error={cardErrors[g.race.id]}
          />
        ))}
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
