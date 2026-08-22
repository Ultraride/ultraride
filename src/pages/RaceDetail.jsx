import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import L from "leaflet";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import OrganizerBox from "../components/OrganizerBox";
import FavoriteButton from "../components/FavoriteButton";
import { priceTier, formatPrice } from "../lib/price";

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
      L.polyline(latlngs, { color: "#C4622D", weight: 3.5 }).addTo(map);
      bounds.push(...latlngs);
    } else if (!isLoop) {
      L.polyline([start, end], { color: "#2FA05C", weight: 2, dashArray: "6,6" }).addTo(map);
    }

    L.circleMarker(start, { radius: 7, color: "#C4622D", fillColor: "#C4622D", fillOpacity: 0.9 })
      .bindTooltip(race.start_place || "Départ").addTo(map);
    if (!isLoop) {
      L.circleMarker(end, { radius: 7, color: "#C1543F", fillColor: "#C1543F", fillOpacity: 0.9 })
        .bindTooltip(race.end_place || "Arrivée").addTo(map);
    }

    const latLngBounds = L.latLngBounds(bounds);
    // A loop with no GPX track collapses start/end to the same point — fitBounds on a
    // zero-area box zooms to street level. Fall back to a fixed regional zoom instead.
    const isSinglePoint = latLngBounds.getNorthEast().distanceTo(latLngBounds.getSouthWest()) < 500;
    if (isSinglePoint) {
      map.setView(start, 8);
    } else {
      map.fitBounds(latLngBounds.pad(0.15));
    }
    mapRef.current = map;
    return () => map.remove();
  }, [race]);

  return <div ref={ref} style={{ width: "100%", height: 320, background: "var(--ink)" }} />;
}

function Comments({ raceId }) {
  const { user, isOrganizer } = useAuth();
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

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
    const { error } = await supabase.from("comments").insert({ race_id: raceId, author_id: user.id, body, status: "pending" });
    if (error) setError(error.message);
    else { setBody(""); setInfo("Avis envoyé — il sera visible après validation par un administrateur."); load(); }
  };

  return (
    <div style={{ marginTop: 32 }}>
      <div className="h2">Avis</div>
      {comments.length === 0 && <p className="muted">Aucun avis pour l'instant.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {comments.map((c) => (
          <div key={c.id} className="card">
            <div className="mono muted" style={{ fontSize: 11 }}>{c.author?.display_name || c.author?.email || "Utilisateur supprimé"}</div>
            <p style={{ margin: "6px 0 0" }}>{c.body}</p>
          </div>
        ))}
      </div>

      {error && <div className="error-box">{error}</div>}
      {info && <div className="success-box">{info}</div>}

      {!user ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            <Link to="/login" style={{ color: "var(--amber)", textDecoration: "underline" }}>Connecte-toi ou crée un compte</Link> pour laisser un avis.
          </p>
        </div>
      ) : isOrganizer ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>Les comptes organisateur ne peuvent pas laisser d'avis.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="panel">
          <div className="field">
            <label>Ton avis</label>
            <textarea required rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">Envoyer</button>
          <div className="field-hint" style={{ marginTop: 8 }}>Ton avis sera visible après validation par un administrateur.</div>
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
    supabase
      .from("races")
      .select("*, organizer:organizers!races_organizer_id_fkey(id, name, website, email, instagram, facebook, strava, logo_url)")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setRace(data);
      });
  }, [id]);

  // Comptage des vues, séparé du chargement de la fiche : si l'incrément
  // échoue, ça ne doit jamais empêcher l'affichage de la course.
  useEffect(() => {
    if (!id) return;
    supabase.rpc("increment_race_views", { race_id: id }).then(({ error }) => {
      if (error) console.warn("increment_race_views:", error.message);
    });
  }, [id]);

  if (error) return <div className="wrap" style={{ paddingTop: 40 }}><div className="error-box">{error}</div></div>;
  if (!race) return <div className="wrap" style={{ paddingTop: 40 }}><p className="muted">Chargement…</p></div>;

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 800 }}>
      <Link to="/" className="muted" style={{ fontSize: 13 }}>← Toutes les courses</Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <h1 className="h1" style={{ margin: 0 }}>{race.name}</h1>
        <FavoriteButton raceId={race.id} size={22} />
        {race.registration_url && (
          <a
            href={race.registration_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ marginLeft: "auto" }}
          >
            S'inscrire
          </a>
        )}
      </div>
      {race.image_url && (
        <img src={race.image_url} alt="" className="race-detail-image" />
      )}

      <RaceMap race={race} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 20 }}>
        <div className="card"><div className="mono muted" style={{ fontSize: 11 }}>Distance</div><div className="mono">{race.km} km</div></div>
        <div className="card"><div className="mono muted" style={{ fontSize: 11 }}>Dénivelé +</div><div className="mono">{race.dplus} m</div></div>
        <div className="card"><div className="mono muted" style={{ fontSize: 11 }}>Mois</div><div className="mono">{race.month}</div></div>
        <div className="card"><div className="mono muted" style={{ fontSize: 11 }}>Mode</div><div className="mono">{race.mode}</div></div>
        {priceTier(race.price) && (
          <div className="card">
            <div className="mono muted" style={{ fontSize: 11 }}>Tarif</div>
            <div className="price-detail">
              <span className="price-signs">
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={n <= priceTier(race.price).signs ? "price-sign-on" : "price-sign-off"}>€</span>
                ))}
              </span>
              {/* Le montant exact complète le barème quand il est connu ;
                  sinon la fourchette suffit à situer l'épreuve. */}
              <span className="mono">{formatPrice(race.price)}</span>
            </div>
          </div>
        )}
      </div>

      <p className="muted" style={{ marginTop: 20 }}>{race.long_blurb || race.blurb}</p>

      <OrganizerBox race={race} />

      <Comments raceId={race.id} />
    </div>
  );
}
