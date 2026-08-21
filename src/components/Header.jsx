import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

export default function Header() {
  const { user, isAdmin, isOrganizer, signOut } = useAuth();

  return (
    <header className="site">
      <NavLink to="/" className="brand">
        <img src="/logo.png" alt="UltraRide" className="brand-logo" />
      </NavLink>
      <nav className="top-nav">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>Courses</NavLink>
        {user && (
          <NavLink to="/account" className={({ isActive }) => (isActive ? "active" : "")}>Mon compte</NavLink>
        )}
        {(isOrganizer || isAdmin) && (
          <NavLink to="/organizer/profile" className={({ isActive }) => (isActive ? "active" : "")}>Fiche organisateur</NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>Admin</NavLink>
        )}
        {user ? (
          <button onClick={signOut}>Déconnexion</button>
        ) : (
          <NavLink to="/login" className={({ isActive }) => (isActive ? "active" : "")}>Connexion</NavLink>
        )}
      </nav>
    </header>
  );
}
