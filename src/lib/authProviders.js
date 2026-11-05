// Lit /auth/v1/settings (public) pour n'afficher que les fournisseurs
// réellement activés dans Supabase → Authentication → Providers.
let cache = null;

export function getEnabledProviders() {
  if (cache) return cache;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  cache = fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => ({ google: !!s?.external?.google, apple: !!s?.external?.apple }))
    .catch(() => ({ google: false, apple: false }));
  return cache;
}

export const AFTER_LOGIN_KEY = "ur_after_login";

export function rememberAfterLogin(path) {
  try { sessionStorage.setItem(AFTER_LOGIN_KEY, path || "/account"); } catch { /* ignore */ }
}

export function popAfterLogin() {
  try {
    const p = sessionStorage.getItem(AFTER_LOGIN_KEY);
    sessionStorage.removeItem(AFTER_LOGIN_KEY);
    return p && p.startsWith("/") && !p.startsWith("//") ? p : "/account";
  } catch {
    return "/account";
  }
}

// Messages d'erreur Supabase Auth → français.
export function authErrorFr(error) {
  if (!error) return null;
  const msg = (error.message || "").toLowerCase();
  const code = error.code || "";
  if (error.status === 429 || code.includes("rate_limit") || msg.includes("rate limit") || msg.includes("security purposes"))
    return "Patiente une minute avant de redemander un code.";
  if (code === "otp_expired" || msg.includes("expired") || msg.includes("token"))
    return "Code invalide ou expiré. Vérifie les chiffres ou demande un nouveau code.";
  if (code === "otp_disabled" || msg.includes("signups not allowed"))
    return "NO_ACCOUNT";
  return error.message;
}
