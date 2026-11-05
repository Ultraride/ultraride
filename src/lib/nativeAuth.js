import { supabase } from "./supabaseClient";

// Connexion Google / Apple dans l'app installée.
// Google refuse les WebViews : on ouvre la page de connexion dans le
// navigateur intégré du système (SFSafariViewController / Custom Tabs),
// puis Supabase renvoie vers eu.ultraride.app://auth/callback, que l'app
// intercepte (NativeBridge → appUrlOpen).
export const NATIVE_AUTH_REDIRECT = "eu.ultraride.app://auth/callback";

export function isNativeAuthUrl(url) {
  return typeof url === "string" && url.toLowerCase().startsWith("eu.ultraride.app://auth");
}

export async function openNativeOAuth(url) {
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url, presentationStyle: "popover" });
}

// Lit les jetons renvoyés par Supabase (#access_token=…&refresh_token=…,
// ou ?code=… en flux PKCE) et ouvre la session dans l'app.
export async function completeNativeOAuth(url) {
  try {
    const { Browser } = await import("@capacitor/browser");
    Browser.close().catch(() => {});
  } catch { /* plugin absent : rien à fermer */ }

  const hashIdx = url.indexOf("#");
  const queryIdx = url.indexOf("?");
  const params = new URLSearchParams();
  if (queryIdx !== -1) new URLSearchParams(url.slice(queryIdx + 1, hashIdx === -1 ? undefined : hashIdx)).forEach((v, k) => params.set(k, v));
  if (hashIdx !== -1) new URLSearchParams(url.slice(hashIdx + 1)).forEach((v, k) => params.set(k, v));

  const err = params.get("error_description") || params.get("error");
  if (err) return { error: new Error(err.replace(/\+/g, " ")) };

  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    return { error };
  }
  const code = params.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error };
  }
  return { error: new Error("Réponse de connexion incomplète.") };
}
