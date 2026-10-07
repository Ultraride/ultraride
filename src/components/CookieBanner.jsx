import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { analyticsEnabled, getConsent, setConsent, loadGA } from "../lib/analytics";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!analyticsEnabled()) return;
    const c = getConsent();
    if (c === "granted") loadGA();
    if (c === null) setVisible(true);
    const reopen = () => setVisible(true);
    window.addEventListener("ultraride-open-consent", reopen);
    return () => window.removeEventListener("ultraride-open-consent", reopen);
  }, []);

  if (!visible) return null;

  const choose = (value) => {
    setConsent(value);
    setVisible(false);
  };

  return (
    <div className="cookie-banner" role="dialog" aria-live="polite" aria-label="Consentement aux cookies">
      <div className="cookie-banner__text">
        On utilise Google Analytics pour mesurer l'audience du site et l'améliorer.
        Ces cookies ne sont déposés qu'avec ton accord, et tu peux changer d'avis à tout moment.{" "}
        <Link to="/confidentialite#7-cookies-et-stockage-local">En savoir plus</Link>
      </div>
      <div className="cookie-banner__actions">
        <button type="button" className="btn" onClick={() => choose("denied")}>Refuser</button>
        <button type="button" className="btn btn-primary" onClick={() => choose("granted")}>Accepter</button>
      </div>
    </div>
  );
}
