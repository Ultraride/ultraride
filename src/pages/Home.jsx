import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("races")
      .select("id, name, country, discipline, km, dplus, month, open, blurb")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRaces(data);
      });
  }, []);

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="mono" style={{ color: "var(--amber)", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 10 }}>
        Répertoire ultra-distance · France &amp; Europe
      </div>
      <h1 className="h1" style={{ fontSize: 38 }}>Trouve ta trace.</h1>

      {error && <div className="error-box">{error}</div>}
      {races === null ? (
        <p className="muted">Chargement…</p>
      ) : races.length === 0 ? (
        <p className="muted">Aucune course publiée pour l'instant.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginTop: 24 }}>
          {races.map((r) => (
            <Link key={r.id} to={`/courses/${r.id}`} className="card" style={{ display: "block" }}>
              <div className="mono muted" style={{ fontSize: 11, textTransform: "uppercase", marginBottom: 4 }}>
                {r.country} · {r.discipline}
              </div>
              <div className="h2">{r.name}</div>
              <p className="muted" style={{ fontSize: 13 }}>{r.blurb}</p>
              <div className="mono" style={{ fontSize: 13, marginTop: 8 }}>
                {r.km} km · {r.dplus?.toLocaleString("fr-FR")} D+ · {r.month}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
