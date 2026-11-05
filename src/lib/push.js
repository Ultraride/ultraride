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

async function plugin() {
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
  return FirebaseMessaging;
}

// "granted" | "denied" | "prompt" | "unsupported"
// Journal temporaire de diagnostic, affiché aussi à l'écran Notifications.
const trace = [];
const traceListeners = new Set();
export function onPushTrace(fn) { traceListeners.add(fn); fn([...trace]); return () => traceListeners.delete(fn); }
const t0 = Date.now();
const log = (...a) => {
  console.log("[UR-push]", ...a);
  trace.push(`${((Date.now() - t0) / 1000).toFixed(1)}s ${a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" ")}`);
  traceListeners.forEach((fn) => fn([...trace]));
};

export async function pushPermission() {
  if (!isNative) return "unsupported";
  try {
    log("checkPermissions…");
    const { receive } = await withTimeout((await plugin()).checkPermissions(), 10000, "checkPermissions sans réponse après 10 s");
    log("checkPermissions →", receive);
    return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
  } catch (e) {
    log("checkPermissions erreur :", e?.message || e);
    return "unsupported";
  }
}

// Si Apple ne délivre jamais le jeton APNs, getToken() peut attendre
// indéfiniment : on coupe au bout de 15 s pour afficher l'erreur.
function withTimeout(promise, ms, message) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))]);
}

async function applyTopics(prefs) {
  const fm = await plugin();
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
    const fm = await plugin();
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
    const fm = await plugin();
    await Promise.all(Object.values(TOPICS).map(({ topic }) => fm.unsubscribeFromTopic({ topic }).catch(() => {})));
    await fm.deleteToken();
  } catch { /* rien à faire */ }
}

// Au démarrage de l'app : canal Android, ouverture de la bonne page quand
// on touche une notification, et ré-abonnement silencieux.
export async function initPush(navigate) {
  if (!isNative) return () => {};
  const fm = await plugin();
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
