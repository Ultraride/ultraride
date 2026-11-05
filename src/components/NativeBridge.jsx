import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNative } from "../lib/native";
import { initPush } from "../lib/push";
import { isNativeAuthUrl, completeNativeOAuth } from "../lib/nativeAuth";
import { popAfterLogin } from "../lib/authProviders";

// Comportements propres à l'app installée (aucun effet sur le site) :
// notifications, bouton « retour » d'Android, liens ultraride.eu et retour
// de connexion Google / Apple.
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
        // Retour de Google / Apple : on ouvre la session puis on revient
        // là où l'utilisateur était (les nouveaux comptes passent par /bienvenue).
        if (isNativeAuthUrl(url)) {
          completeNativeOAuth(url).then(({ error }) => {
            if (error) navigate(`/login?erreur=${encodeURIComponent(error.message)}`, { replace: true });
            else navigate(popAfterLogin(), { replace: true });
          });
          return;
        }
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
