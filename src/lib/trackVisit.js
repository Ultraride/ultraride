import { supabase } from "./supabaseClient";

// Compte une visite par session de navigation (onglet), sans cookie ni donnée personnelle.
export function trackVisit() {
  try {
    if (sessionStorage.getItem("ur_visit")) return;
    if (navigator.webdriver || /bot|crawl|spider|preview|lighthouse/i.test(navigator.userAgent)) return;
    sessionStorage.setItem("ur_visit", "1");
    supabase.rpc("track_visit").then(() => {}, () => {});
  } catch (_) {}
}
