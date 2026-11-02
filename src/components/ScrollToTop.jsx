import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Remet la page en haut à chaque nouvel écran. Sans ça, /login s'ouvrait
// défilé au niveau où on avait quitté la fiche (on ne voyait que le bloc
// « Ton passeport ultra », le formulaire restait hors écran).
// On laisse le navigateur gérer le retour arrière (POP) et les ancres (#avis).
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if (navType === "POP" || hash) return;
    window.scrollTo(0, 0);
  }, [pathname, navType, hash]);
  return null;
}
