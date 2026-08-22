import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../lib/AuthContext";

export default function AdminLayout() {
  const { user, profile, isAdmin, loading } = useAuth();
  const location = useLocation();
  const [counts, setCounts] = useState({ races: 0, comments: 0 });

  // Les compteurs sont relus à chaque changement de page de l'admin : après
  // avoir validé une course ou modéré un avis, la pastille se met à jour
  // dès que l'on navigue, sans rechargement manuel.
  const loadCounts = useCallback(async () => {
    if (!isAdmin) return;

    const [racesRes, commentsRes] = await Promise.all([
      supabase
        .from("races")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("comments")
        .select("id", { count: "exact", head: true })
        .or("status.eq.pending,deletion_requested.eq.true"),
    ]);

    setCounts({
      races: racesRes.count || 0,
      comments: commentsRes.count || 0,
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

  const links = [
    { to: "/admin", label: "À valider", end: true, count: counts.races },
    { to: "/admin/races", label: "Toutes les courses" },
    { to: "/admin/comments", label: "Commentaires", count: counts.comments },
    { to: "/admin/users", label: "Utilisateurs" },
    { to: "/admin/organizers", label: "Fiches organisateur" },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? "active" : "")}>
            <span>{l.label}</span>
            {l.count > 0 && (
              <span className="admin-badge" aria-label={`${l.count} en attente`}>{l.count}</span>
            )}
          </NavLink>
        ))}
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
