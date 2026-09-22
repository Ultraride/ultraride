import { useEffect, useRef, useState } from "react";

// Description à 5 lignes fixes (98px, pas juste un max) avec bouton "Lire
// plus" qui déplie le texte en place. Le zone est toujours rendue, même
// sans texte, pour que toutes les cartes réservent la même hauteur.
// Contrôlé par le parent (expanded/onToggle) : la carte fixe (300x480) doit
// relâcher sa contrainte de hauteur pendant l'expansion, ce que seul le
// parent peut faire sur son propre conteneur.
export default function ClampedBlurb({ children, expanded, onToggle }) {
  const ref = useRef(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    const check = () => setTruncated(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [children, expanded]);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  };

  return (
    <>
      <p
        className="race-card-blurb"
        ref={ref}
        style={
          expanded
            ? undefined
            : { display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden", height: 98 }
        }
      >
        {children}
      </p>
      <button
        type="button"
        className="race-card-read-more"
        onClick={handleClick}
        style={{ visibility: truncated ? "visible" : "hidden" }}
        aria-hidden={!truncated}
        tabIndex={truncated ? 0 : -1}
      >
        {expanded ? "Lire moins" : "Lire plus →"}
      </button>
    </>
  );
}
