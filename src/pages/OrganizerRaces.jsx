import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import RaceForm from "../admin/RaceForm";
import { createNextEdition } from "../lib/editions";
import { DateTile, DisciplineBadge, Countdown } from "../components/RaceBits";
import { daysUntil, formatShortDate, normalize, statsLine } from "../lib/raceDisplay";

const STATUS = {
  draft: { label: "Brouillon", cls: "mu-pill-draft" },
  pending: { label: "En validation", cls: "mu-pill-pending" },
  published: { label: "En ligne", cls: "mu-pill-live" },
  rejected: { label: "Refusé", cls: "mu-pill-rejected" },
};

// Une fiche publiée dont le départ est passé : l'organisateur doit créer
// l'édition suivante pour rester visible dans « à venir ».
const isToRenew = (r) => r.status === "published" && r.is_current !== false && daysUntil(r) !== null && daysUntil(r) < 0;
const isPastEdition = (r) => r.status === "published" && r.is_current === false;

// Ordre : ce qui demande une action d'abord, puis le reste par date de départ.
function rank(r) {
  if (r.status === "rejected") return 0;
  if (isToRenew(r)) return 1;
  if (r.status === "draft") return 2;
  if (r.status === "pending") return 3;
  return 4;
}

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "renew", label: "À renouveler", test: isToRenew },
  { key: "pending", label: "En validation", test: (r) => r.status === "pending" },
  { key: "rejected", label: "Refusés", test: (r) => r.status === "rejected" },
  { key: "draft", label: "Brouillons", test: (r) => r.status === "draft" },
];

function dateText(r) {
  if (r.start_date) {
    const a = formatShortDate(r.start_date);
    const b = r.end_date && r.end_date !== r.start_date ? formatShortDate(r.end_date) : null;
    return b ? `${a} → ${b}` : a;
  }
  return r.month ? `${r.month} · date à confirmer` : "Date à confirmer";
}

