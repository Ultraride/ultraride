import { useEffect, useState } from "react";

// Même seuil que le reste du site (cf. index.css) : sous 820px, on passe
// en mode application (écrans dédiés + barre d'onglets).
export const MOBILE_QUERY = "(max-width: 819px)";

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}
