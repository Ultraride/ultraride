import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// Passer en "_v2" pour réafficher la modale à tout le monde (texte modifié).
const STORAGE_KEY = "ultraride_disclaimer_v1";
const OPEN_DELAY_MS = 600;

// Stockage indisponible (navigation privée, cookies bloqués…) : on se rabat
// sur sessionStorage, puis sur la mémoire de la page.
let dismissedInMemory = false;

function wasDismissed() {
  for (const storage of ["localStorage", "sessionStorage"]) {
    try {
      if (window[storage].getItem(STORAGE_KEY)) return true;
    } catch {
      // stockage inaccessible : on essaie le suivant
    }
  }
  return dismissedInMemory;
}

function rememberDismissal() {
  dismissedInMemory = true;
  for (const storage of ["localStorage", "sessionStorage"]) {
    try {
      window[storage].setItem(STORAGE_KEY, "1");
      return;
    } catch {
      // stockage inaccessible : on essaie le suivant
    }
  }
}

export default function DisclaimerModal() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (wasDismissed()) return;
    const timer = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const close = () => {
    rememberDismissal();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    buttonRef.current?.focus();

    const onKey = (e) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      // Le focus boucle entre les éléments de la modale.
      const focusables = dialogRef.current?.querySelectorAll("button, a[href]");
      if (!focusables?.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!dialogRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="disclaimer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div
        ref={dialogRef}
        className="disclaimer-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
      >
        <h2 id="disclaimer-title" className="disclaimer-title">Bon à savoir</h2>
        <p>
          Les informations présentées sur UltraRide proviennent des organisateurs et de sources publiques.
          Nous faisons de notre mieux pour les tenir à jour, mais des erreurs ou des changements de dernière
          minute restent possibles.
        </p>
        <p>
          Avant de t'inscrire, vérifie toujours les dates, le règlement et les conditions sur le site officiel
          de l'organisateur : lui seul fait foi. UltraRide ne peut être tenu responsable d'éventuelles inexactitudes.
        </p>
        <button ref={buttonRef} type="button" className="disclaimer-button" onClick={close}>
          J'ai compris
        </button>
        <Link to="/cgu#article-7-exactitude-des-informations" className="disclaimer-link" onClick={close}>
          En savoir plus
        </Link>
      </div>
    </div>
  );
}
