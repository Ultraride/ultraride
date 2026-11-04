import { useState } from "react";
import { useAuth } from "../lib/AuthContext";
import { compressImage, formatBytes } from "../lib/compressImage";
import { uploadImage } from "../lib/mediaUpload";

// Le SVG peut embarquer du script : seul l'admin peut en téléverser.
const BASE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const FORMAT_ERROR = "Format non autorisé : PNG, JPEG, WebP ou GIF uniquement.";

// Les logos s'affichent en petit : 600 px de large suffisent largement.
const MAX_WIDTH_BY_FOLDER = { organizers: 600 };

// Champ réutilisable : coller une URL, ou envoyer un fichier (compressé dans
// le navigateur puis hébergé chez OVH, dossier /media/), avec un aperçu.
// Le cache navigateur d'un an est réglé par public/media/.htaccess.
export default function ImageUploadField({ label, value, onChange, hint, folder = "uploads" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [sizeInfo, setSizeInfo] = useState(null);
  const { isAdmin } = useAuth();
  const allowedTypes = isAdmin ? [...BASE_TYPES, "image/svg+xml"] : BASE_TYPES;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSizeInfo(null);

    // `accept` n'est qu'une suggestion au sélecteur de fichiers.
    if (!allowedTypes.includes(file.type)) {
      setError(FORMAT_ERROR);
      e.target.value = "";
      return;
    }
    setUploading(true);

    let result;
    try {
      result = await compressImage(file, { maxWidth: MAX_WIDTH_BY_FOLDER[folder] || 1600 });
    } catch {
      // Image illisible par le navigateur : on envoie l'original.
      result = { blob: file, contentType: file.type, originalSize: file.size, newSize: file.size };
    }
    const compressed = result.contentType === "image/webp" && result.blob !== file;

    const ext = compressed ? "webp" : file.name.split(".").pop();
    let uploaded;
    try {
      // Le serveur choisit le nom (aléatoire) et vérifie le vrai format.
      uploaded = await uploadImage(result.blob, { folder, filename: `image.${ext}` });
    } catch (err) {
      setError(err.status === 415 ? FORMAT_ERROR : err.message);
      e.target.value = "";
      setUploading(false);
      return;
    }

    onChange(uploaded.url);
    setSizeInfo(
      compressed
        ? `Image optimisée : ${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)}`
        : `Image envoyée telle quelle : ${formatBytes(result.originalSize)}`
    );
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div className="field">
      <label>{label}</label>
      <div className="image-upload-row">
        <input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... (ou choisis un fichier)"
        />
        <label className="btn image-upload-btn">
          {uploading ? "Envoi…" : "Choisir un fichier"}
          <input type="file" accept={allowedTypes.join(",")} onChange={handleFile} disabled={uploading} style={{ display: "none" }} />
        </label>
      </div>
      {value && <img src={value} alt="" className="image-upload-preview" loading="lazy" decoding="async" />}
      {sizeInfo && <div className="field-hint">{sizeInfo}</div>}
      {error && <div className="error-box" style={{ marginTop: 6 }}>{error}</div>}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
