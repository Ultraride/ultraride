import { isNative, platform } from "./native";

// Notifications de l'app mobile (Firebase Cloud Messaging, par « topics ») :
// aucune donnée personnelle n'est envoyée au serveur, chaque téléphone
// s'abonne simplement aux sujets qui l'intéressent.
export const TOPICS = {
  newRaces: { topic: "nouveaux-ultras", label: "Nouveaux ultras", hint: "Dès qu'un ultra est ajouté à l'annuaire." },
  updates: { topic: "mises-a-jour", label: "Ultras mis à jour", hint: "Quand des fiches changent : dates, parcours, inscriptions." },
};

const PREFS_KEY = "ur-push-prefs";
const ASKED_KEY = "ur-push-asked";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}

export function getPushPrefs() {
  return readJson(PREFS_KEY, { newRaces: false, updates: false });
}

// L'invitation de l'accueil n'est montrée qu'une fois.
export function pushInviteSeen() { return readJson(ASKED_KEY, false); }
export function markPushInviteSeen() { writeJson(ASKED_KEY, true); }

// Une attente qui ne répond jamais (module, autorisation, jeton Apple…)
// est coupée pour afficher l'erreur au lieu de bloquer l'interrupteur.
function withTimeout(promise, ms, message) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}

let pluginPromise = null;
function plugin() {
  if (!pluginPromise) {
    log("chargement du module FirebaseMessaging…");
    import("@capacitor/core").then(({ Capacitor }) =>
      log("plugin natif enregistré :", Capacitor.isPluginAvailable("FirebaseMessaging"))
    ).catch(() => {});
    // Surtout ne jamais résoudre une promesse avec le proxy du plugin :
    // il répond à tous les noms de méthode, y compris "then", et JavaScript
    // le prendrait pour une promesse qui ne se termine jamais (d'où des
    // interrupteurs restés bloqués). On transporte le module, pas le proxy.
    pluginPromise = import("@capacitor-firebase/messaging").then(
      (m) => { log("module chargé"); return m; },
      (e) => { pluginPromise = null; log("échec du chargement :", e?.message || e); throw e; }
    );
  }
  return withTimeout(pluginPromise, 10000, "module FirebaseMessaging sans réponse après 10 s");
}

// "granted" | "denied" | "prompt" | "unsupported"
// Journal visible dans la console Xcode / Android Studio (filtre : UR-push).
const log = (...a) => console.log("[UR-push]", ...a);

export async function pushPermission() {
  if (!isNative) return "unsupported";
  try {
    const { FirebaseMessaging: fm } = await plugin();
    log("checkPermissions…");
    const { receive } = await withTimeout(fm.checkPermissions(), 10000, "checkPermissions sans réponse après 10 s");
    log("checkPermissions →", receive);
    return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
  } catch (e) {
    log("checkPermissions erreur :", e?.message || e);
    return "unsupported";
  }
}

async function applyTopics(prefs) {
  const { FirebaseMessaging: fm } = await plugin();
  // Enregistre l'appareil auprès de Firebase.
  log("getToken…");
  try {
    const { token } = await withTimeout(fm.getToken(), 15000, "aucun jeton reçu d'Apple (APNs) après 15 s");
    log("getToken OK", token ? token.slice(0, 12) + "…" : token);
  } catch (e) {
    log("getToken erreur :", e?.message || e);
    throw e;
  }
  await Promise.all(Object.entries(TOPICS).map(([key, { topic }]) =>
    (prefs[key] ? fm.subscribeToTopic({ topic }) : fm.unsubscribeFromTopic({ topic }))
      .then(() => log((prefs[key] ? "abonné à " : "désabonné de ") + topic))
      .catch((e) => log("topic " + topic + " erreur :", e?.message || e))
  ));
}

// Active / désactive les sujets. Demande l'autorisation si besoin.
// Renvoie les préférences effectivement appliquées.
export async function setPushPrefs(next) {
  log("setPushPrefs", next, "isNative=" + isNative);
  if (!isNative) return getPushPrefs();
  const wantsAny = Object.values(next).some(Boolean);
  if (wantsAny) {
    const { FirebaseMessaging: fm } = await plugin();
    let perm = await pushPermission();
    log("setPushPrefs, permission =", perm);
    if (perm === "prompt") {
      log("requestPermissions…");
      const { receive } = await withTimeout(fm.requestPermissions(), 60000, "requestPermissions sans réponse après 60 s");
      log("requestPermissions →", receive);
      perm = receive === "granted" ? "granted" : "denied";
    }
    if (perm !== "granted") {
      const off = { newRaces: false, updates: false };
      writeJson(PREFS_KEY, off);
      throw new Error(perm === "unsupported" ? "module de notifications indisponible dans l'app" : "denied");
    }
  }
  // On n'enregistre le choix qu'une fois l'inscription réussie.
  await applyTopics(next);
  writeJson(PREFS_KEY, next);
  return next;
}

// Coupe tout et oublie l'appareil (suppression de compte, déconnexion…).
export async function disablePush() {
  writeJson(PREFS_KEY, { newRaces: false, updates: false });
  if (!isNative) return;
  try {
    const { FirebaseMessaging: fm } = await plugin();
    await Promise.all(Object.values(TOPICS).map(({ topic }) => fm.unsubscribeFromTopic({ topic }).catch(() => {})));
    await fm.deleteToken();
  } catch { /* rien à faire */ }
}

// Au démarrage de l'app : canal Android, ouverture de la bonne page quand
// on touche une notification, et ré-abonnement silencieux.
export async function initPush(navigate) {
  if (!isNative) return () => {};
  const { FirebaseMessaging: fm } = await plugin();
  if (platform === "android") {
    await fm.createChannel({ id: "ultras", name: "Ultras", description: "Nouveaux ultras et mises à jour", importance: 3 }).catch(() => {});
  }
  const handle = await fm.addListener("notificationActionPerformed", (event) => {
    const url = event?.notification?.data?.url;
    if (typeof url === "string" && url.startsWith("/")) navigate(url);
  });
  if ((await pushPermission()) === "granted") applyTopics(getPushPrefs()).catch(() => {});
  return () => handle.remove();
}
