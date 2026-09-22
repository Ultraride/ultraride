import { useEffect, useRef, useState } from "react";

// Description à 5 lignes max, avec bouton "Lire plus" qui déplie le texte
// en place. Partagé entre RaceCard et EventCard pour garder un traitement
// identique (et une hauteur de carte cohérente) partout où une carte
// affiche une description.
export default function ClampedBlurb({ children }) {
  const ref = useRef(null);
  const [truncated, setTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [children, expanded]);

  const toggleExpanded = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  if (!children) return null;

  return (
    <>
      <p
        className="race-card-blurb"
        ref={ref}
        style={expanded ? undefined : { display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {children}
      </p>
      <button
        type="button"
        className="race-card-read-more"
        onClick={toggleExpanded}
        style={{ visibility: truncated ? "visible" : "hidden" }}
        aria-hidden={!truncated}
        tabIndex={truncated ? 0 : -1}
      >
        {expanded ? "Lire moins" : "Lire plus →"}
      </button>
    </>
  );
}
