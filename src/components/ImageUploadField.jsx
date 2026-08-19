import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Reusable field: paste a URL directly, or upload a file (goes to Supabase
// Storage, bucket "public-images"), with a small preview once set.
export default function ImageUploadField({ label, value, onChange, hint, folder = "uploads" }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);

    const ext = file.name.split(".").pop();
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("public-images").upload(path, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("public-images").getPublicUrl(path);
    onChange(data.publicUrl);
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
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading} style={{ display: "none" }} />
        </label>
      </div>
      {value && <img src={value} alt="" className="image-upload-preview" />}
      {error && <div className="error-box" style={{ marginTop: 6 }}>{error}</div>}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
