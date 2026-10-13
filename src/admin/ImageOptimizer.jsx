import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { compressImage, formatBytes } from "../lib/compressImage";

const BUCKET = "public-images";
const BULK_THRESHOLD = 300 * 1024;
const MIN_GAIN = 0.2;
const CACHE_CONTROL = "31536000";
const PAGE = 1000;

function isLogo(path) {
  return /logo/i.test(path) || path.startsWith("organizers/");
}

// Parcours récursif du bucket. Dans la réponse de list(), un dossier n'a ni
// id ni metadata.
async function listAll(prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`${prefix || "/"} : ${error.message}`);
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || !item.metadata) {
        files.push(...(await listAll(path)));
      } else if (item.name !== ".emptyFolderPlaceholder") {
        files.push({ path, size: item.metadata.size ?? 0, type: item.metadata.mimetype || "" });
      }
    }
    if (data.length < PAGE) break;
  }
  return files;
}

// download() passe par l'API authentifiée (policies Storage) ; si elle refuse,
// le bucket étant public, on relit le fichier par son URL publique.
async function downloadFile(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (!error && data) return data;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const res = await fetch(`${pub.publicUrl}?t=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Téléchargement impossible : ${error?.message || res.status}`);
  return res.blob();
}

export default function ImageOptimizer() {
  const [files, setFiles] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [status, setStatus] = useState({});
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);

  useEffect(() => {
    listAll()
      .then((list) => setFiles(list.sort((a, b) => b.size - a.size)))
      .catch((e) => setLoadError(e.message));
  }, []);

  const totalSize = useMemo(() => (files || []).reduce((n, f) => n + f.size, 0), [files]);

  const savedSoFar = useMemo(
    () => Object.values(status).reduce((n, s) => n + (s.state === "done" ? s.before - s.after : 0), 0),
    [status]
  );

  const setFileStatus = (path, s) => setStatus((prev) => ({ ...prev, [path]: s }));

  const optimize = async (file) => {
    setFileStatus(file.path, { state: "working" });
    try {
      const original = await downloadFile(file.path);
      const result = await compressImage(original, { maxWidth: isLogo(file.path) ? 600 : 1600 });
      const gain = 1 - result.newSize / result.originalSize;

      if (result.blob === original || gain < MIN_GAIN) {
        setFileStatus(file.path, { state: "skipped", before: result.originalSize });
        return;
      }

      // Même chemin, même URL : rien à modifier en base, même si l'extension
      // (.png, .jpg) ne correspond plus au contenu WebP. Le navigateur se fie
      // au Content-Type envoyé par le Storage, pas à l'extension.
      const { error } = await supabase.storage.from(BUCKET).upload(file.path, result.blob, {
        upsert: true,
        contentType: result.blob.type,
        cacheControl: CACHE_CONTROL,
      });
      if (error) throw new Error(error.message);

      setFileStatus(file.path, {
        state: "done",
        before: result.originalSize,
        after: result.newSize,
        version: Date.now(),
      });
      setFiles((list) => list.map((f) => (f.path === file.path ? { ...f, size: result.newSize, type: result.blob.type } : f)));
    } catch (e) {
      setFileStatus(file.path, { state: "error" });
      setErrors((list) => [...list, `${file.path} : ${e.message}`]);
    }
  };

  const optimizeOne = async (file) => {
    setBusy(true);
    await optimize(file);
    setBusy(false);
  };

  const optimizeAll = async () => {
    const queue = files.filter(
      (f) => f.size > BULK_THRESHOLD && !["done", "skipped"].includes(status[f.path]?.state)
    );
    if (queue.length === 0) return;
    setBusy(true);
    setErrors([]);
    for (let i = 0; i < queue.length; i += 1) {
      setProgress({ done: i, total: queue.length, current: queue[i].path });
      await optimize(queue[i]);
    }
    setProgress({ done: queue.length, total: queue.length, current: null });
    setBusy(false);
  };

  const bulkCount = (files || []).filter(
    (f) => f.size > BULK_THRESHOLD && !["done", "skipped"].includes(status[f.path]?.state)
  ).length;

  return (
    <div>
      <h1 className="h1">Images</h1>
      <p className="muted" style={{ marginTop: -8, marginBottom: 16 }}>
        Recompression en WebP des images du Storage, au même chemin : les URLs enregistrées en base ne
        changent pas.
      </p>

      {loadError && <div className="error-box">Lecture du bucket impossible : {loadError}</div>}
      {errors.map((e, i) => (
        <div key={i} className="error-box">{e}</div>
      ))}

      {files === null && !loadError ? (
        <p className="muted">Chargement de la liste des fichiers…</p>
      ) : files && (
        <>
          <div className="panel" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="mono" style={{ fontSize: 13 }}>
                {files.length} fichier{files.length !== 1 ? "s" : ""} · {formatBytes(totalSize)}
                {savedSoFar > 0 && (
                  <span style={{ color: "var(--moss)" }}> · {formatBytes(savedSoFar)} économisés</span>
                )}
              </div>
              <button className="btn btn-primary" onClick={optimizeAll} disabled={busy || bulkCount === 0}>
                Optimiser toutes les images &gt; 300 Ko ({bulkCount})
              </button>
            </div>
            {files.length === 0 && (
              <p className="field-hint">
                Aucun fichier listé. Si le bucket n'est pas vide, il manque probablement une policy SELECT
                sur storage.objects pour les admins.
              </p>
            )}
            {progress && (
              <div style={{ marginTop: 12 }}>
                <div className="ig-progress">
                  <div style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
                <div className="muted mono" style={{ fontSize: 11, marginTop: 4 }}>
                  {progress.current
                    ? `${progress.done + 1} / ${progress.total} · ${progress.current}`
                    : `Terminé : ${progress.total} fichier${progress.total !== 1 ? "s" : ""} traité${progress.total !== 1 ? "s" : ""} · ${formatBytes(savedSoFar)} économisés au total`}
                </div>
              </div>
            )}
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th></th>
                <th>Fichier</th>
                <th>Taille</th>
                <th>Résultat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => {
                const s = status[f.path] || {};
                const { data } = supabase.storage.from(BUCKET).getPublicUrl(f.path);
                const src = s.version ? `${data.publicUrl}?v=${s.version}` : data.publicUrl;
                return (
                  <tr key={f.path}>
                    <td style={{ width: 56 }}>
                      <img src={src} alt="" loading="lazy" decoding="async" className="img-opt-thumb" />
                    </td>
                    <td className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>{f.path}</td>
                    <td className="mono" style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatBytes(f.size)}</td>
                    <td style={{ fontSize: 12 }}>
                      {s.state === "working" && <span className="muted">En cours…</span>}
                      {s.state === "done" && (
                        <span style={{ color: "var(--moss)" }}>
                          {formatBytes(s.before)} → {formatBytes(s.after)}
                        </span>
                      )}
                      {s.state === "skipped" && <span className="muted">Déjà optimisée</span>}
                      {s.state === "error" && <span style={{ color: "var(--brick)" }}>Erreur</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn"
                        onClick={() => optimizeOne(f)}
                        disabled={busy || s.state === "done" || s.state === "skipped"}
                      >
                        Optimiser
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
