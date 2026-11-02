import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNative } from "../lib/native";
import { initPush } from "../lib/push";

// Comportements propres à l'app installée (aucun effet sur le site) :
// notifications, bouton « retour » d'Android et liens ultraride.eu.
export default function NativeBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative) return;
    let cleanups = [];
    initPush(navigate).then((off) => cleanups.push(off)).catch(() => {});
    import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) window.history.back();
        else App.exitApp();
      })
    ).then((h) => cleanups.push(() => h.remove())).catch(() => {});
    // Lien universel (https://ultraride.eu/courses/…) touché dans Messages,
    // Rappels, Mail… : l'app s'ouvre et affiche directement la bonne page.
    import("@capacitor/app").then(({ App }) =>
      App.addListener("appUrlOpen", ({ url }) => {
        try {
          const u = new URL(url);
          if (!/(^|\.)ultraride\.eu$/i.test(u.hostname)) return;
          navigate(`${u.pathname}${u.search}${u.hash}` || "/");
        } catch { /* adresse illisible : on reste où on est */ }
      })
    ).then((h) => cleanups.push(() => h.remove())).catch(() => {});
    return () => cleanups.forEach((f) => f());
  }, [navigate]);

  return null;
}
