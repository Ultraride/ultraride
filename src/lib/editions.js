import { supabase } from "./supabaseClient";

// Colonnes reprises telles quelles dans la nouvelle édition. Les dates,
// l'heure de départ, le statut et les compteurs repartent de zéro ;
// `edition` est attribuée par le trigger `races_assign_edition`.
const COPIED_COLUMNS = [
  "name", "country", "discipline", "format", "mode", "parcours", "month", "km", "dplus",
  "lat", "lon", "start_lat", "start_lon", "end_lat", "end_lon", "turn_lat", "turn_lon",
  "start_place", "end_place", "organizer_name", "organizer_id", "terrain",
  "blurb", "long_blurb", "image_url", "registration_url", "event_name", "event_slug",
  "price", "created_by",
];

function nextYear(race) {
  const base = race.next_edition || (race.start_date ? String(race.start_date).slice(0, 4) : "");
  const year = parseInt(base, 10);
  return Number.isFinite(year) ? String(year + 1) : null;
}

// Crée l'édition suivante d'un ultra, en attente de validation.
// Renvoie la nouvelle fiche complète, prête à ouvrir dans RaceForm.
export async function createNextEdition(race) {
  const payload = {};
  for (const key of COPIED_COLUMNS) {
    if (key in race) payload[key] = race[key];
  }
  payload.lineage_id = race.lineage_id;
  payload.start_date = null;
  payload.end_date = null;
  payload.departure_time = null;
  payload.open = true;
  payload.status = "pending";
  payload.next_edition = nextYear(race);

  return supabase.from("races").insert(payload).select("*").single();
}
