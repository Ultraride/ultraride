// Recompression d'image côté navigateur, sans dépendance : Canvas 2D → WebP.
// Utilisé à l'upload (ImageUploadField) et par l'optimiseur de l'admin.

const PASSTHROUGH_TYPES = ["image/svg+xml", "image/gif"];

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

async function decode(blob) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Certains navigateurs refusent certains formats : on retombe sur <img>.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function compressImage(fileOrBlob, { maxWidth = 1600, quality = 0.82 } = {}) {
  const originalSize = fileOrBlob.size;
  const original = {
    blob: fileOrBlob,
    contentType: fileOrBlob.type,
    width: null,
    height: null,
    originalSize,
    newSize: originalSize,
  };

  if (PASSTHROUGH_TYPES.includes(fileOrBlob.type)) return original;

  const source = await decode(fileOrBlob);
  const srcW = source.width || source.naturalWidth;
  const srcH = source.height || source.naturalHeight;
  const scale = Math.min(1, maxWidth / srcW);
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  // Canvas transparent par défaut : aucun fond n'est peint, la couche alpha
  // des PNG est conservée dans le WebP.
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  if (typeof source.close === "function") source.close();

  const webp = await toBlob(canvas, "image/webp", quality);
  // Safari ancien : pas d'encodeur WebP, toBlob renvoie du PNG à la place.
  if (!webp || webp.type !== "image/webp" || webp.size >= originalSize) {
    return { ...original, width: srcW, height: srcH };
  }

  return {
    blob: webp,
    contentType: "image/webp",
    width,
    height,
    originalSize,
    newSize: webp.size,
  };
}
