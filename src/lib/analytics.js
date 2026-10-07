const GA_ID = import.meta.env.VITE_GA_ID;
const CONSENT_KEY = "ultraride_cookie_consent";
const CONSENT_MAX_AGE_MS = 13 * 30 * 24 * 60 * 60 * 1000; // 13 mois (recommandation CNIL)

export const analyticsEnabled = () => Boolean(GA_ID);

export function getConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const { value, date } = JSON.parse(raw);
    if (Date.now() - date > CONSENT_MAX_AGE_MS) {
      localStorage.removeItem(CONSENT_KEY);
      return null;
    }
    return value; // "granted" | "denied"
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ value, date: Date.now() }));
  } catch {}
  window.dispatchEvent(new CustomEvent("ultraride-consent-change", { detail: value }));
  if (value === "granted") loadGA();
  else removeGACookies();
}

let loaded = false;

export function loadGA() {
  if (loaded || !GA_ID) return;
  loaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  // send_page_view: false -> les pages vues sont envoyées manuellement à chaque changement de route
  window.gtag("config", GA_ID, { send_page_view: false });
}

export function trackPageView(path) {
  if (!loaded || !window.gtag) return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

function removeGACookies() {
  const domains = [window.location.hostname, "." + window.location.hostname.replace(/^www\./, "")];
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name.startsWith("_ga")) {
      domains.forEach((d) => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`;
      });
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
  if (loaded) window.location.reload(); // décharge gtag déjà présent en mémoire
}

export function openConsentBanner() {
  window.dispatchEvent(new CustomEvent("ultraride-open-consent"));
}
