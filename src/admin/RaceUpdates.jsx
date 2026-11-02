import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { eur, tokens, usd } from "../lib/aiCost";
import { supabase } from "../lib/supabaseClient";
import { createNextEdition } from "../lib/editions";
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

// Édition passée + dates cochées dans le futur : c'est l'édition suivante qui
// est annoncée, pas une correction. Renvoie l'année de cette édition.
function newEditionYear(race, checked) {
  const today = new Date().toISOString().slice(0, 10);
  if (!race.start_date || race.start_date >= today) return null;
  const start = checked.find((s) => s.field === "start_date");
  if (start && String(start.new_value).slice(0, 10) > today) return String(start.new_value).slice(0, 4);
  const next = checked.find((s) => s.field === "next_edition");
  if (next && Number(next.new_value) > Number(race.start_date.slice(0, 4))) return String(next.new_value);
  return null;
}

function RaceCompareCard({ race, items, selection, onToggle, onSelectAll, onValidate, onIgnoreAll, busy, error, asUpdate, onAsUpdate }) {
  const checked = items.filter((s) => selection[s.id]);
  // « Tout cocher » prend une suggestion par champ : tout est coché quand
  // chaque champ proposé a sa suggestion retenue.
  const allChecked = new Set(checked.map((s) => s.field)).size === new Set(items.map((s) => s.field)).size;
  const editionYear = newEditionYear(race, checked);
  const possibleEdition = newEditionYear(race, items);
  const asEdition = editionYear && !asUpdate;
  const suggestedFields = new Set(items.map((s) => s.field));

  const after = { ...race };
  checked.forEach((s) => { after[s.field] = previewValue(s.field, s.new_value); });
  const checkedFields = new Set(checked.map((s) => s.field));

  const show = (v) => (v === null || v === undefined || v === "" ? "—" : v);

  return (
    <div className="panel ru-card">
      <div className="ru-card-head">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link to={`/courses/${race.id}`} className="h2" style={{ margin: 0 }} target="_blank">
            {race.name} ↗
          </Link>
          {possibleEdition && (
            <span className="ru-tag-edition" title="La fiche actuelle est passée : en cochant les dates, tu crées l'édition suivante.">
              Édition passée → {possibleEdition}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn" disabled={busy} onClick={onIgnoreAll}>Tout ignorer</button>
          <button className="btn" disabled={busy} onClick={() => onSelectAll(!allChecked)}>
            {allChecked ? "Tout décocher" : "Tout cocher"}
          </button>
          <button className="btn btn-primary" disabled={busy || checked.length === 0} onClick={onValidate}>
            {asEdition ? `Créer l'édition ${editionYear} (${checked.length})` : `Valider la sélection (${checked.length})`}
          </button>
        </div>
      </div>

      {error && <div className="error-box" style={{ whiteSpace: "pre-line" }}>{error}</div>}

      {editionYear && (
        <div className={`ru-edition${asEdition ? " ru-edition-on" : ""}`}>
          <label>
            <input type="radio" checked={!!asEdition} onChange={() => onAsUpdate(false)} disabled={busy} />
            <span>
              <b>Créer l'édition {editionYear}</b> : la fiche {race.start_date.slice(0, 4)} reste telle quelle dans
              l'historique, et une nouvelle fiche publiée reprend tout avec les valeurs cochées.
            </span>
          </label>
          <label>
            <input type="radio" checked={!asEdition} onChange={() => onAsUpdate(true)} disabled={busy} />
            <span>Corriger la fiche existante (ses dates {race.start_date.slice(0, 4)} étaient fausses)</span>
          </label>
        </div>
      )}

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
          <div className="ru-block-title">{asEdition ? `Édition ${editionYear} · nouvelle fiche` : "Après · si tu valides"}</div>
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

/* ---------- synthèse et validation par paquet ---------- */

const PACKETS = [
  { key: "editions", title: "Nouvelles éditions", desc: "Fiches passées dont l'édition suivante est annoncée : une nouvelle fiche publiée est créée, l'ancienne reste dans l'historique." },
  { key: "dates", title: "Dates et édition", desc: "Dates, mois ou année de prochaine édition d'ultras à venir." },
  { key: "signup", title: "Liens d'inscription", desc: "Page d'inscription trouvée sur le site de l'organisateur." },
  { key: "open", title: "Ouverture des inscriptions", desc: "Inscriptions ouvertes ou fermées." },
  { key: "size", title: "Distance et dénivelé", desc: "Kilomètres et D+ annoncés par l'organisateur." },
];
const FIELD_PACKET = {
  start_date: "dates", end_date: "dates", month: "dates", next_edition: "dates",
  registration_url: "signup", open: "open", km: "size", dplus: "size",
};
const RANK = { high: 0, medium: 1, low: 2 };

// Répartit les suggestions en paquets. Pour chaque fiche et chaque champ, on
// retient la suggestion la plus sûre (haute > moyenne) ; ses rivales sont
// ignorées avec elle. Les champs où seule une suggestion faible existe
// restent à revoir à la main.
function buildPackets(groups) {
  const packets = Object.fromEntries(PACKETS.map((p) => [p.key, []]));
  let manual = 0;
  groups.forEach(({ race, items }) => {
    const byField = new Map();
    items.forEach((s) => {
      if (!byField.has(s.field)) byField.set(s.field, []);
      byField.get(s.field).push(s);
    });
    const best = [];
    const rivals = new Map();
    byField.forEach((list, field) => {
      const sorted = [...list].sort((a, b) => RANK[a.confidence] - RANK[b.confidence]);
      if (sorted[0].confidence === "low") { manual += list.length; return; }
      best.push(sorted[0]);
      rivals.set(field, sorted.slice(1));
    });
    if (best.length === 0) return;
    const worst = (list) => list.reduce((w, s) => (RANK[s.confidence] > RANK[w] ? s.confidence : w), "high");

    const editionYear = newEditionYear(race, best);
    if (editionYear) {
      packets.editions.push({
        id: `${race.id}-ed`, race, editionYear, accepted: best,
        ignored: best.flatMap((s) => rivals.get(s.field)), confidence: worst(best),
      });
      return;
    }
    const byPacket = new Map();
    best.forEach((s) => {
      const key = FIELD_PACKET[s.field];
      if (!byPacket.has(key)) byPacket.set(key, []);
      byPacket.get(key).push(s);
    });
    byPacket.forEach((list, key) => {
      packets[key].push({
        id: `${race.id}-${key}`, race, accepted: list,
        ignored: list.flatMap((s) => rivals.get(s.field)), confidence: worst(list),
      });
    });
  });
  Object.values(packets).forEach((list) => list.sort((a, b) => RANK[a.confidence] - RANK[b.confidence] || a.race.name.localeCompare(b.race.name)));
  return { packets, manual };
}

function displayValue(field, v) {
  if (v === null || v === undefined || v === "") return "—";
  if (field === "open") return v === "true" || v === true ? "Ouvertes" : "Fermées";
  if (field === "start_date" || field === "end_date") return formatDateRange(v, null) || v;
  if (field === "registration_url") return shortUrl(v);
  if (field === "km") return `${formatThousands(v)} km`;
  if (field === "dplus") return `${formatThousands(v)} m`;
  return String(v);
}

function UpdatesSummary({ groups, onApply, bulk }) {
  const { packets, manual } = useMemo(() => buildPackets(groups), [groups]);
  const [open, setOpen] = useState(null);
  const [picked, setPicked] = useState({});
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  // Par défaut, seules les lignes de confiance haute sont cochées.
  const isPicked = (it) => (it.id in picked ? picked[it.id] : it.confidence === "high");
  const setMany = (list, pred) => setPicked((p) => ({ ...p, ...Object.fromEntries(list.map((it) => [it.id, pred(it)])) }));

  return (
    <section className="panel ru-summary">
      <div className="ru-summary-head">
        <h2 className="h2" style={{ margin: 0 }}>Synthèse</h2>
        <span className="muted">{total} suggestions sur {groups.length} ultras</span>
      </div>

      {bulk && (
        <div className="ru-bulk">
          Validation en cours : {bulk.done}/{bulk.total} · {bulk.current}
          <div className="sv-bar-track" style={{ marginTop: 6 }}>
            <div className="sv-bar-fill sv-fill-rust" style={{ width: `${(bulk.done / bulk.total) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="ru-packets">
        {PACKETS.map((p) => {
          const list = packets[p.key];
          if (list.length === 0) return null;
          const high = list.filter((it) => it.confidence === "high").length;
          const chosen = list.filter(isPicked);
          const changes = chosen.reduce((n, it) => n + it.accepted.length, 0);
          const isOpen = open === p.key;
          return (
            <div key={p.key} className={`ru-packet${isOpen ? " ru-packet-open" : ""}`}>
              <button type="button" className="ru-packet-head" onClick={() => setOpen(isOpen ? null : p.key)}>
                <span className="ru-packet-title">{p.title}</span>
                <span className="ru-packet-count mono">
                  {list.length} ultra{list.length > 1 ? "s" : ""} · {high} sûr{high > 1 ? "s" : ""}
                </span>
                <span className="ru-packet-chev" aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <div className="ru-packet-body">
                  <p className="muted" style={{ margin: "0 0 10px", fontSize: 13.5 }}>{p.desc}</p>
                  <div className="ru-packet-tools">
                    <button type="button" className="filter-reset" onClick={() => setMany(list, () => true)}>Tout cocher</button>
                    <button type="button" className="filter-reset" onClick={() => setMany(list, (it) => it.confidence === "high")}>Confiance haute seulement</button>
                    <button type="button" className="filter-reset" onClick={() => setMany(list, () => false)}>Tout décocher</button>
                  </div>
                  <ul className="ru-packet-list">
                    {list.map((it) => (
                      <li key={it.id}>
                        <label className="ru-packet-row">
                          <input
                            type="checkbox"
                            checked={isPicked(it)}
                            onChange={(e) => setPicked((pk) => ({ ...pk, [it.id]: e.target.checked }))}
                            disabled={!!bulk}
                          />
                          <span className="ru-packet-main">
                            <span className="ru-packet-race">
                              {it.race.name}
                              {it.editionYear && <span className="ru-tag-edition">→ édition {it.editionYear}</span>}
                            </span>
                            {it.accepted.map((s) => (
                              <span key={s.id} className="ru-packet-change" title={s.evidence ? `« ${s.evidence} »` : undefined}>
                                <Pill label={CONFIDENCE[s.confidence]?.label} bg={CONFIDENCE[s.confidence]?.bg} />{" "}
                                {FIELD_LABEL[s.field]} : <s>{displayValue(s.field, s.old_value)}</s> → <b>{displayValue(s.field, s.new_value)}</b>
                              </span>
                            ))}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!!bulk || chosen.length === 0}
                    onClick={() => {
                      if (window.confirm(`Appliquer ${changes} modification${changes > 1 ? "s" : ""} sur ${chosen.length} ultra${chosen.length > 1 ? "s" : ""} ?`)) {
                        onApply(chosen).then(() => setPicked({}));
                      }
                    }}
                  >
                    {p.key === "editions"
                      ? `Créer ${chosen.length} édition${chosen.length > 1 ? "s" : ""} (${changes} valeurs)`
                      : `Valider ${changes} modification${changes > 1 ? "s" : ""} sur ${chosen.length} ultra${chosen.length > 1 ? "s" : ""}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {manual > 0 && (
        <p className="muted" style={{ margin: "10px 0 0", fontSize: 13 }}>
          {manual} suggestion{manual > 1 ? "s" : ""} en confiance faible, hors paquets : à revoir fiche par fiche ci-dessous.
        </p>
      )}
    </section>
  );
}

function SuggestionsTab({ onChanged }) {
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState(null);
  const [cardErrors, setCardErrors] = useState({});
  const [busy, setBusy] = useState({});
  const [selection, setSelection] = useState({});
  // Par fiche : true = corriger la fiche plutôt que créer l'édition suivante.
  const [asUpdate, setAsUpdate] = useState({});
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

  // Applique des suggestions à une fiche : mise à jour, ou création de
  // l'édition suivante si `editionYear` est fourni. Les suggestions de
  // `accepted` passent en « accepted », celles de `ignored` en « ignored ».
  const applyToRace = async (race, accepted, ignored, editionYear) => {
    const payload = {};
    const conversionErrors = [];
    accepted.forEach((s) => {
      try {
        payload[s.field] = convertValue(s.field, s.new_value);
      } catch (e) {
        conversionErrors.push(`${FIELD_LABEL[s.field] || s.field} : ${e.message}`);
      }
    });
    if (conversionErrors.length) return { error: conversionErrors.join("\n") };

    let writeError = null;
    if (editionYear) {
      // Nouvelle édition publiée, à partir de la fiche complète ; l'ancienne
      // reste intacte et cède sa place d'édition courante (trigger is_current).
      const { data: full, error: readError } = await supabase.from("races").select("*").eq("id", race.id).single();
      writeError = readError;
      if (!readError) {
        if (!payload.next_edition) payload.next_edition = editionYear;
        ({ error: writeError } = await createNextEdition(full, payload, "published"));
      }
    } else {
      // Un seul update pour tous les champs : en cas d'échec, rien n'est
      // marqué et les suggestions restent en attente.
      ({ error: writeError } = await supabase.from("races").update(payload).eq("id", race.id));
    }
    if (writeError) return { error: writeError.message };

    const [acc, rej] = await Promise.all([
      markReviewed(accepted.map((s) => s.id), "accepted"),
      markReviewed(ignored.map((s) => s.id), "ignored"),
    ]);
    const markError = acc.error || rej.error;
    return markError ? { warning: `les suggestions n'ont pas pu être marquées : ${markError.message}` } : {};
  };

  const validate = async (group) => {
    const raceId = group.race.id;
    const accepted = group.items.filter((s) => selection[s.id]);
    const rejected = group.items.filter((s) => !selection[s.id]);
    setCardError(raceId, null);
    setBusy((b) => ({ ...b, [raceId]: true }));
    const editionYear = !asUpdate[raceId] && newEditionYear(group.race, accepted);
    const res = await applyToRace(group.race, accepted, rejected, editionYear);
    if (res.error) {
      setCardError(raceId, res.error);
      setBusy((b) => ({ ...b, [raceId]: false }));
      return;
    }
    if (res.warning) setError(`${group.race.name} a été mis à jour, mais ${res.warning}`);
    else flash(editionYear ? `${group.race.name} : édition ${editionYear} créée ✓` : `${group.race.name} mis à jour ✓`);
    await finish(raceId);
  };

  // Validation par paquet (synthèse) : fiche par fiche, sans toucher aux
  // autres suggestions de la fiche qui ne font pas partie du paquet.
  const [bulk, setBulk] = useState(null);
  const applyPacket = async (items) => {
    setError(null);
    const failures = [];
    let editions = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      setBulk({ done: i, total: items.length, current: it.race.name });
      const res = await applyToRace(it.race, it.accepted, it.ignored, it.editionYear || null);
      if (res.error) failures.push(`${it.race.name} : ${res.error}`);
      else if (it.editionYear) editions += 1;
    }
    setBulk(null);
    const ok = items.length - failures.length;
    flash(`${ok} fiche${ok > 1 ? "s" : ""} mise${ok > 1 ? "s" : ""} à jour${editions ? `, dont ${editions} nouvelle${editions > 1 ? "s" : ""} édition${editions > 1 ? "s" : ""}` : ""} ✓`);
    if (failures.length) setError(`Non appliqué :\n${failures.join("\n")}`);
    await load();
    onChanged();
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

      {groups.length > 0 && <UpdatesSummary groups={groups} onApply={applyPacket} bulk={bulk} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {groups.map((g) => (
          <RaceCompareCard
            key={g.race.id}
            race={g.race}
            items={g.items}
            selection={selection}
            onToggle={(s) => toggle(g, s)}
            onSelectAll={(on) => selectAll(g, on)}
            asUpdate={!!asUpdate[g.race.id]}
            onAsUpdate={(v) => setAsUpdate((m) => ({ ...m, [g.race.id]: v }))}
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
            {checkResult.errors !== 1 ? "s" : ""} · {tokens(checkResult.input_tokens)} tokens en entrée,{" "}
            {tokens(checkResult.output_tokens)} en sortie · <b>{eur(checkResult.cost_usd)}</b>
          </div>
          {(checkResult.details || []).map((d) => {
            const st = SOURCE_STATUS[d.status] || SOURCE_STATUS.error;
            return (
              <div key={d.url} style={{ fontSize: 12, marginBottom: 6 }}>
                <Pill label={st.label} bg={st.bg} /> <span className="mono">{d.url}</span>
                {d.suggestions > 0 && <> · {d.suggestions} suggestion{d.suggestions !== 1 ? "s" : ""}</>}
                {d.cost_usd > 0 && <span className="mono"> · {tokens(d.input_tokens)} / {tokens(d.output_tokens)} tokens · {eur(d.cost_usd)}</span>}
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

const TRIGGER_LABEL = { cron: "Automatique", manual: "Manuel", campagne: "Campagne qualité" };

function HistoryTab() {
  const [runs, setRuns] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState({});
  const [month, setMonth] = useState(null);

  useEffect(() => {
    supabase
      .from("race_check_runs")
      .select("*")
      .order("run_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRuns(data);
      });
    // Total du mois en cours, sur tous les passages (pas seulement les 50 affichés).
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    supabase
      .from("race_check_runs")
      .select("cost_usd, input_tokens, output_tokens")
      .gte("run_at", start.toISOString())
      .then(({ data }) => {
        if (!data) return;
        setMonth({
          n: data.length,
          cost: data.reduce((t, r) => t + Number(r.cost_usd || 0), 0),
          inp: data.reduce((t, r) => t + (r.input_tokens || 0), 0),
          out: data.reduce((t, r) => t + (r.output_tokens || 0), 0),
        });
      });
  }, []);

  if (error) return <div className="error-box">{error}</div>;
  if (runs === null) return <p className="muted">Chargement…</p>;
  if (runs.length === 0) return <p className="muted">Aucune vérification pour l'instant.</p>;

  const total = runs.reduce((n, r) => n + Number(r.cost_usd || 0), 0);
  const monthName = new Date().toLocaleDateString("fr-FR", { month: "long" });

  return (
    <div>
      {month && (
        <div className="ru-cost-summary">
          <div><span className="ru-cost-big">{eur(month.cost)}</span><span className="muted"> en {monthName}</span></div>
          <div className="muted mono" style={{ fontSize: 12 }}>
            {month.n} vérifications · {tokens(month.inp)} tokens en entrée · {tokens(month.out)} en sortie · {usd(month.cost)}
          </div>
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Déclenchement</th>
              <th>Sites</th>
              <th>Suggestions</th>
              <th>Erreurs</th>
              <th>Tokens entrée / sortie</th>
              <th>Coût</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => {
              const hasDetails = Array.isArray(r.details) && r.details.length > 0;
              const cacheInfo = r.cache_read_tokens || r.cache_write_tokens
                ? `dont ${tokens(r.cache_read_tokens)} lus en cache et ${tokens(r.cache_write_tokens)} mis en cache`
                : undefined;
              return (
                <Fragment key={r.id}>
                  <tr
                    className={hasDetails ? "ru-run-row" : undefined}
                    onClick={hasDetails ? () => setOpen((o) => ({ ...o, [r.id]: !o[r.id] })) : undefined}
                  >
                    <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {hasDetails && <span className="ru-caret">{open[r.id] ? "▾" : "▸"}</span>}
                      {formatDateTime(r.run_at)}
                    </td>
                    <td>{TRIGGER_LABEL[r.trigger] || r.trigger}</td>
                    <td className="mono">{r.sources_checked}</td>
                    <td className="mono">{r.suggestions_created}</td>
                    <td className="mono">{typeof r.errors === "object" && r.errors !== null ? JSON.stringify(r.errors) : r.errors}</td>
                    <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }} title={cacheInfo}>
                      {tokens(r.input_tokens)} / {tokens(r.output_tokens)}
                    </td>
                    <td className="mono" style={{ whiteSpace: "nowrap" }} title={`${usd(r.cost_usd)}${r.cost_estimated ? " (estimé, détail du cache non enregistré)" : ""}`}>
                      {eur(r.cost_usd, { approx: r.cost_estimated })}
                    </td>
                  </tr>
                  {open[r.id] && r.details.map((d) => (
                    <tr key={`${r.id}-${d.url}`} className="ru-run-detail">
                      <td colSpan={2} className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>{shortUrl(d.url)}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{(SOURCE_STATUS[d.status] || SOURCE_STATUS.error).label}</td>
                      <td className="mono">{d.suggestions}</td>
                      <td style={{ fontSize: 12, color: "var(--brick)" }}>{d.error ? "oui" : ""}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{tokens(d.input_tokens)} / {tokens(d.output_tokens)}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{eur(d.cost_usd)}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted mono" style={{ fontSize: 12, marginTop: 8 }}>
        Total des {runs.length} dernières vérifications : {eur(total)} ({usd(total)}) · tarif Claude Haiku 5.5,
        1 € = 1,12 $. Touche une ligne pour le détail par site.
      </p>
    </div>
  );
}

/* ---------- panneau « Mise à jour par IA » ---------- */

const BATCH_SIZES = [10, 20, 30, 40, 50];
const BATCH_STATUS = {
  ok: { label: "Suggestions", bg: "#15793F", rank: 0 },
  unreadable: { label: "Illisible", bg: "#C4622D", rank: 1 },
  error: { label: "Erreur", bg: "#C4622D", rank: 1 },
  no_change: { label: "Aucun changement", bg: "#8A8A80", rank: 2 },
};

function domainOf(url) {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function plural(n, word) {
  return `${n} ${word}${n > 1 ? "s" : ""}`;
}

function AiBatchPanel({ onDone }) {
  const [batchSize, setBatchSize] = useState(10);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastRun, setLastRun] = useState(undefined);
  const [counts, setCounts] = useState({ active: null, stale: null });
  const cancelled = useRef(false);

  const loadStatus = useCallback(async () => {
    const { data } = await supabase
      .from("race_check_runs")
      .select("run_at, trigger, sources_checked, suggestions_created, errors, cost_usd")
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setLastRun(data || null);

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [a, b] = await Promise.all([
      supabase.from("race_sources").select("id", { count: "exact", head: true }).eq("active", true),
      supabase
        .from("race_sources")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .or(`last_checked_at.is.null,last_checked_at.lt.${since}`),
    ]);
    setCounts({ active: a.error ? null : a.count, stale: b.error ? null : b.count });
  }, []);

  useEffect(() => {
    cancelled.current = false;
    loadStatus();
    return () => { cancelled.current = true; };
  }, [loadStatus]);

  const run = async () => {
    const total = Number(batchSize);
    const agg = { sources_checked: 0, suggestions_created: 0, errors: 0, cost_usd: 0, details: [], remaining: null };
    let done = 0;
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total, remaining: null });

    while (done < total) {
      if (cancelled.current) break;
      const limit = Math.min(10, total - done);
      const { data, error } = await supabase.functions.invoke("check-race-updates", {
        body: { limit, min_age_days: 0 },
      });
      if (cancelled.current) return;
      if (error || data?.error) {
        setError(error ? await invokeError(error) : data.error);
        break;
      }
      agg.sources_checked += data.sources_checked || 0;
      agg.suggestions_created += data.suggestions_created || 0;
      agg.errors += data.errors || 0;
      agg.cost_usd += Number(data.cost_usd || 0);
      agg.details.push(...(data.details || []));
      agg.remaining = data.remaining;
      done += data.sources_checked || 0;
      setProgress({ done, total, remaining: data.remaining });
      setResult({ ...agg, details: [...agg.details] });
      if (!data.sources_checked || data.remaining === 0) break;
    }

    if (cancelled.current) return;
    setResult({ ...agg, details: [...agg.details] });
    setRunning(false);
    loadStatus();
    onDone?.();
  };

  const sortedDetails = useMemo(
    () =>
      [...(result?.details || [])].sort(
        (a, b) => (BATCH_STATUS[a.status]?.rank ?? 1) - (BATCH_STATUS[b.status]?.rank ?? 1),
      ),
    [result],
  );

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
        <h2 className="h2" style={{ margin: 0 }}>Mise à jour par IA</h2>
        <div className="muted mono" style={{ fontSize: 12 }}>
          {counts.active ?? "—"} sites actifs · {counts.stale ?? "—"} non vérifiés depuis plus de 30 jours
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginTop: 12 }}>
        <div className="field" style={{ margin: 0, minWidth: 160 }}>
          <label htmlFor="ai-batch-size">Fiches à vérifier</label>
          <select
            id="ai-batch-size"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            disabled={running}
          >
            {BATCH_SIZES.map((n) => (
              <option key={n} value={n}>{n} sites</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={run} disabled={running}>
          {running && progress ? `Vérification… ${progress.done} / ${progress.total}` : "Lancer une MAJ par IA"}
        </button>
      </div>
      <div className="field-hint">
        Les sites les plus anciens sont vérifiés en premier (ceux de plus d'un mois d'abord). Un site vérifié ici ne
        sera pas repris lors du passage automatique du lundi.
      </div>

      {running && progress && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 6, background: "rgba(27,43,32,.12)", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${Math.max(pct, 4)}%`, height: "100%", background: "#C4622D", transition: "width .4s" }} />
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            Lot en cours… compter 30 s à 2 min par lot de 10 sites.
          </div>
        </div>
      )}

      <div className="muted" style={{ fontSize: 13, marginTop: 12 }}>
        Dernier passage :{" "}
        {lastRun === undefined
          ? "…"
          : lastRun
            ? `${new Date(lastRun.run_at).toLocaleString("fr-FR", {
                dateStyle: "long",
                timeStyle: "short",
                timeZone: "Europe/Paris",
              })} (${TRIGGER_LABEL[lastRun.trigger] || lastRun.trigger}) — ${plural(lastRun.sources_checked, "site")}, ${plural(lastRun.suggestions_created, "suggestion")}`
            : "aucun"}
      </div>

      {error && <div className="error-box" style={{ marginTop: 12 }}>{error}</div>}

      {result && !running && (
        <div style={{ marginTop: 12 }}>
          <div className="mono" style={{ fontSize: 13 }}>
            {result.sources_checked} site{result.sources_checked > 1 ? "s" : ""} vérifié{result.sources_checked > 1 ? "s" : ""} ·{" "}
            {result.suggestions_created} suggestion(s) créée(s) · {result.errors} erreur(s) · coût ≈ $
            {result.cost_usd.toFixed(4)} ({eur(result.cost_usd)})
          </div>
          {result.remaining === 0 && (
            <div style={{ fontSize: 13, marginTop: 4 }}>Tous les sites actifs ont été vérifiés.</div>
          )}
          {result.suggestions_created > 0 && (
            <div style={{ fontSize: 13, marginTop: 4 }}>Les nouvelles suggestions sont dans l'onglet Suggestions ci-dessous.</div>
          )}
        </div>
      )}

      {sortedDetails.length > 0 && (
        <div style={{ marginTop: 12, borderTop: "1px solid rgba(27,43,32,.12)", paddingTop: 10 }}>
          {sortedDetails.map((d, i) => {
            const st = BATCH_STATUS[d.status] || BATCH_STATUS.error;
            return (
              <div key={`${d.url}-${i}`} style={{ fontSize: 12, marginBottom: 6 }}>
                <Pill label={st.label} bg={st.bg} /> <span className="mono" title={d.url}>{domainOf(d.url)}</span>
                {d.suggestions > 0 && <> · {plural(d.suggestions, "suggestion")}</>}
                {d.error && (
                  <div style={{ color: "#C4622D", fontSize: 11, marginTop: 2, wordBreak: "break-word" }}>{d.error}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- page ---------- */

export default function RaceUpdates() {
  const [tab, setTab] = useState("suggestions");
  const [pending, setPending] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

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

      <AiBatchPanel
        onDone={() => {
          loadPending();
          setRefreshKey((k) => k + 1);
          setTab("suggestions");
        }}
      />

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

      {tab === "suggestions" && <SuggestionsTab key={`s${refreshKey}`} onChanged={loadPending} />}
      {tab === "sources" && <SourcesTab key={`o${refreshKey}`} onChanged={loadPending} />}
      {tab === "history" && <HistoryTab key={`h${refreshKey}`} />}
    </div>
  );
}
