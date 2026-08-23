import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

const FORMAT_LABEL = { course: "Course", aventure: "Aventure", endurance: "Endurance" };
const PARCOURS_LABEL = { boucle: "Boucle", point: "Point à point", ar: "Aller-retour" };

function Row({ label, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  );
}

// Vue de relecture : tout ce que l'organisateur a saisi, y compris les
// champs absents de la ligne de résumé. Publier sans avoir vu la
// description longue ou le lien d'inscription reviendrait à valider à
// l'aveugle.
function RaceReview({ race }) {
  const coords = (lat, lon) =>
    lat != null && lon != null ? `${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}` : null;

  return (
    <div className="review-panel">
      {race.image_url && (
        <img src={race.image_url} alt="" className="review-image" />
      )}

      <dl className="review-grid">
        <Row label="Organisateur">
          {race.organizer?.name || race.organizer_name || (
            <span style={{ color: "var(--brick)" }}>Aucun organisateur rattaché</span>
          )}
        </Row>
        <Row label="Événement">{race.event_name}</Row>
        <Row label="Pays">{race.country}</Row>
        <Row label="Discipline">{race.discipline}</Row>
        <Row label="Format">{FORMAT_LABEL[race.format] || race.format}</Row>
        <Row label="Mode">{race.mode}</Row>
        <Row label="Parcours">{PARCOURS_LABEL[race.parcours] || race.parcours}</Row>
        <Row label="Distance">{race.km ? `${race.km} km` : null}</Row>
        <Row label="Dénivelé +">{race.dplus ? `${race.dplus.toLocaleString("fr-FR")} m` : null}</Row>
        <Row label="Mois">{race.month}</Row>
        <Row label="Dates">
          {race.start_date
            ? `${new Date(race.start_date).toLocaleDateString("fr-FR")}${race.end_date ? ` → ${new Date(race.end_date).toLocaleDateString("fr-FR")}` : ""}`
            : null}
        </Row>
        <Row label="Heure de départ">{race.departure_time}</Row>
        <Row label="Lieu de départ">{race.start_place}</Row>
        <Row label="Coord. départ">{coords(race.start_lat, race.start_lon)}</Row>
        <Row label="Lieu d'arrivée">{race.end_place}</Row>
        <Row label="Coord. arrivée">{coords(race.end_lat, race.end_lon)}</Row>
        <Row label="Inscriptions">{race.open ? "Ouvertes" : "Fermées"}</Row>
        <Row label="Lien d'inscription">
          {race.registration_url ? (
            <a href={race.registration_url} target="_blank" rel="noopener noreferrer">
              {race.registration_url}
            </a>
          ) : null}
        </Row>
      </dl>

      {race.blurb && (
        <div className="review-text">
          <div className="review-text-label">Description courte</div>
          <p>{race.blurb}</p>
        </div>
      )}

      {race.long_blurb && (
        <div className="review-text">
          <div className="review-text-label">Description longue</div>
          <p>{race.long_blurb}</p>
        </div>
      )}

      {/* Les politiques RLS autorisent l'admin à lire une course non publiée :
          l'aperçu public fonctionne donc avant validation. */}
      <Link to={`/courses/${race.id}`} target="_blank" className="filter-reset">
        Ouvrir l'aperçu public ↗
      </Link>
    </div>
  );
}