export default function OrganizerRaces() {
  const { user, loading, isOrganizer, isAdmin } = useAuth();
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // objet course, ou {} pour une création
  const [duplicating, setDuplicating] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // L'édition suivante reprend la fiche (parcours, textes, image) sans les
  // dates, et part en validation comme toute soumission.
  const newEdition = async (race) => {
    if (!window.confirm(`Créer l'édition suivante de « ${race.name} » ? Tu pourras ensuite saisir ses dates.`)) return;
    setDuplicating(race.id);
    setError(null);
    const { data, error } = await createNextEdition(race);
    setDuplicating(null);
    if (error) setError(error.message);
    else { load(); setEditing(data); }
  };

  // Deux chemins mènent à « mes ultras » : ceux que ce compte a soumis
  // (created_by), et ceux rattachés à sa fiche organisateur — typiquement
  // saisis par l'administrateur avant que l'organisateur ait un compte.
  // Seuls les premiers sont modifiables : la politique RLS d'écriture
  // repose sur created_by.
  const load = async () => {
    if (!user) return;

    const { data: org } = await supabase
      .from("organizers")
      .select("id")
      .eq("linked_profile_id", user.id)
      .maybeSingle();

    const filters = [`created_by.eq.${user.id}`];
    if (org?.id) filters.push(`organizer_id.eq.${org.id}`);

    const { data, error } = await supabase
      .from("races")
      .select("*")
      .or(filters.join(","))
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setRaces(data);
  };

  useEffect(() => { load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { active, past, counts } = useMemo(() => {
    const all = races || [];
    const act = all.filter((r) => !isPastEdition(r));
    const c = Object.fromEntries(FILTERS.map((f) => [f.key, f.test ? act.filter(f.test).length : act.length]));
    c.live = act.filter((r) => r.status === "published" && !isToRenew(r)).length;
    return { active: act, past: all.filter(isPastEdition), counts: c };
  }, [races]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    const q = normalize(query.trim());
    return active
      .filter((r) => !f?.test || f.test(r))
      .filter((r) => !q || normalize(r.name).includes(q))
      .sort((a, b) => rank(a) - rank(b) || String(a.start_date || "9999").localeCompare(String(b.start_date || "9999")));
  }, [active, filter, query]);

  if (loading) return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;
  if (!user) return <Navigate to="/login" replace />;

  if (!isOrganizer && !isAdmin) {
    return (
      <div className="wrap" style={{ paddingTop: 60, maxWidth: 480 }}>
        <h1 className="h1">Réservé aux organisateurs</h1>
        <p className="muted">
          Cet espace permet de soumettre des ultras au répertoire. Si tu organises un événement,
          contacte l'administrateur pour faire passer ton compte en organisateur.
        </p>
      </div>
    );
  }

  if (editing !== null) {
    return (
      <div className="wrap" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 780 }}>
        <button className="mu-back" onClick={() => setEditing(null)}>← Retour à mes ultras</button>
        <RaceForm
          race={editing.id ? editing : null}
          onSaved={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  const Row = ({ r }) => {
    const mine = r.created_by === user.id;
    const renew = isToRenew(r);
    const st = STATUS[r.status] || { label: r.status, cls: "" };
    const stats = statsLine(r);
    return (
      <article className={`mu-row${r.status === "rejected" ? " is-rejected" : ""}${renew ? " is-renew" : ""}`}>
        <DateTile race={r} size={60} />
        <div className="mu-main">
          <div className="mu-title">
            {r.status === "published"
              ? <Link to={`/courses/${r.id}`} className="mu-name">{r.name}</Link>
              : <span className="mu-name">{r.name}</span>}
            <span className={`mu-pill ${renew ? "mu-pill-renew" : st.cls}`}>{renew ? "Édition passée" : st.label}</span>
            {r.deletion_requested && <span className="mu-pill mu-pill-rejected">Suppression demandée</span>}
          </div>
          <div className="mu-meta">
            <DisciplineBadge discipline={r.discipline} />
            {r.country && <span>{r.country}</span>}
            {stats && <span>{stats}</span>}
            {r.edition && <span>Édition {r.edition}</span>}
          </div>
          <div className="mu-date">
            {dateText(r)} <Countdown race={r} />
          </div>
          {r.status === "rejected" && (
            <div className="mu-notice mu-notice-error">
              <strong>Motif du refus :</strong> {r.review_note || "aucun motif précisé — contacte l'administrateur."}
              <span> Corrige la fiche puis enregistre : elle repartira en validation.</span>
            </div>
          )}
          {renew && mine && (
            <div className="mu-notice">
              Le départ est passé : crée l'édition suivante pour que l'ultra reste dans les prochains départs.
            </div>
          )}
        </div>
        <div className="mu-actions">
          {mine ? (
            <>
              <button className="mu-btn" onClick={() => setEditing(r)}>Modifier</button>
              {r.status === "published" && <button
                className={`mu-btn${renew ? " mu-btn-rust" : ""}`}
                disabled={duplicating === r.id}
                onClick={() => newEdition(r)}
              >
                {duplicating === r.id ? "Création…" : "Nouvelle édition"}
              </button>}
            </>
          ) : (
            <span className="mu-managed">Gérée par l'administrateur</span>
          )}
        </div>
      </article>
    );
  };

  return (
    <div className="wrap mu-page">
      <header className="mu-head">
        <div>
          <span className="mu-eyebrow">ESPACE ORGANISATEUR</span>
          <h1 className="mu-h1">Mes ultras</h1>
        </div>
        <div className="mu-head-actions">
          <Link to="/organizer/profile" className="mu-btn">Fiche organisateur</Link>
          <button className="v2-btn v2-btn-rust" onClick={() => setEditing({})}>+ Soumettre un ultra</button>
        </div>
      </header>

      {races && races.length > 0 && (
        <div className="mu-kpis">
          <div><strong>{counts.live}</strong><span>En ligne</span></div>
          <div className={counts.renew ? "is-warn" : ""}><strong>{counts.renew}</strong><span>À renouveler</span></div>
          <div><strong>{counts.pending}</strong><span>En validation</span></div>
          <div className={counts.rejected ? "is-error" : ""}><strong>{counts.rejected}</strong><span>Refusés</span></div>
        </div>
      )}

      <div className="mu-help">
        <button type="button" className="mu-help-toggle" aria-expanded={showHelp} onClick={() => setShowHelp((v) => !v)}>
          ⓘ Comment fonctionne la validation ? <span aria-hidden="true">{showHelp ? "▴" : "▾"}</span>
        </button>
        {showHelp && (
          <p>
            Chaque ultra soumis est relu par un administrateur avant publication. Tu peux le corriger à tout
            moment : une modification, même sur un ultra déjà en ligne, le renvoie en validation et le retire
            temporairement du répertoire. Les épreuves saisies par l'administrateur avant la création de ton
            compte apparaissent en lecture seule ; demande-lui de t'en transférer la gestion pour les tenir à jour.
          </p>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {races === null ? (
        <p className="muted">Chargement…</p>
      ) : races.length === 0 ? (
        <div className="mu-empty">
          <strong>Tu n'as encore soumis aucun ultra.</strong>
          <span>Renseigne ta première épreuve : elle sera en ligne dès sa validation.</span>
          <button className="v2-btn v2-btn-rust" onClick={() => setEditing({})}>Soumettre mon premier ultra</button>
        </div>
      ) : (
        <>
          <div className="mu-toolbar">
            <div className="mu-filters" role="group" aria-label="Filtrer">
              {FILTERS.filter((f) => f.key === "all" || counts[f.key] > 0).map((f) => (
                <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                  {f.label} <span>{counts[f.key]}</span>
                </button>
              ))}
            </div>
            {active.length > 6 && (
              <input className="mu-search" type="search" placeholder="Rechercher un ultra…" value={query}
                onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher un ultra" />
            )}
          </div>

          <div className="mu-list">
            {visible.map((r) => <Row key={r.id} r={r} />)}
            {visible.length === 0 && <p className="muted">Aucun ultra ne correspond.</p>}
          </div>

          {past.length > 0 && (
            <section className="mu-past">
              <button type="button" className="mu-help-toggle" aria-expanded={showPast} onClick={() => setShowPast((v) => !v)}>
                Éditions passées ({past.length}) <span aria-hidden="true">{showPast ? "▴" : "▾"}</span>
              </button>
              {showPast && (
                <div className="mu-list">
                  {past
                    .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")))
                    .map((r) => (
                      <div key={r.id} className="mu-past-row">
                        <Link to={`/courses/${r.id}`}>{r.name}</Link>
                        <span>{r.edition ? `Édition ${r.edition} · ` : ""}{dateText(r)}</span>
                      </div>
                    ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
