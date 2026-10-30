import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNative } from "../lib/native";
import { initPush } from "../lib/push";

// Comportements propres à l'app installée (aucun effet sur le site) :
// notifications, et bouton « retour » d'Android.
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
    return () => cleanups.forEach((f) => f());
  }, [navigate]);

  return null;
}
