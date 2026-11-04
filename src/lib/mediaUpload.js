import { supabase } from "./supabaseClient";

// Les images (logos, visuels d'ultras) sont hébergées chez OVH, sur le même
// serveur que le site : trafic illimité, contrairement au quota de 5 Go/mois
// du Storage Supabase gratuit. URLs absolues pour qu'elles marchent aussi
// depuis ultraride.pages.dev, l'app mobile et le dev local.
export const MEDIA_ORIGIN = "https://ultraride.eu";
export const MEDIA_BASE = `${MEDIA_ORIGIN}/media/`;
const UPLOAD_URL = `${MEDIA_ORIGIN}/api/upload-image.php`;

// Envoie une image à public/api/upload-image.php. `folder` : organizers,
// races ou uploads (nom aléatoire choisi par le serveur). `path` : chemin
// imposé, admin uniquement (copie de l'ancien bucket).
// Renvoie { url, path, exists? } ; lève une Error portant `status`.
export async function uploadImage(blob, { folder, path, filename = "image" } = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Connexion requise pour envoyer une image.");

  const form = new FormData();
  form.append("token", token);
  if (folder) form.append("folder", folder);
  if (path) form.append("path", path);
  form.append("file", blob, filename);

  let res;
  try {
    res = await fetch(UPLOAD_URL, { method: "POST", body: form });
  } catch {
    throw new Error("Serveur d'images injoignable, réessaie dans un instant.");
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    // Réponse non JSON (page d'erreur du serveur) : message générique.
  }
  if (!res.ok || !json?.url) {
    const err = new Error(json?.error || `Envoi refusé (erreur ${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return json;
}
