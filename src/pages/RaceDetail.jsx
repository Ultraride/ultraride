import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import L from "leaflet";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

function RaceMap({ race }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!race || !ref.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const map = L.map(ref.current, { scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const isLoop = race.parcours === "boucle";
    const start = [race.start_lat, race.start_lon];
    const end = isLoop ? start : [race.end_lat, race.end_lon];
    const bounds = [start, end];

    if (race.gpx_track?.length > 1) {
      const latlngs = race.gpx_track.map((p) => [p.lat, p.lon]);
      L.polyline(latlngs, { color: "#E3A23C", weight: 3.5 }).addTo(map);
      bounds.push(...latlngs);
    } else if (!isLoop) {
      L.polyline([start, end], { color: "#7C9A79", weight: 2, dashArray: "6,6" }).addTo(map);
    }

    L.circleMarker(start, { radius: 7, color: "#E3A23C", fillColor: "#E3A23C", fillOpacity: 0.9 })
      .bindTooltip(race.start_place || "Départ").addTo(map);
    if (!isLoop) {
      L.circleMarker(end, { radius: 7, color: "#C1543F", fillColor: "#C1543F", fillOpacity: 0.9 })
        .bindTooltip(race.end_place || "Arrivée").addTo(map);
    }

    map.fitBounds(L.latLngBounds(bounds).pad(0.15));
    mapRef.current = map;
    return () => map.remove();
  }, [race]);

  return <div ref={ref} style={{ width: "100%", height: 320, background: "var(--ink)" }} />;
}

function Comments({ raceId }) {
  const { user, signInWithEmail } = useAuth();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [sentLink, setSentLink] = useState(false);
  const [error, setError] = useState(null);

  const load = () => {
    supabase
      .from("comments")
      .select("*, author:profiles(email, display_name)")
      .eq("race_id", raceId)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .then(({ data }) => setComments(data || []));
  };

  useEffect(() => { load(); }, [raceId]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      // No account yet: sending a magic link creates one automatically on
      // confirmation (see the DB trigger) — ask them to come back and post
      // after clicking the link.
      const { error } = await signInWithEmail(email);
      if (error) setError(error.message);
      else setSentLink(true);
      return;
    }
    const { error } = await supabase.from("comments").insert({ race_id: raceId, author_id: user.id, body });
    if (error) setError(error.message);
    else { setBody(""); load(); }
  };

  return (
    <div style={{ marginTop: 32 }}>
      <div className="h2">Avis</div>
      {comments.length === 0 && <p className="muted">Aucun avis pour l'instant.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {comments.map((c) => (
          <div key={c.id} className="card">
            <div className="mono muted" style={{ fontSize: 11 }}>{c.author?.display_name || c.author?.email}</div>
            <p style={{ margin: "6px 0 0" }}>{c.body}</p>
          </div>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}

      {sentLink ? (
        <div className="success-box">Lien envoyé — clique dessus puis reviens ici pour publier ton avis.</div>
      ) : (
        <form onSubmit={submit} className="panel">
          {!user && (
            <div className="field">
              <label>Ton email (crée un compte automatiquement)</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label>Ton avis</label>
            <textarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">
            {user ? "Publier" : "Recevoir le lien pour publier"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function RaceDetail() {
  const { id } = useParams();
  const [race, setRace] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.from("races").select("*").eq("id", id).single().then(({ data, error }) => {
      if (error) setError(error.message);
      else setRace(data);
    });
  }, [id]);

  if (error) return <div className="wrap" style={{ paddingTop: 40 }}><div className="error-box">{error}</div></div>;
  if (!race) return <div className="wrap" style={{ paddingTop: 40 }}><p className="muted">Chargement…</p></div>;

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 800 }}>
      <Link to="/" className="muted" style={{ fontSize: 13 }}>← Toutes les courses</Link>
      <h1 className="h1" style={{ marginTop: 12 }}>{race.name}</h1>
      <p className="muted">{race.long_blurb || race.blurb}</p>

      <RaceMap race={race} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 20 }}>
        <div className="card"><div className="mono muted" style={{ fontSize: 11 }}>Distance</div><div className="mono">{race.km} km</div></div>
        <div className="card"><div className="mono muted" style={{ fontSize: 11 }}>Dénivelé +</div><div className="mono">{race.dplus} m</div></div>
        <div className="card"><div className="mono muted" style={{ fontSize: 11 }}>Mois</div><div className="mono">{race.month}</div></div>
        <div className="card"><div className="mono muted" style={{ fontSize: 11 }}>Mode</div><div className="mono">{race.mode}</div></div>
      </div>

      <Comments raceId={race.id} />
    </div>
  );
}
