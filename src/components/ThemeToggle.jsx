import { useEffect, useState } from "react";

// Thème : "light", "dark" ou "auto" (suit le réglage de l'appareil).
// Le choix est mémorisé dans le navigateur ; index.html l'applique avant le
// premier rendu pour éviter un flash de la mauvaise couleur.
const KEY = "ultraride_theme";
const ORDER = ["auto", "light", "dark"];
const LABEL = { auto: "Auto", light: "Clair", dark: "Sombre" };

function readTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return ORDER.includes(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
  try { localStorage.setItem(KEY, mode); } catch { /* stockage indisponible */ }
}

function useTheme() {
  const [mode, setMode] = useState(readTheme);
  useEffect(() => { applyTheme(mode); }, [mode]);
  // Un autre onglet change le thème : on suit.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === KEY) setMode(readTheme()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return [mode, setMode];
}

function Icon({ mode }) {
  if (mode === "light") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (mode === "dark") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  );
}

// Bouton compact de l'en-tête : un clic passe Auto → Clair → Sombre.
export function ThemeCycleButton() {
  const [mode, setMode] = useTheme();
  const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setMode(next)}
      aria-label={`Thème : ${LABEL[mode]}. Passer en ${LABEL[next].toLowerCase()}`}
      title={`Thème : ${LABEL[mode]}`}
    >
      <Icon mode={mode} />
    </button>
  );
}

// Choix explicite à trois boutons, pour le menu mobile.
export function ThemeSegmented() {
  const [mode, setMode] = useTheme();
  return (
    <div className="theme-seg" role="group" aria-label="Thème">
      {ORDER.map((m) => (
        <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}>
          <Icon mode={m} />{LABEL[m]}
        </button>
      ))}
    </div>
  );
}
