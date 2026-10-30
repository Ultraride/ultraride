import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import ImageUploadField from "../components/ImageUploadField";
import OrganizerBox from "../components/OrganizerBox";

const EMPTY_FORM = { name: "", website: "", email: "", instagram: "", facebook: "", strava: "", logo_url: "", bio: "" };
const EDITABLE = Object.keys(EMPTY_FORM);
const BIO_MAX = 400;

// Ce qui compte pour une fiche « complète », dans l'ordre affiché.
const CHECKLIST = [
  { key: "name", label: "Nom" },
  { key: "logo_url", label: "Logo" },
  { key: "bio", label: "Résumé" },
  { key: "website", label: "Site web" },
  { key: "email", label: "Email" },
  { key: "social", label: "Un réseau social", test: (f) => f.instagram || f.facebook || f.strava },
];

function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function Field({ label, hint, prefix, children }) {
  return (
    <label className="op-field">
      <span className="op-label">{label}</span>
      {prefix ? <span className="op-prefixed"><span className="op-prefix">{prefix}</span>{children}</span> : children}
      {hint && <span className="op-hint">{hint}</span>}
    </label>
  );
}

export default function OrganizerProfile() {
  const { user, loading } = useAuth();
  const [organizerId, setOrganizerId] = useState(null);
  const [form, setForm] = useState(null);
  const [savedForm, setSavedForm] = useState(null);
  const [races, setRaces] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("organizers")
      .select("*")
      .eq("linked_profile_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const initial = data ? { ...EMPTY_FORM, ...pick(data) } : EMPTY_FORM;
        if (data) setOrganizerId(data.id);
        setForm(initial);
        setSavedForm(initial);
      });
    // Dépend de user.id (stable) et non de l'objet user : Supabase renouvelle
    // la session (nouvelle référence, même utilisateur) au retour sur l'onglet,
    // ce qui relancerait la lecture et effacerait les modifications en cours.
  }, [user?.id]);

  useEffect(() => {
    if (!organizerId) return;
    supabase
      .from("races")
      .select("id, status, is_current, start_date")
      .eq("organizer_id", organizerId)
      .then(({ data }) => setRaces(data || []));
  }, [organizerId]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const live = races.filter((r) => r.status === "published" && r.is_current);
    return {
      published: live.length,
      pending: races.filter((r) => r.status === "pending").length,
      toRenew: live.filter((r) => r.start_date && r.start_date < today).length,
    };
  }, [races]);

  const dirty = useMemo(
    () => !!form && !!savedForm && EDITABLE.some((k) => (form[k] || "") !== (savedForm[k] || "")),
    [form, savedForm],
  );

  // Prévenir avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  if (loading) return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!form) return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;

  const field = (key, value) => { setSaved(false); setForm((f) => ({ ...f, [key]: value })); };
  const done = CHECKLIST.filter((c) => (c.test ? c.test(form) : (form[c.key] || "").trim()));
  const pct = Math.round((done.length / CHECKLIST.length) * 100);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError("Le nom de l'organisation est obligatoire."); return; }
    setSaving(true);
    setError(null);
    setSaved(false);

    // Champs vides enregistrés à null : l'encadré « Organisé par » les masque.
    const payload = Object.fromEntries(
      EDITABLE.map((k) => [k, (form[k] || "").trim() || (k === "name" ? "" : null)]),
    );
    const result = organizerId
      ? await supabase.from("organizers").update(payload).eq("id", organizerId).select().single()
      : await supabase.from("organizers").insert({ ...payload, linked_profile_id: user.id }).select().single();

    setSaving(false);
    if (result.error) setError(result.error.message);
    else {
      const next = { ...EMPTY_FORM, ...pick(result.data) };
      setOrganizerId(result.data.id);
      setForm(next);
      setSavedForm(next);
      setSaved(true);
    }
  };

  return (
    <div className="wrap op-page">
      <section className="op-hero" aria-label="Organisation">
        <div className="op-hero-id">
          {form.logo_url
            ? <img src={form.logo_url} alt="" className="op-logo" />
            : <div className="op-logo op-logo-empty" aria-hidden="true">{initials(form.name)}</div>}
          <div className="op-hero-text">
            <span className="op-tag">FICHE ORGANISATEUR</span>
            <h1 className="op-name">{form.name || "Ton organisation"}</h1>
            <span className="op-sub">Affichée dans l'encadré « Organisé par » de tous tes ultras.</span>
          </div>
        </div>
        <div className="op-hero-right">
          <dl className="op-stats">
            <div><dt>Ultras en ligne</dt><dd>{stats.published}</dd></div>
            <div><dt>En validation</dt><dd>{stats.pending}</dd></div>
            <div><dt>À renouveler</dt><dd className={stats.toRenew ? "op-warn" : ""}>{stats.toRenew}</dd></div>
          </dl>
          <div className="op-hero-actions">
            <Link to="/organizer/races" className="op-hero-btn op-hero-btn-fill">Mes ultras</Link>
            {organizerId && <Link to={`/organizers/${organizerId}`} className="op-hero-btn">Voir ma page publique ↗</Link>}
          </div>
        </div>
      </section>

      <div className="op-layout">
        <form className="op-form" onSubmit={handleSubmit} noValidate>
          <section className="op-card">
            <h2 className="op-card-title">Identité</h2>
            <ImageUploadField label="Logo" value={form.logo_url} onChange={(v) => field("logo_url", v)} folder="organizers"
              hint="Carré de préférence, fond transparent ou uni." />
            <Field label="Nom de l'organisation *">
              <input required value={form.name} onChange={(e) => field("name", e.target.value)} placeholder="Collectif Baronnies Gravel" />
            </Field>
            <Field label="Résumé court" hint={`${(form.bio || "").length} / ${BIO_MAX} caractères · affiché en haut de ta page publique`}>
              <textarea rows={4} maxLength={BIO_MAX} value={form.bio || ""} onChange={(e) => field("bio", e.target.value)}
                placeholder="Qui vous êtes, l'esprit de vos épreuves, depuis quand vous organisez…" />
            </Field>
          </section>

          <section className="op-card">
            <h2 className="op-card-title">Contact</h2>
            <div className="op-two">
              <Field label="Site web">
                <input inputMode="url" value={form.website || ""} onChange={(e) => field("website", e.target.value)} placeholder="exemple.fr" />
              </Field>
              <Field label="Email de contact public" hint="Visible par tous : évite une adresse personnelle.">
                <input type="email" value={form.email || ""} onChange={(e) => field("email", e.target.value)} placeholder="contact@exemple.fr" />
              </Field>
            </div>
          </section>

          <section className="op-card">
            <h2 className="op-card-title">Réseaux</h2>
            <Field label="Instagram" prefix="instagram.com/">
              <input value={form.instagram || ""} onChange={(e) => field("instagram", e.target.value)} placeholder="@pseudo ou URL complète" />
            </Field>
            <Field label="Facebook" prefix="facebook.com/">
              <input value={form.facebook || ""} onChange={(e) => field("facebook", e.target.value)} placeholder="pseudo ou URL complète" />
            </Field>
            <Field label="Club Strava" prefix="strava.com/clubs/">
              <input value={form.strava || ""} onChange={(e) => field("strava", e.target.value)} placeholder="identifiant ou URL complète" />
            </Field>
          </section>

          <div className={`op-savebar${dirty ? " is-dirty" : ""}`}>
            <span className="op-savebar-msg" role="status">
              {error ? <span className="op-error">{error}</span>
                : saved ? "✓ Fiche enregistrée"
                : dirty ? "Modifications non enregistrées"
                : "Tout est enregistré"}
            </span>
            <button className="v2-btn v2-btn-rust" type="submit" disabled={saving || (!dirty && !!organizerId)}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>

        <aside className="op-aside">
          <section className="op-card">
            <div className="op-card-head">
              <h2 className="op-card-title">Fiche complète à {pct} %</h2>
            </div>
            <div className="op-meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
            <ul className="op-checklist">
              {CHECKLIST.map((c) => {
                const ok = done.includes(c);
                return <li key={c.key} className={ok ? "ok" : ""}><span aria-hidden="true">{ok ? "✓" : "○"}</span>{c.label}</li>;
              })}
            </ul>
          </section>
          <section className="op-preview">
            <span className="op-label">Aperçu sur une fiche ultra</span>
            <OrganizerBox race={{ organizer: { ...form, id: organizerId } }} />
          </section>
        </aside>
      </div>
    </div>
  );
}

function pick(obj) {
  const out = {};
  for (const k of EDITABLE) out[k] = obj?.[k] ?? "";
  return out;
}
