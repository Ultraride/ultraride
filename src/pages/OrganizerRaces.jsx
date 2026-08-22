import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import RaceForm from "../admin/RaceForm";

const STATUS_LABEL = {
  draft: "Brouillon",
  pending: "En attente de validation",
  published: "Publiée",
  rejected: "Refusée",
};

// Ordre d'affichage : ce qui demande une action de l'organisateur d'abord.
const STATUS_ORDER = ["rejected", "pending", "draft", "published"];

export default function OrganizerRaces() {
  const { user, loading, isOrganizer, isAdmin } = useAuth();
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // objet course, ou {} pour une création

  // Deux chemins mènent à « mes courses » : celles que ce compte a
  // soumises (created_by), et celles rattachées à sa fiche organisateur
  // — typiquement saisies par l'administrateur avant que l'organisateur
  // ait un compte. Seules les premières sont modifiables : la politique
  // RLS d'écriture repose sur created_by.
  const load = async () => {
    if (!user) return;

    const { data: org } = await supabase
      .from("organizers")
      .select("id")
      .eq("linked_profile_id", user.id)
      .maybeSingle();

    const filters = [`created_by.eq.${user.id}`];
    if (org?.id) filters.push(`organizer_id.eq.${org.id}`);

    const { data, error } = await supabase
      .from("races")
      .select("*")
      .or(filters.join(","))
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setRaces(data);
  };

  useEffect(() => { load(); }, [user]);

  if (loading) return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;
  if (!user) return <Navigate to="/login" replace />;

  if (!isOrganizer && !isAdmin) {
    return (
      <div className="wrap" style={{ paddingTop: 60, maxWidth: 480 }}>
        <h1 className="h1">Réservé aux organisateurs</h1>
        <p className="muted">
          Cet espace permet de soumettre des courses au répertoire. Si tu organises un événement,
          contacte l'administrateur pour faire passer ton compte en organisateur.
        </p>
      </div>
    );
  }

  if (editing !== null) {
    return (
      <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 640 }}>
        <button className="filter-reset" style={{ marginBottom: 16 }} onClick={() => setEditing(null)}>
          ← Retour à mes courses
        </button>
        <RaceForm
          race={editing.id ? editing : null}
          onSaved={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  const sorted = races
    ? [...races].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
    : null;

  return (
    <div className="wrap" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="h1" style={{ margin: 0 }}>Mes courses</h1>
        <button className="btn btn-primary" onClick={() => setEditing({})}>+ Soumettre une course</button>
      </div>

      <p className="muted" style={{ marginTop: 12, marginBottom: 24 }}>
        Les courses que tu soumets sont relues par un administrateur avant publication. Tu peux les
        corriger à tout moment — une modification, même sur une course déjà publiée, la renvoie en
        validation et la retire temporairement du répertoire. Les épreuves saisies par
        l'administrateur avant la création de ton compte apparaissent ici en lecture seule ;
        demande-lui de t'en transférer la gestion si tu souhaites les tenir à jour.
      </p>

      {error && <div className="error-box">{error}</div>}

      {sorted === null ? (
        <p className="muted">Chargement…</p>
      ) : sorted.length === 0 ? (
        <div className="empty-box">
          <p className="muted">Tu n'as encore soumis aucune course.</p>
          <button className="filter-reset" onClick={() => setEditing({})}>Soumettre ma première course</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((r) => (
            <div
              key={r.id}
              className="card"
              style={r.status === "rejected" ? { borderColor: "var(--brick)" } : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "var(--disp)", fontWeight: 600 }}>
                    {r.status === "published"
                      ? <Link to={`/courses/${r.id}`}>{r.name}</Link>
                      : r.name}
                    <span className={`badge badge-${r.status}`} style={{ marginLeft: 8 }}>
                      {STATUS_LABEL[r.status] || r.status}
                    </span>
                  </div>
                  <div className="muted mono" style={{ fontSize: 12, marginTop: 4 }}>
                    {r.country}
                    {r.discipline && ` · ${r.discipline}`}
                    {r.km ? ` · ${r.km} km` : ""}
                    {r.month && ` · ${r.month}`}
                  </div>
                </div>
                {r.created_by === user.id ? (
                  <button className="btn" onClick={() => setEditing(r)}>Modifier</button>
                ) : (
                  <span className="muted mono" style={{ fontSize: 11, alignSelf: "center" }}>
                    Gérée par l'administrateur
                  </span>
                )}
              </div>

              {r.status === "rejected" && (
                <div className="error-box" style={{ marginTop: 10, marginBottom: 0 }}>
                  <strong>Motif du refus :</strong>{" "}
                  {r.review_note || "aucun motif précisé — contacte l'administrateur."}
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    Corrige la fiche puis enregistre : elle repartira automatiquement en validation.
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
