import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Liste des ultras publiés, chargée une seule fois et partagée entre les
// onglets Découvrir / Ultras / Carte : passer d'un onglet à l'autre est
// instantané, comme dans une app.
const FIELDS =
  "id, name, country, discipline, format, mode, parcours, month, km, dplus, price, open, lat, lon, start_lat, start_lon, start_place, end_place, start_date, created_at, view_count, blurb, image_url, event_name, event_slug, organizer:organizers!races_organizer_id_fkey(id, name, logo_url)";

let cache = null;
let pending = null;

function load() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = supabase
      .from("races")
      .select(FIELDS)
      .eq("status", "published")
      .then(({ data, error }) => {
        pending = null;
        if (error) throw new Error(error.message);
        cache = data || [];
        return cache;
      });
  }
  return pending;
}

export function useRaces() {
  const [races, setRaces] = useState(cache);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (cache) return;
    let alive = true;
    load()
      .then((d) => alive && setRaces(d))
      .catch((e) => alive && setError(e.message));
    return () => { alive = false; };
  }, []);
  return { races, error };
}

export const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const MONTHS_SHORT = ["JANV.","FÉVR.","MARS","AVR.","MAI","JUIN","JUIL.","AOÛT","SEPT.","OCT.","NOV.","DÉC."];

export function normalize(str) {
  return (str || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function parseDate(s) {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

// Jours restants avant le départ, null si la date est inconnue ou passée.
export function daysUntil(race) {
  const d = parseDate(race.start_date);
  if (!d) return null;
  const n = Math.round((d - startOfToday()) / 86400000);
  return n >= 0 ? n : null;
}

export function isUpcoming(race) {
  const d = parseDate(race.start_date);
  return d ? d >= startOfToday() : false;
}

export function formatDate(race, { short = false } = {}) {
  const d = parseDate(race.start_date);
  if (!d) return race.month ? `${race.month}${short ? "" : " (date à confirmer)"}` : "Date à confirmer";
  return d.toLocaleDateString("fr-FR", short ? { day: "numeric", month: "short" } : { day: "numeric", month: "long", year: "numeric" });
}

export function dateTile(race) {
  const d = parseDate(race.start_date);
  if (d) return { big: String(d.getDate()), small: MONTHS_SHORT[d.getMonth()] };
  const i = MONTHS.indexOf(race.month);
  return { big: "—", small: i >= 0 ? MONTHS_SHORT[i] : "À VENIR" };
}

// Ordre chronologique : les départs à venir d'abord (par date), puis les
// fiches sans date précise, puis les éditions passées.
export function chronoRank(race) {
  const d = parseDate(race.start_date);
  const today = startOfToday();
  if (d && d >= today) return d.getTime();
  if (!d) {
    const i = MONTHS.indexOf(race.month);
    return 8e15 + (i >= 0 ? i : 12);
  }
  return 9e15 + d.getTime();
}

export function groupLabel(race) {
  const d = parseDate(race.start_date);
  if (d && d >= startOfToday()) return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  if (!d) return "Date à confirmer";
  return "Éditions passées";
}

export function formatNumber(n) {
  return n == null ? null : Math.round(Number(n)).toLocaleString("fr-FR");
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function startCoords(race) {
  const lat = race.start_lat ?? race.lat;
  const lon = race.start_lon ?? race.lon;
  return lat == null || lon == null ? null : [lat, lon];
}

export function matchesSearch(race, q) {
  if (!q) return true;
  const hay = normalize([
    race.name, race.country, race.discipline, race.format, race.mode, race.month,
    race.start_place, race.end_place, race.blurb, race.organizer?.name,
  ].filter(Boolean).join(" "));
  return hay.includes(normalize(q));
}

// Géolocalisation : jamais déclenchée sans action du visiteur, sauf si la
// permission a déjà été accordée lors d'une visite précédente.
let lastCoords = null;
export function useGeo() {
  const [coords, setCoords] = useState(lastCoords);
  const [status, setStatus] = useState(lastCoords ? "granted" : "idle");

  const request = () => {
    if (!("geolocation" in navigator)) { setStatus("unsupported"); return; }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(lastCoords);
        setStatus("granted");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  };

  useEffect(() => {
    if (lastCoords || !navigator.permissions?.query) return;
    navigator.permissions.query({ name: "geolocation" })
      .then((res) => { if (res.state === "granted") request(); })
      .catch(() => {});
  }, []);

  return { coords, status, request };
}
