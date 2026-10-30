import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

// Icônes du rail (traits fins, couleur du texte).
const ICONS = {
  supervision: <><path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  valider: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  ultras: <path d="M3 6h18M3 12h18M3 18h12" />,
  updates: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>,
  comments: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  submissions: <><path d="M12 5v14M5 12h14" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.6-5 6.5-5s5.5 1.5 6.5 5" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c1.8.6 3 2.2 3.5 5" /></>,
  organizers: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /></>,
  images: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 8" /></>,
};

function Icon({ name }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

export default function AdminLayout() {
  const { user, profile, isAdmin, loading } = useAuth();
  const location = useLocation();
  const [counts, setCounts] = useState({ races: 0, comments: 0, submissions: 0, updates: 0 });

  // Les compteurs sont relus à chaque changement de page de l'admin : après
  // avoir validé une course ou modéré un avis, la pastille se met à jour
  // dès que l'on navigue, sans rechargement manuel.
  const loadCounts = useCallback(async () => {
    if (!isAdmin) return;

    const [racesRes, deletionRes, commentsRes, submissionsRes, updatesRes] = await Promise.all([
      supabase.from("races").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("races").select("id", { count: "exact", head: true }).eq("deletion_requested", true),
      supabase.from("comments").select("id", { count: "exact", head: true }).or("status.eq.pending,deletion_requested.eq.true"),
      supabase.from("race_submissions").select("id", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("race_update_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    setCounts({
      // Les deux files atterrissent sur le même écran : la pastille les cumule.
      races: (racesRes.count || 0) + (deletionRes.count || 0),
      comments: commentsRes.count || 0,
      submissions: submissionsRes.count || 0,
      updates: updatesRes.count || 0,
    });
  }, [isAdmin]);

  useEffect(() => { loadCounts(); }, [loadCounts, location.pathname]);

  if (loading) return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;
  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="wrap" style={{ paddingTop: 60, maxWidth: 480 }}>
        <h1 className="h1">Accès refusé</h1>
        <p className="muted">
          Ce compte ({user.email}) a le rôle « {profile?.role || "inconnu"} ». Seuls les comptes
          administrateur ont accès à cet espace.
        </p>
      </div>
    );
  }

  // « Supervision » couvre la vue d'ensemble (/admin) et l'onglet Analytics.
  const onSupervision = location.pathname === "/admin" || location.pathname.startsWith("/admin/analytics");

  const links = [
    { to: "/admin", label: "Supervision", icon: "supervision", active: onSupervision },
    { to: "/admin/a-valider", label: "À valider", icon: "valider", count: counts.races },
    { to: "/admin/races", label: "Ultras", icon: "ultras" },
    { to: "/admin/mises-a-jour", label: "Mises à jour", icon: "updates", count: counts.updates },
    { to: "/admin/comments", label: "Avis", icon: "comments", count: counts.comments },
    { to: "/admin/submissions", label: "Propositions", icon: "submissions", count: counts.submissions },
    { to: "/admin/users", label: "Comptes", icon: "users" },
    { to: "/admin/organizers", label: "Organisateurs", icon: "organizers" },
    { to: "/admin/instagram", label: "Instagram", icon: "instagram" },
    { to: "/admin/images", label: "Images", icon: "images" },
  ];

  return (
    <div className="adm-shell">
      <nav className="adm-rail" aria-label="Administration">
        <Link to="/" className="adm-rail-brand" aria-label="Retour au site">U<span>R</span></Link>
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/admin"}
            className={({ isActive }) => `adm-rail-link${(l.active ?? isActive) ? " active" : ""}`}
          >
            <span className="adm-rail-icon"><Icon name={l.icon} /></span>
            <span className="adm-rail-label">{l.label}</span>
            {l.count > 0 && <span className="adm-rail-badge" aria-label={`${l.count} en attente`}>{l.count}</span>}
          </NavLink>
        ))}
      </nav>
      <main className="adm-main">
        <Outlet context={{ counts, reloadCounts: loadCounts }} />
      </main>
    </div>
  );
}
