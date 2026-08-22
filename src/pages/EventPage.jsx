import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import RaceCard from "../components/RaceCard";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export default function EventPage() {
  const { slug } = useParams();
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("races")
      .select("*, organizer:organizers!races_organizer_id_fkey(id, name, logo_url, website, bio)")
      .eq("event_slug", slug)
      .eq("status", "published")
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRaces((data || []).sort((a, b) => (a.km || 0) - (b.km || 0)));
      });
  }, [slug]);

  if (error) return <div className="wrap" style={{ paddingTop: 40 }}><div className="error-box">{error}</div></div>;
  if (races === null) return <div className="wrap" style={{ paddingTop: 40 }}><p className="muted">Chargement…</p></div>;
  if (races.length === 0) {
    return (
      <div className="wrap" style={{ paddingTop: 40 }}>
        <p className="muted">Cet événement n'existe pas ou n'a aucune course publiée.</p>
        <Link to="/" className="muted" style={{ fontSize: 13 }}>← Toutes les courses</Link>
      </div>
    );
  }

  const eventName = races[0].event_name || slug;
  const organizer = races.find((r) => r.organizer)?.organizer;
  const countries = [...new Set(races.map((r) => r.country).filter(Boolean))];
  const months = [...new Set(races.map((r) => r.month).filter(Boolean))]
    .sort((a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b));
  const distances = races.map((r) => r.km).filter((k) => k != null).sort((a, b) => a - b);
  const totalKm = distances.length
    ? (distances[0] === distances[distances.length - 1]
        ? `${distances[0]} km`
        : `${distances[0]} à ${distances[distances.length - 1]} km`)
    : "—";

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 60 }}>
      <Link to="/" className="muted" style={{ fontSize: 13 }}>← Toutes les courses</Link>

      <h1 className="h1" style={{ marginTop: 12 }}>{eventName}</h1>
      <div className="muted mono" style={{ fontSize: 13 }}>
        {countries.join(" · ")}
        {months.length > 0 && ` · ${months.join(", ")}`}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginTop: 20 }}>
        <div className="card">
          <div className="mono muted" style={{ fontSize: 11 }}>Formats</div>
          <div className="mono">{races.length}</div>
        </div>
        <div className="card">
          <div className="mono muted" style={{ fontSize: 11 }}>Distances</div>
          <div className="mono">{totalKm}</div>
        </div>
        <div className="card">
          <div className="mono muted" style={{ fontSize: 11 }}>Inscriptions</div>
          <div className="mono">{races.some((r) => r.open) ? "Ouvertes" : "Fermées"}</div>
        </div>
      </div>

      {organizer && (
        <div className="organizer-box" style={{ marginTop: 20 }}>
          {organizer.id ? (
            <Link to={`/organizers/${organizer.id}`} className="organizer-box-head organizer-box-head-link">
              {organizer.logo_url && <img src={organizer.logo_url} alt="" className="organizer-logo" />}
              <div>
                <div className="organizer-box-label">Organisé par</div>
                <div className="organizer-box-name">{organizer.name}</div>
              </div>
            </Link>
          ) : (
            <div className="organizer-box-head">
              <div>
                <div className="organizer-box-label">Organisé par</div>
                <div className="organizer-box-name">{organizer.name}</div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="h2" style={{ marginTop: 32, marginBottom: 16 }}>
        Les {races.length} format{races.length > 1 ? "s" : ""}
      </div>
      <div className="race-grid">
        {races.map((r) => <RaceCard key={r.id} race={r} />)}
      </div>
    </div>
  );
}
