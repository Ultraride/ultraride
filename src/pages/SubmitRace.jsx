import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const EMPTY = { name: "", email: "", race_name: "", website: "", message: "" };
const MESSAGE_MAX = 3000;
// En dessous, personne n'a pu lire et remplir le formulaire : c'est un robot.
const MIN_FILL_MS = 3000;

const PERKS = [
  ["Validation sous 48 h", "On vérifie les infos et on publie la fiche, ou on revient vers toi si un détail manque."],
  ["Gratuit, pour tous", "Le référencement sur UltraRide ne coûte rien, ni aux organisateurs ni aux participants."],
  ["Tu organises ?", "Crée un compte organisateur pour gérer toi-même tes fiches : dates, photos, inscriptions."],
];

function Check() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function Aside() {
  return (
    <section className="auth-aside">
      <svg className="auth-contours" viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
        {[760, 700, 640, 580].map((y) => (
          <path key={y} d={`M-20 ${y} C 120 ${y - 60}, 220 ${y + 40}, 360 ${y - 30} S 560 ${y - 140}, 640 ${y - 100}`} />
        ))}
      </svg>
      <div className="auth-aside-head">
        <span className="auth-eyebrow">PROPOSER UN ULTRA</span>
        <h1 className="auth-title">UN ULTRA MANQUE ?<br />DIS-LE-NOUS.</h1>
      </div>
      <ul className="auth-perks">
        {PERKS.map(([title, text]) => (
          <li key={title}>
            <span className="auth-perk-ico"><Check /></span>
            <div>
              <div className="auth-perk-title">{title}</div>
              <div className="auth-perk-text">{text}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function SubmitRace() {
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({ ...EMPTY, email: user?.email || "" }));
  const [honeypot, setHoneypot] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const shownAt = useRef(Date.now());

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Un bot remplit ce champ invisible pour un humain, ou envoie le
    // formulaire trop vite : on fait semblant d'accepter sans rien
    // enregistrer, pour ne pas révéler le piège.
    if (honeypot.trim() || Date.now() - shownAt.current < MIN_FILL_MS) {
      setSent(true);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("race_submissions").insert({
      name: form.name.trim(),
      email: form.email.trim(),
      race_name: form.race_name.trim(),
      website: form.website.trim() || null,
      message: form.message.trim(),
    });
    setSaving(false);

    if (error) setError("L'envoi n'a pas abouti. Réessaie dans un instant.");
    else setSent(true);
  };

  return (
    <main className="v2-wrap auth-page">
      <div className="auth-shell">
        <Aside />

        <section className="auth-main">
          {sent ? (
            <div className="auth-forgot-head">
              <h2 className="auth-h2">Merci !</h2>
              <p>
                Ta proposition est bien arrivée. On la regarde sous 48 h et on revient vers toi
                {form.email ? <> à <strong>{form.email}</strong></> : null} si besoin.
              </p>
              <p style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link to="/ultras" className="v2-btn v2-btn-rust">Voir les ultras</Link>
                <button type="button" className="v2-btn" onClick={() => { setForm({ ...EMPTY, name: form.name, email: form.email }); setSent(false); shownAt.current = Date.now(); }}>
                  Proposer un autre ultra
                </button>
              </p>
            </div>
          ) : (
            <>
              <div className="auth-forgot-head">
                <h2 className="auth-h2">Proposer un ultra</h2>
                <p>Tu organises un ultra, ou tu en connais un qui mérite sa place dans le répertoire ? Décris-le ici.</p>
              </div>

              {error && <div className="error-box" role="alert">{error}</div>}

              <form onSubmit={handleSubmit} className="auth-form">
                <label className="auth-field">
                  <span className="auth-label">Nom de l'ultra <span className="auth-req">*</span></span>
                  <input className="auth-input" required maxLength={200} value={form.race_name} onChange={(e) => field("race_name", e.target.value)} placeholder="Ex. : Race Across France" />
                </label>

                <label className="auth-field">
                  <span className="auth-label">Site web ou lien <span className="auth-muted">(facultatif)</span></span>
                  <input className="auth-input" type="text" inputMode="url" maxLength={500} value={form.website} onChange={(e) => field("website", e.target.value)} placeholder="https://…" />
                </label>

                <label className="auth-field">
                  <span className="auth-label">Infos utiles <span className="auth-req">*</span></span>
                  <textarea
                    className="auth-input auth-textarea"
                    required
                    rows={5}
                    maxLength={MESSAGE_MAX}
                    value={form.message}
                    onChange={(e) => field("message", e.target.value)}
                    placeholder="Pays, date, distance, dénivelé, discipline (route, gravel, VTT)…"
                  />
                  <span className="auth-hint" style={{ textAlign: "right" }}>{form.message.length} / {MESSAGE_MAX}</span>
                </label>

                <div className="auth-row2">
                  <label className="auth-field">
                    <span className="auth-label">Ton nom <span className="auth-req">*</span></span>
                    <input className="auth-input" required maxLength={120} autoComplete="name" value={form.name} onChange={(e) => field("name", e.target.value)} />
                  </label>
                  <label className="auth-field">
                    <span className="auth-label">Ton email <span className="auth-req">*</span></span>
                    <input className="auth-input" type="email" required maxLength={254} autoComplete="email" value={form.email} onChange={(e) => field("email", e.target.value)} placeholder="toi@exemple.fr" />
                  </label>
                </div>
                <span className="auth-hint" style={{ marginTop: -12 }}>Ton email sert seulement à te recontacter au sujet de cet ultra.</span>

                {/* Hors écran plutôt que display:none, que certains robots savent ignorer. */}
                <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
                  <label htmlFor="website-hp">Ne pas remplir ce champ</label>
                  <input
                    id="website-hp"
                    name="website_url"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <button className="v2-btn v2-btn-rust auth-submit" type="submit" disabled={saving}>
                  {saving ? "Envoi…" : "Envoyer ma proposition"}
                </button>
              </form>

              {!user && (
                <p className="auth-foot">
                  Organisateur ? <Link to="/login?mode=signup" className="auth-textlink">Crée ton compte</Link> pour gérer tes fiches toi-même.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
