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
export async function pushPermission() {
  if (!isNative) return "unsupported";
  try {
    const { receive } = await (await plugin()).checkPermissions();
    return receive === "granted" ? "granted" : receive === "denied" ? "denied" : "prompt";
  } catch {
    return "unsupported";
  }
}

async function applyTopics(prefs) {
  const fm = await plugin();
  await fm.getToken(); // enregistre l'appareil auprès de Firebase
  await Promise.all(Object.entries(TOPICS).map(([key, { topic }]) =>
    (prefs[key] ? fm.subscribeToTopic({ topic }) : fm.unsubscribeFromTopic({ topic })).catch(() => {})
  ));
}

// Active / désactive les sujets. Demande l'autorisation si besoin.
// Renvoie les préférences effectivement appliquées.
export async function setPushPrefs(next) {
  if (!isNative) return getPushPrefs();
  const wantsAny = Object.values(next).some(Boolean);
  if (wantsAny) {
    const fm = await plugin();
    let perm = await pushPermission();
    if (perm === "prompt") {
      const { receive } = await fm.requestPermissions();
      perm = receive === "granted" ? "granted" : "denied";
    }
    if (perm !== "granted") {
      const off = { newRaces: false, updates: false };
      writeJson(PREFS_KEY, off);
      throw new Error("denied");
    }
  }
  writeJson(PREFS_KEY, next);
  await applyTopics(next);
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
