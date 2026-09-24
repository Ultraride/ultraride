import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const navClass = ({ isActive }) => (isActive ? "active" : "");

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

  // Même liste de liens pour la nav desktop et le panneau mobile : un lien
  // ajouté ici apparaît forcément dans les deux.
  const links = (
    <>
      <NavLink to="/" end className={navClass} onClick={close}>Trouve ton ultra</NavLink>
      <NavLink to="/proposer-course" className={navClass} onClick={close}>Proposer un ultra</NavLink>
      <NavLink to="/le-projet" className={navClass} onClick={close}>Le projet</NavLink>
      <NavLink to="/mode-d-emploi" className={navClass} onClick={close}>Mode d'emploi</NavLink>
      {user && (
        <NavLink to="/account" className={navClass} onClick={close}>Mon compte</NavLink>
      )}
      {(isOrganizer || isAdmin) && (
        <NavLink to="/organizer/races" className={navClass} onClick={close}>Mes ultras</NavLink>
      )}
      {(isOrganizer || isAdmin) && (
        <NavLink to="/organizer/profile" className={navClass} onClick={close}>Fiche organisateur</NavLink>
      )}
      {isAdmin && (
        <NavLink to="/admin" className={navClass} onClick={close}>Admin</NavLink>
      )}
      {user ? (
        <button onClick={() => { close(); signOut(); }}>Déconnexion</button>
      ) : (
        <>
          <NavLink to="/login" className={navClass} onClick={close}>Connexion</NavLink>
          <NavLink
            to="/login?mode=signup"
            className={(state) => `nav-cta ${navClass(state)}`}
            onClick={close}
          >
            Créer un compte
          </NavLink>
        </>
      )}
    </>
  );

  return (
    <header className="site">
      <NavLink to="/" className="brand">
        <img src="/logo.png" alt="UltraRide" className="brand-logo" />
      </NavLink>
      <nav className="top-nav">{links}</nav>
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
        <nav id="mobile-nav" className="mobile-nav">{links}</nav>
      )}
    </header>
  );
}
