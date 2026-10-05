import { supabase } from "./supabaseClient";

const BOT_RE = /bot|crawl|spider|slurp|preview|lighthouse|headless|facebookexternalhit|embedly|whatsapp|telegram|discord|google-inspectiontool|gptbot|claude|perplexity|bytespider|ahrefs|semrush|mj12/i;

// Compte une visite par session de navigation (onglet), sans cookie ni donnée personnelle.
// Les robots sont comptés séparément.
export function trackVisit() {
  try {
    const isBot = navigator.webdriver === true || BOT_RE.test(navigator.userAgent || "");
    const key = isBot ? "ur_visit_bot" : "ur_visit";
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    supabase.rpc("track_visit", { p_bot: isBot }).then(() => {}, () => {});
  } catch (_) {}
}
