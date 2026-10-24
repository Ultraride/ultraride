import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { ThemeCycleButton, ThemeSegmented } from "./ThemeToggle";

const navClass = ({ isActive }) => (isActive ? "active" : "");

function PassportIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M8 17c1-2 2.5-3 4-3s3 1 4 3" />
    </svg>
  );
}

export default function Header() {
  const { user, isAdmin, isOrganizer, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Le menu mobile se referme dès que l'on change de page.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  // Liens principaux, partagés par la nav ordinateur et le panneau mobile.
  const mainLinks = (
    <>
      <NavLink to="/" end className={navClass} onClick={close}>Découvrir</NavLink>
      <NavLink to="/ultras" className={navClass} onClick={close}>Ultras</NavLink>
      <NavLink to="/proposer-course" className={navClass} onClick={close}>Proposer un ultra</NavLink>
      <NavLink to="/le-projet" className={navClass} onClick={close}>Le projet</NavLink>
      <NavLink to="/mode-d-emploi" className={navClass} onClick={close}>Mode d'emploi</NavLink>
      {(isOrganizer || isAdmin) && (
        <NavLink to="/organizer/races" className={navClass} onClick={close}>Mes ultras</NavLink>
      )}
      {(isOrganizer || isAdmin) && (
        <NavLink to="/organizer/profile" className={navClass} onClick={close}>Fiche organisateur</NavLink>
      )}
      {isAdmin && (
        <NavLink to="/admin" className={navClass} onClick={close}>Admin</NavLink>
      )}
    </>
  );

  return (
    <header className="site">
      <NavLink to="/" className="brand">
        <img src="/logo.png" alt="UltraRide" className="brand-logo" />
      </NavLink>
      <nav className="top-nav" aria-label="Navigation principale">{mainLinks}</nav>
      <div className="top-actions">
        <ThemeCycleButton />
        <Link to={user ? "/account" : "/login"} className="nav-passport">
          <PassportIcon />Mon passeport
        </Link>
        {user && (
          <button type="button" className="nav-signout" onClick={signOut}>Déconnexion</button>
        )}
      </div>
      <button
        type="button"
        className="nav-burger"
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-controls="mobile-nav"
        onClick={() => setMenuOpen((v) => !v)}
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      {menuOpen && (
        <nav id="mobile-nav" className="mobile-nav" aria-label="Menu">
          <ThemeSegmented />
          {mainLinks}
          {user ? (
            <>
              <NavLink to="/account" className={navClass} onClick={close}>Mon passeport</NavLink>
              <button onClick={() => { close(); signOut(); }}>Déconnexion</button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass} onClick={close}>Connexion</NavLink>
              <NavLink to="/login?mode=signup" className={(s) => `nav-cta ${navClass(s)}`} onClick={close}>
                Créer un compte
              </NavLink>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
