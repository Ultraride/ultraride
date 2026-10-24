import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

// Barre d'onglets façon application, visible uniquement sur mobile (cf.
// index.css, .tabbar). Le header garde son menu burger pour les liens
// secondaires (Proposer un ultra, Le projet, Admin…).
const tabClass = ({ isActive }) => `tabbar-item${isActive ? " active" : ""}`;

function Icon({ children }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export default function MobileTabBar() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (pathname.startsWith("/admin")) return null;

  const passportPath = user ? "/account" : "/login";
  const onPassport = pathname === "/account" || pathname === "/login";

  return (
    <nav className="tabbar" aria-label="Navigation principale">
      <NavLink to="/" end className={tabClass}>
        <Icon><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></Icon>
        <span>Découvrir</span>
      </NavLink>
      <NavLink to="/carte" className={tabClass}>
        <Icon><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></Icon>
        <span>Carte</span>
      </NavLink>
      <NavLink to="/ultras" className={tabClass}>
        <Icon><path d="M3 6h18M3 12h18M3 18h12" /></Icon>
        <span>Ultras</span>
      </NavLink>
      <NavLink to={passportPath} className={() => tabClass({ isActive: onPassport })}>
        <Icon><rect x="4" y="3" width="16" height="18" rx="2" /><circle cx="12" cy="10" r="3" /><path d="M8 17c1-2 2.5-3 4-3s3 1 4 3" /></Icon>
        <span>Passeport</span>
      </NavLink>
    </nav>
  );
}