export default function PendingRaces() {
  const { user } = useAuth();
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [deletions, setDeletions] = useState(null);

  const load = async () => {
    const select = "*, created_by:profiles!races_created_by_fkey(email, display_name), organizer:organizers!races_organizer_id_fkey(name)";

    const [pendingRes, deletionRes] = await Promise.all([
      supabase.from("races").select(select).eq("status", "pending").order("created_at", { ascending: true }),
      supabase.from("races").select(select).eq("deletion_requested", true).order("created_at", { ascending: true }),
    ]);

    if (pendingRes.error) setError(pendingRes.error.message);
    else setRaces(pendingRes.data);

    if (deletionRes.error) setError(deletionRes.error.message);
    else setDeletions(deletionRes.data);
  };

  useEffect(() => { load(); }, []);

  const publish = async (race) => {
    setBusy(race.id);
    const { error } = await supabase
      .from("races")
      .update({ status: "published", reviewed_by: user.id, review_note: null })
      .eq("id", race.id);
    setBusy(null);
    if (error) setError(error.message);
    else { setOpenId(null); load(); }
  };

  const reject = async (race) => {
    const note = window.prompt("Raison du refus (visible par l'organisateur) :", "");
    if (note === null) return;
    setBusy(race.id);
    const { error } = await supabase
      .from("races")
      .update({ status: "rejected", reviewed_by: user.id, review_note: note })
      .eq("id", race.id);
    setBusy(null);
    if (error) setError(error.message);
    else { setOpenId(null); load(); }
  };

  const confirmDeletion = async (race) => {
    if (!window.confirm(`Supprimer définitivement « ${race.name} » ? Cette action est irréversible.`)) return;
    setBusy(race.id);
    const { error } = await supabase.from("races").delete().eq("id", race.id);
    setBusy(null);
    if (error) setError(error.message);
    else load();
  };

  const dismissDeletion = async (race) => {
    setBusy(race.id);
    const { error } = await supabase
      .from("races")
      .update({ deletion_requested: false, deletion_reason: null })
      .eq("id", race.id);
    setBusy(null);
    if (error) setError(error.message);
    else load();
  };

  return (
    <div>
      <h1 className="h1">Courses à valider</h1>
      {error && <div className="error-box">{error}</div>}

      {races === null ? (
        <p className="muted">Chargement…</p>
      ) : races.length === 0 ? (
        <p className="muted">Aucune soumission en attente.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {races.map((race) => (
            <div key={race.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div className="h2" style={{ marginBottom: 4 }}>{race.name}</div>
                  <div className="muted mono" style={{ fontSize: 12 }}>
                    {race.country} · {race.discipline} · {race.km ?? "—"} km · {race.dplus ?? "—"} D+ · soumis par{" "}
                    {race.created_by?.display_name || race.created_by?.email || "—"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-primary" disabled={busy === race.id} onClick={() => publish(race)}>
                    Valider
                  </button>
                  <button className="btn btn-danger" disabled={busy === race.id} onClick={() => reject(race)}>
                    Refuser
                  </button>
                  <button className="btn" disabled={busy === race.id} onClick={() => setOpenId(openId === race.id ? null : race.id)}>
                    {openId === race.id ? "Masquer" : "Voir"}
                  </button>
                </div>
              </div>

              {openId === race.id && (
                <>
                  <RaceReview race={race} />
                  <div className="review-actions">
                    <button className="btn btn-primary" disabled={busy === race.id} onClick={() => publish(race)}>
                      Publier
                    </button>
                    <button className="btn btn-danger" disabled={busy === race.id} onClick={() => reject(race)}>
                      Refuser
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {deletions && deletions.length > 0 && (
        <>
          <h2 className="h2" style={{ marginTop: 36 }}>
            Demandes de suppression ({deletions.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {deletions.map((race) => (
              <div key={race.id} className="card" style={{ borderColor: "var(--brick)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div className="h2" style={{ marginBottom: 4 }}>
                      {race.name}
                      <span className={`badge badge-${race.status}`} style={{ marginLeft: 8 }}>
                        {race.status}
                      </span>
                    </div>
                    <div className="muted mono" style={{ fontSize: 12 }}>
                      {race.organizer?.name || race.organizer_name || "—"} · demandé par{" "}
                      {race.created_by?.display_name || race.created_by?.email || "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-danger" disabled={busy === race.id} onClick={() => confirmDeletion(race)}>
                      Supprimer
                    </button>
                    <button className="btn" disabled={busy === race.id} onClick={() => dismissDeletion(race)}>
                      Rejeter la demande
                    </button>
                  </div>
                </div>
                <div className="error-box" style={{ marginTop: 10, marginBottom: 0 }}>
                  <strong>Motif :</strong> {race.deletion_reason || "aucun motif indiqué"}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
