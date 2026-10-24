import { Link, NavLink } from "react-router-dom";

// En-tête commun aux deux onglets de la supervision.
export default function SupervisionHeader({ children }) {
  return (
    <header className="sv-head">
      <div className="sv-head-top">
        <div>
          <div className="sv-eyebrow">Admin</div>
          <h1 className="sv-title">Supervision</h1>
        </div>
        <div className="sv-head-actions">
          <Link to="/" className="sv-btn">Voir le site</Link>
          <Link to="/admin/races?new=1" className="sv-btn sv-btn-primary">+ Nouvel ultra</Link>
        </div>
      </div>
      <div className="sv-tabs-row">
        <nav className="sv-tabs" aria-label="Supervision">
          <NavLink to="/admin" end>Vue d'ensemble</NavLink>
          <NavLink to="/admin/analytics">Analytics</NavLink>
        </nav>
        {children}
      </div>
    </header>
  );
}
