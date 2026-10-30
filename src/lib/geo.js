import { isNative } from "./native";

// Position de l'utilisateur, en natif (iOS / Android) ou dans le navigateur.
// Renvoie { lat, lon } ou lève une erreur dont le message vaut
// "denied" ou "unsupported".
const OPTIONS = { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 };

export async function getPosition() {
  if (isNative) {
    const { Geolocation } = await import("@capacitor/geolocation");
    let perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted" && perm.coarseLocation !== "granted") {
      perm = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
      if (perm.location !== "granted" && perm.coarseLocation !== "granted") throw new Error("denied");
    }
    try {
      const pos = await Geolocation.getCurrentPosition(OPTIONS);
      return { lat: pos.coords.latitude, lon: pos.coords.longitude };
    } catch {
      throw new Error("denied");
    }
  }
  if (!("geolocation" in navigator)) throw new Error("unsupported");
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => reject(new Error("denied")),
      OPTIONS
    );
  });
}

// La permission a-t-elle déjà été accordée ? Permet de localiser sans
// redemander, sans jamais déclencher la fenêtre d'autorisation.
export async function geoAlreadyGranted() {
  try {
    if (isNative) {
      const { Geolocation } = await import("@capacitor/geolocation");
      const perm = await Geolocation.checkPermissions();
      return perm.location === "granted" || perm.coarseLocation === "granted";
    }
    if (!navigator.permissions?.query) return false;
    const res = await navigator.permissions.query({ name: "geolocation" });
    return res.state === "granted";
  } catch {
    return false;
  }
}
