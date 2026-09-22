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
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>Ultra</NavLink>
        <NavLink to="/proposer-course" className={({ isActive }) => (isActive ? "active" : "")}>Proposer un ultra</NavLink>
        {user && (
          <NavLink to="/account" className={({ isActive }) => (isActive ? "active" : "")}>Mon compte</NavLink>
        )}
        {(isOrganizer || isAdmin) && (
          <NavLink to="/organizer/races" className={({ isActive }) => (isActive ? "active" : "")}>Mes ultras</NavLink>
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
          <>
            <NavLink to="/login" className={({ isActive }) => (isActive ? "active" : "")}>Connexion</NavLink>
            <NavLink to="/login?mode=signup" className={({ isActive }) => (isActive ? "active" : "")}>Créer un compte</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}
