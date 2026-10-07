import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/analytics";

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    // petit délai pour laisser la page mettre à jour document.title
    const t = setTimeout(() => trackPageView(location.pathname + location.search), 50);
    return () => clearTimeout(t);
  }, [location.pathname, location.search]);

  useEffect(() => {
    // page vue initiale juste après acceptation du consentement
    const onConsent = (e) => {
      if (e.detail === "granted" && !window.location.pathname.startsWith("/admin")) {
        setTimeout(() => trackPageView(window.location.pathname + window.location.search), 300);
      }
    };
    window.addEventListener("ultraride-consent-change", onConsent);
    return () => window.removeEventListener("ultraride-consent-change", onConsent);
  }, []);

  return null;
}
