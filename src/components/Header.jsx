import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import RoleSwitcher from "./RoleSwitcher";

export default function Header() {
  const { user, isAdmin, isOrganizer, signOut } = useAuth();

  return (
    <header className="site">
      <NavLink to="/" className="brand">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M2 18 L7 10 L11 15 L15 6 L22 18" stroke="#E3A23C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        ULTRARIDE
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
        <RoleSwitcher />
        {user ? (
          <button onClick={signOut}>Déconnexion</button>
        ) : (
          <NavLink to="/login" className={({ isActive }) => (isActive ? "active" : "")}>Connexion</NavLink>
        )}
      </nav>
    </header>
  );
}
