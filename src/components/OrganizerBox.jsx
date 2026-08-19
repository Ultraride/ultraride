import { Link } from "react-router-dom";
import { normalizeUrl, socialLink } from "../lib/organizerLinks";

// `race.organizer` is the joined organizers row (via races.organizer_id) —
// a standalone public profile that doesn't require the organizer to have
// ever logged in. `race.organizer_name` is a plain fallback label for races
// with no linked organizer entity at all.
export default function OrganizerBox({ race }) {
  const org = race.organizer;
  const displayName = org?.name || race.organizer_name;

  const website = normalizeUrl(org?.website);
  const instagram = socialLink(org?.instagram, "https://instagram.com/");
  const facebook = socialLink(org?.facebook, "https://facebook.com/");
  const strava = socialLink(org?.strava, "https://www.strava.com/clubs/");
  const email = org?.email;

  const hasAnything = displayName || website || email || instagram || facebook || strava;
  if (!hasAnything) return null;

  const nameContent = (
    <>
      {org?.logo_url && (
        <img src={org.logo_url} alt="" className="organizer-logo" />
      )}
      <div>
        <div className="organizer-box-label">Organisé par</div>
        <div className="organizer-box-name">{displayName || "Organisateur non précisé"}</div>
      </div>
    </>
  );

  return (
    <div className="organizer-box">
      {race.organizer_id ? (
        <Link to={`/organizers/${race.organizer_id}`} className="organizer-box-head organizer-box-head-link">
          {nameContent}
        </Link>
      ) : (
        <div className="organizer-box-head">{nameContent}</div>
      )}

      {(website || email || instagram || facebook || strava) && (
        <div className="organizer-links">
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" className="tag">Site web ↗</a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="tag">Email</a>
          )}
          {instagram && (
            <a href={instagram} target="_blank" rel="noopener noreferrer" className="tag">Instagram ↗</a>
          )}
          {facebook && (
            <a href={facebook} target="_blank" rel="noopener noreferrer" className="tag">Facebook ↗</a>
          )}
          {strava && (
            <a href={strava} target="_blank" rel="noopener noreferrer" className="tag">Club Strava ↗</a>
          )}
        </div>
      )}
    </div>
  );
}
