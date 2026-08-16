import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function AdminLayout() {
  const { user, profile, isAdmin, loading } = useAuth();

  if (loading) {
    return <div className="wrap" style={{ paddingTop: 60 }}><p className="muted">Chargement…</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return (
      <div className="wrap" style={{ paddingTop: 60, maxWidth: 480 }}>
        <h1 className="h1">Accès refusé</h1>
        <p className="muted">
          Ce compte ({user.email}) a le rôle « {profile?.role || "inconnu"} ». Seuls les
          comptes administrateur ont accès à cet espace.
        </p>
      </div>
    );
  }

  const items = [
    { to: "/admin", label: "À valider", end: true },
    { to: "/admin/races", label: "Toutes les courses" },
    { to: "/admin/comments", label: "Commentaires" },
    { to: "/admin/users", label: "Utilisateurs" },
    { to: "/admin/organizers", label: "Fiches organisateur" },
  ];

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {it.label}
          </NavLink>
        ))}
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
