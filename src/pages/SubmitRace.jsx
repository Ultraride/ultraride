import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

const EMPTY = { name: "", email: "", race_name: "", website: "", message: "" };

export default function SubmitRace() {
  const [form, setForm] = useState(EMPTY);
  const [honeypot, setHoneypot] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const field = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Un bot remplit ce champ invisible pour un humain : on fait semblant
    // d'accepter sans rien enregistrer, pour ne pas révéler le piège.
    if (honeypot.trim()) {
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

    if (error) setError(error.message);
    else setSent(true);
  };

  if (sent) {
    return (
      <div className="wrap" style={{ paddingTop: 60, maxWidth: 480 }}>
        <h1 className="h1">Proposer une course</h1>
        <div className="success-box">
          Merci, votre proposition a été transmise, nous reviendrons vers vous rapidement.
        </div>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60, maxWidth: 480 }}>
      <h1 className="h1">Proposer une course</h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 20, fontSize: 14 }}>
        Vous organisez une course ou en connaissez une qui mériterait sa place dans le répertoire ?
        Décrivez-la ci-dessous, nous reviendrons vers vous.
      </p>

      <form onSubmit={handleSubmit} className="panel">
        {error && <div className="error-box">{error}</div>}

        <div className="field">
          <label>Votre nom</label>
          <input required value={form.name} onChange={(e) => field("name", e.target.value)} />
        </div>

        <div className="field">
          <label>Votre email</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => field("email", e.target.value)}
            placeholder="toi@exemple.fr"
          />
          <div className="field-hint">Pour que nous puissions vous recontacter.</div>
        </div>

        <div className="field">
          <label>Nom de la course</label>
          <input required value={form.race_name} onChange={(e) => field("race_name", e.target.value)} />
        </div>

        <div className="field">
          <label>Site web / lien de la course (optionnel)</label>
          <input value={form.website} onChange={(e) => field("website", e.target.value)} placeholder="https://…" />
        </div>

        <div className="field">
          <label>Informations complémentaires</label>
          <textarea
            required
            rows={5}
            value={form.message}
            onChange={(e) => field("message", e.target.value)}
            placeholder="Pays, date, distance approximative, discipline…"
          />
        </div>

        <div aria-hidden="true" style={{ display: "none" }}>
          <label htmlFor="website-hp">Ne pas remplir ce champ</label>
          <input
            id="website-hp"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Envoi…" : "Envoyer"}
        </button>
      </form>
    </div>
  );
}
