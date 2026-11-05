import { isNative } from "./native";

// Image 1080×1350 (format portrait Instagram) du Passeport Ultra, dessinée
// directement sur un canvas : aucune librairie, rendu identique iOS / Android / web.
const W = 1080, H = 1350;
const C = { brand: "#1B2B20", line: "#2C4434", paper: "#F5F1E6", peach: "#E9A27A", pale: "#C9D3C6", rust: "#C4622D" };

function fmt(n) {
  return Math.round(n || 0).toLocaleString("fr-FR").replace(/ | /g, " ");
}

// Réduit la police jusqu'à ce que le texte tienne dans la largeur donnée.
function fit(ctx, text, family, size, maxW) {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 20) { s -= 4; ctx.font = `${s}px ${family}`; }
  return s;
}

function spaced(ctx, text, x, y, spacing) {
  let cx = x;
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing; }
}

export async function drawPassport({ name, role, count, km, dplus }) {
  const DISP = "Anton, Impact, sans-serif";
  const MONO = "'IBM Plex Mono', ui-monospace, monospace";
  const SANS = "'IBM Plex Sans', system-ui, sans-serif";
  try {
    await Promise.all([
      document.fonts.load(`120px Anton`),
      document.fonts.load(`30px 'IBM Plex Mono'`),
      document.fonts.load(`34px 'IBM Plex Sans'`),
    ]);
  } catch { /* polices de repli */ }

  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d");

  ctx.fillStyle = C.brand;
  ctx.fillRect(0, 0, W, H);

  // Courbes de niveau, comme sur la carte du passeport.
  ctx.strokeStyle = C.line; ctx.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const y = 470 + i * 92;
    ctx.beginPath();
    ctx.moveTo(-40, y + 60);
    ctx.bezierCurveTo(240, y - 40, 420, y + 120, 640, y + 10);
    ctx.bezierCurveTo(820, y - 70, 960, y - 20, W + 40, y - 40);
    ctx.stroke();
  }

  const L = 90;
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = C.peach;
  ctx.font = `500 30px ${MONO}`;
  spaced(ctx, "PASSEPORT ULTRA", L, 170, 6);

  ctx.fillStyle = C.paper;
  const nameUp = (name || "Participant").toUpperCase();
  const ns = fit(ctx, nameUp, DISP, 120, W - L - 330);
  ctx.font = `${ns}px ${DISP}`;
  ctx.fillText(nameUp, L, 170 + 20 + ns);

  ctx.fillStyle = C.pale;
  ctx.font = `34px ${SANS}`;
  ctx.fillText(role || "Participant", L, 170 + 20 + ns + 60);

  // Tampon « FINISHER ×n ».
  if (count > 0) {
    ctx.save();
    ctx.translate(W - 190, 250);
    ctx.rotate((10 * Math.PI) / 180);
    ctx.strokeStyle = C.peach; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 112, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 96, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = C.peach; ctx.textAlign = "center";
    ctx.font = `500 26px ${MONO}`;
    ctx.fillText("FINISHER", 0, -26);
    ctx.font = `76px ${DISP}`;
    ctx.fillText(`×${count}`, 0, 58);
    ctx.restore();
  }

  // Pointillés de séparation.
  ctx.strokeStyle = "rgba(245,241,230,.35)"; ctx.lineWidth = 3; ctx.setLineDash([10, 12]);
  ctx.beginPath(); ctx.moveTo(L, 450); ctx.lineTo(W - L, 450); ctx.stroke();
  ctx.setLineDash([]);

  // Les trois chiffres, l'un sous l'autre pour rester lisibles en story.
  const rows = [
    [fmt(count), count > 1 ? "ULTRAS TERMINÉS" : "ULTRA TERMINÉ"],
    [fmt(km), "KILOMÈTRES"],
    [fmt(dplus), "MÈTRES DE D+"],
  ];
  rows.forEach(([v, label], i) => {
    const y = 640 + i * 200;
    ctx.fillStyle = C.paper;
    ctx.font = `150px ${DISP}`;
    ctx.fillText(v, L, y);
    const vw = ctx.measureText(v).width;
    ctx.fillStyle = C.peach;
    ctx.font = `500 30px ${MONO}`;
    spaced(ctx, label, L + vw + 30, y - 12, 4);
  });

  // Signature.
  ctx.fillStyle = C.rust;
  ctx.fillRect(L, H - 150, 70, 8);
  ctx.fillStyle = C.paper;
  ctx.font = `48px ${DISP}`;
  ctx.fillText("ULTRARIDE.EU", L, H - 80);
  ctx.fillStyle = C.pale;
  ctx.font = `500 26px ${MONO}`;
  ctx.textAlign = "right";
  ctx.fillText("ULTRA-CYCLING ALMANAC", W - L, H - 86);
  ctx.textAlign = "left";

  return cv;
}

// Ouvre la feuille de partage du téléphone avec l'image du passeport.
// Renvoie "shared", "downloaded" ou "cancelled".
export async function sharePassport(data) {
  const cv = await drawPassport(data);
  const dataUrl = cv.toDataURL("image/png");
  const fileName = "passeport-ultra.png";
  const text = "Mon Passeport Ultra sur ultraride.eu";

  if (isNative) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: dataUrl.split(",")[1],
      directory: Directory.Cache,
    });
    try {
      await Share.share({ title: "Mon Passeport Ultra", text, files: [uri] });
      return "shared";
    } catch {
      return "cancelled"; // l'utilisateur a fermé la feuille de partage
    }
  }

  // Navigateur : partage de fichier si le téléphone le permet, sinon téléchargement.
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const file = new File([blob], fileName, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Mon Passeport Ultra", text }); return "shared"; }
    catch { return "cancelled"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return "downloaded";
}
