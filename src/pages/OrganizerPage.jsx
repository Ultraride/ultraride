import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { normalizeUrl, socialLink } from "../lib/organizerLinks";
import RaceCard from "../components/RaceCard";

export default function OrganizerPage() {
  const { id } = useParams();
  const [organizer, setOrganizer] = useState(null);
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from("organizers")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setOrganizer(data);
      });

    supabase
      .from("races")
      .select("id, name, country, discipline, format, mode, parcours, month, km, dplus, price, open, lat, lon, blurb, image_url")
      .eq("organizer_id", id)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .then(({ data }) => setRaces(data || []));
  }, [id]);

  if (error) return <div className="wrap" style={{ paddingTop: 40 }}><div className="error-box">{error}</div></div>;
  if (!organizer) return <div className="wrap" style={{ paddingTop: 40 }}><p className="muted">Chargement…</p></div>;

  const website = normalizeUrl(organizer.website);
  const instagram = socialLink(organizer.instagram, "https://instagram.com/");
  const facebook = socialLink(organizer.facebook, "https://facebook.com/");
  const strava = socialLink(organizer.strava, "https://www.strava.com/clubs/");

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <div className="organizer-page-head">
        {organizer.logo_url && (
          <img src={organizer.logo_url} alt="" className="organizer-page-logo" />
        )}
        <div>
          <h1 className="h1" style={{ margin: 0 }}>{organizer.name}</h1>
          {(website || organizer.email || instagram || facebook || strava) && (
            <div className="organizer-links" style={{ marginTop: 10 }}>
              {website && <a href={website} target="_blank" rel="noopener noreferrer" className="tag">Site web ↗</a>}
              {organizer.email && <a href={`mailto:${organizer.email}`} className="tag">Email</a>}
              {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer" className="tag">Instagram ↗</a>}
              {facebook && <a href={facebook} target="_blank" rel="noopener noreferrer" className="tag">Facebook ↗</a>}
              {strava && <a href={strava} target="_blank" rel="noopener noreferrer" className="tag">Club Strava ↗</a>}
            </div>
          )}
        </div>
      </div>

      {organizer.bio && (
        <p className="organizer-page-bio">{organizer.bio}</p>
      )}

      <div className="h2" style={{ marginTop: 32, marginBottom: 16 }}>
        Courses ({races === null ? "…" : races.length})
      </div>

      {races === null ? (
        <p className="muted">Chargement…</p>
      ) : races.length === 0 ? (
        <p className="muted">Aucune course publiée pour l'instant.</p>
      ) : (
        <div className="race-grid">
          {races.map((r) => <RaceCard key={r.id} race={{ ...r, organizer: { name: organizer.name, logo_url: organizer.logo_url, id: organizer.id } }} />)}
        </div>
      )}

      <div style={{ marginTop: 32 }}>
        <Link to="/" className="muted" style={{ fontSize: 13 }}>← Toutes les courses</Link>
      </div>
    </div>
  );
}
