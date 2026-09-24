import { Link } from "react-router-dom";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <span className="site-footer-logo">ULTRARIDE</span>
        <span className="site-footer-tagline">Ultra-cycling almanac</span>
      </div>
      <nav className="site-footer-links">
        <Link to="/cgu">Conditions générales d'utilisation</Link>
        <span aria-hidden="true">·</span>
        <Link to="/confidentialite">Politique de confidentialité</Link>
        <span aria-hidden="true">·</span>
        <a href="mailto:hello@ultraride.eu">Contact</a>
      </nav>
      <div className="site-footer-legal">
        © 2026 UltraRide · édité par l'association Beyond The Track
      </div>
    </footer>
  );
}
