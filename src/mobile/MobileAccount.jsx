import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";
import PalmaresSection from "../pages/PalmaresSection";
import { InfoSection, PasswordSection, CommentsSection, DangerZone } from "../pages/Account";
import { formatNumber } from "./data";
import { MiniCard, MenuButton, Stamp, Icon } from "./ui";

function Collapsible({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="m-collapse">
      <button type="button" className="m-collapse-head" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="m-label m-label--strong">{title}</span>
        <span style={{ transform: `rotate(${open ? 90 : 0}deg)`, transition: "transform .15s" }}><Icon name="chevron" size={18} /></span>
      </button>
      {open && <div className="m-collapse-body">{children}</div>}
    </section>
  );
}

export default function MobileAccount() {
  const { user, profile, loading, isOrganizer, isAdmin } = useAuth();
  const [results, setResults] = useState(null);
  const [favorites, setFavorites] = useState(null);
  const [managing, setManaging] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("race_results").select("id, race_name, event_date, distance_km, elevation_gain").eq("user_id", user.id)
      .order("event_date", { ascending: false, nullsFirst: false })
      .then(({ data }) => setResults(data || []));
    supabase.from("favorites").select("id, race:races(id, name, discipline, km, start_date, month, parcours, image_url)").eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setFavorites((data || []).filter((f) => f.race)));
  }, [user, managing]);

  const stats = useMemo(() => ({
    count: results?.length || 0,
    km: (results || []).reduce((s, r) => s + (r.distance_km || 0), 0),
    dplus: (results || []).reduce((s, r) => s + (r.elevation_gain || 0), 0),
  }), [results]);

  if (loading) return <div className="m-screen"><div className="m-skeleton" style={{ height: 260, margin: 20 }} /></div>;
  if (!user) return <Navigate to="/login" replace />;

  const name = profile?.display_name || user.email?.split("@")[0] || "Participant";
  const role = isAdmin ? "Admin" : isOrganizer ? "Organisateur" : "Participant";

  return (
    <div className="m-screen">
      <div className="m-pad m-stack">
        <div className="m-topbar">
          <h1 className="m-h1 m-h1--page">MON PASSEPORT</h1>
          <MenuButton />
        </div>

        <div className="m-passport">
          <svg className="m-passport-art" viewBox="0 0 350 210" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <path d="M-10 180 C 70 150, 110 196, 190 160 S 300 110, 360 130" stroke="#2C4434" strokeWidth="1.2" fill="none" />
            <path d="M-10 154 C 60 126, 120 168, 200 132 S 300 84, 360 104" stroke="#2C4434" strokeWidth="1.2" fill="none" />
            <path d="M-10 128 C 60 100, 130 140, 210 106 S 310 60, 360 80" stroke="#2C4434" strokeWidth="1.2" fill="none" />
          </svg>
          <div className="m-passport-top">
            <div className="m-passport-id">
              <span className="m-label m-label--peach">PASSEPORT ULTRA</span>
              <span className="m-passport-name">{name.toUpperCase()}</span>
              <span className="m-passport-role">{role}</span>
            </div>
            {stats.count > 0 && <Stamp top="FINISHER" big={`×${stats.count}`} rotate={10} />}
          </div>
          <div className="m-passport-stats">
            <div><span className="m-passport-num">{stats.count}</span><span className="m-label m-label--pale">ULTRA{stats.count !== 1 ? "S" : ""}</span></div>
            <div><span className="m-passport-num">{formatNumber(stats.km)}</span><span className="m-label m-label--pale">KM</span></div>
            <div><span className="m-passport-num">{formatNumber(stats.dplus)}</span><span className="m-label m-label--pale">M D+</span></div>
          </div>
        </div>

        {!isOrganizer && (
          <section className="m-section">
            <div className="m-section-head">
              <h2 className="m-label m-label--strong">PALMARÈS</h2>
              <button type="button" className="m-link m-link--btn" onClick={() => setManaging((v) => !v)}>
                {managing ? "Fermer" : <><Icon name="plus" size={14} width={2.4} /> Ajouter / gérer</>}
              </button>
            </div>
            {managing ? (
              <div className="m-legacy"><PalmaresSection /></div>
            ) : results && results.length === 0 ? (
              <div className="m-card m-geo"><p>Ajoute tes ultras terminés (fichier .FIT) pour remplir ton passeport.</p></div>
            ) : (
              <div className="m-card m-list">
                {(results || []).map((r) => (
                  <div key={r.id} className="m-result">
                    <span className="m-result-year">{r.event_date ? new Date(r.event_date).getFullYear() : "—"}</span>
                    <span className="m-row-body">
                      <span className="m-row-title">{r.race_name}</span>
                      <span className="m-row-meta">
                        {[r.distance_km ? `${formatNumber(r.distance_km)} km` : null, r.elevation_gain ? `${formatNumber(r.elevation_gain)} m D+` : null].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!isOrganizer && (
          <section className="m-section">
            <div className="m-section-head"><h2 className="m-label m-label--strong">MES FAVORIS</h2></div>
            {favorites && favorites.length === 0 ? (
              <div className="m-card m-geo"><p>Touche le cœur d'une fiche pour la retrouver ici.</p></div>
            ) : (
              <div className="m-hscroll">
                {(favorites || []).map((f) => <MiniCard key={f.id} race={f.race} />)}
              </div>
            )}
          </section>
        )}

        <div className="m-legacy">
          {!isOrganizer && <Collapsible title="MES AVIS"><CommentsSection /></Collapsible>}
          <Collapsible title="MES INFORMATIONS"><InfoSection /></Collapsible>
          <Collapsible title="MOT DE PASSE"><PasswordSection /></Collapsible>
          <Collapsible title="SUPPRIMER MON COMPTE"><DangerZone /></Collapsible>
        </div>
      </div>
    </div>
  );
}
