import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getFlagEmoji } from "../lib/emea";
import { DISCIPLINE_COLORS, darken } from "../lib/disciplineColors";
import { FORMAT_COLORS, FORMAT_EMOJI } from "../lib/formatStyles";

// Vignette Instagram 4:5. Tout est dessiné en Canvas 2D natif : aucune
// dépendance, et le PNG exporté a la résolution réelle (1080 × 1350).
const W = 1080;
const H = 1350;

const COLORS = {
  parchment: "#F5F1E6",
  imageBg: "#E8DFC8",
  card: "#FFFFFF",
  line: "#DDD5BE",
  ink: "#1B2B20",
  dim: "#6B6F60",
  blurb: "#4A4D42",
  moss: "#15793F",
  rust: "#C4622D",
  brick: "#B8432E",
  // Équivalents opaques des badges .badge-published / .badge-rejected sur fond blanc.
  openBg: "#C5DECF",
  closedBg: "#F1D9D5",
};

const DISP = "Anton, sans-serif";
const SANS = "'IBM Plex Sans', sans-serif";
const MONO = "'IBM Plex Mono', monospace";
const EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const FORMAT_LABEL = { course: "Course", aventure: "Aventure", endurance: "Endurance" };

const CARD = { x: 80, y: 64, w: 920, h: 1150, r: 48, pad: 48 };

function normalize(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function slugify(str) {
  return normalize(str).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "ultra";
}

// Espace classique plutôt que l'espace fine insécable de toLocaleString,
// absente de certaines polices : 14000 → "14 000".
function formatThousands(n) {
  if (n === null || n === undefined || n === "") return null;
  const num = Number(n);
  if (!Number.isFinite(num) || num === 0) return null;
  const [int, dec] = String(num).split(".");
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (dec ? `,${dec}` : "");
}

function instagramHandle(value) {
  if (!value) return null;
  const v = value.trim();
  const fromUrl = v.match(/instagram\.com\/([^/?#]+)/i);
  const handle = (fromUrl ? fromUrl[1] : v).replace(/^@/, "");
  return handle ? `@${handle}` : null;
}

function organizerName(race) {
  return race.organizer?.name || race.organizer_name || null;
}

/* ---------- utilitaires canvas ---------- */

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function setLetterSpacing(ctx, px) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${px}px`;
}

function ellipsize(ctx, text, maxWidth) {
  let t = text.trimEnd();
  if (ctx.measureText(t + "…").width <= maxWidth) return t + "…";
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) t = t.slice(0, -1).trimEnd();
  return t + "…";
}

// Découpe en lignes avec la police courante du contexte. Respecte les retours
// à la ligne du texte, coupe les mots trop longs, et termine par "…" si le
// texte dépasse maxLines. Renvoie { lines, truncated }.
function wrapText(ctx, text, maxWidth, maxLines) {
  const lines = [];
  let truncated = false;
  const paragraphs = String(text || "").split(/\n+/).map((p) => p.trim()).filter(Boolean);

  outer: for (const para of paragraphs) {
    let current = "";
    for (const word of para.split(/\s+/)) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
        continue;
      }
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) { truncated = true; break outer; }
      }
      // Mot plus large que la ligne : on le coupe caractère par caractère.
      current = "";
      for (const ch of word) {
        if (ctx.measureText(current + ch).width > maxWidth && current) {
          lines.push(current);
          if (lines.length >= maxLines) { truncated = true; break outer; }
          current = ch;
        } else {
          current += ch;
        }
      }
    }
    if (current) {
      lines.push(current);
      if (lines.length >= maxLines) {
        truncated = paragraphs.indexOf(para) < paragraphs.length - 1;
        break;
      }
    }
  }

  if (truncated && lines.length) {
    lines[lines.length - 1] = ellipsize(ctx, lines[lines.length - 1], maxWidth);
  }
  return { lines, truncated };
}

// Pastille arrondie avec texte centré. colors : { bg, fg, border, borderWidth,
// font, height, padX, radius, letterSpacing, shadow, align, emoji }. L'emoji
// optionnel suit le texte, dessiné avec une police emoji. Renvoie sa largeur.
function drawPill(ctx, text, x, y, colors) {
  const {
    bg, fg, border, borderWidth = 0, font, height, padX,
    radius = height / 2, letterSpacing = 0, shadow = false, align = "left", emoji = null,
  } = colors;

  ctx.save();
  const emojiFont = `${Math.round(height * 0.44)}px ${EMOJI}`;
  ctx.font = emojiFont;
  const emojiW = emoji ? ctx.measureText(emoji).width + 8 : 0;
  ctx.font = font;
  setLetterSpacing(ctx, letterSpacing);
  const textW = ctx.measureText(text).width;
  const w = Math.ceil(textW + emojiW + padX * 2);
  const left = align === "right" ? x - w : x;

  roundRect(ctx, left, y, w, height, radius);
  ctx.fillStyle = bg;
  ctx.fill();
  if (border && borderWidth) {
    roundRect(ctx, left + borderWidth / 2, y + borderWidth / 2, w - borderWidth, height - borderWidth, radius);
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = border;
    ctx.stroke();
  }

  const m = ctx.measureText("H");
  const cap = m.actualBoundingBoxAscent || height * 0.35;
  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 5;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = fg;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(text, left + padX, y + height / 2 + cap / 2);
  if (emoji) {
    ctx.shadowColor = "transparent";
    setLetterSpacing(ctx, 0);
    ctx.font = emojiFont;
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, left + padX + textW + 8, y + height / 2 + 1);
  }
  ctx.restore();
  return w;
}

// Dessine l'image entière dans le cadre, sans recadrage (souvent des logos).
function drawImageContain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawImageCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

// crossOrigin = "anonymous" : si le serveur ne renvoie pas les en-têtes CORS,
// le chargement échoue (onerror) au lieu de « tainter » le canvas, et l'export
// reste possible. Une seconde tentative contourne un éventuel cache navigateur
// rempli sans en-têtes CORS par l'affichage normal du site.
const imageCache = new Map();

function loadImageOnce(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(null), 15000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (!imageCache.has(url)) {
    const p = loadImageOnce(url).then((img) => {
      if (img) return img;
      const bust = `${url}${url.includes("?") ? "&" : "?"}ig=${Date.now()}`;
      return loadImageOnce(bust);
    });
    imageCache.set(url, p);
  }
  return imageCache.get(url);
}

let fontsPromise = null;
function loadFonts() {
  if (!fontsPromise) {
    fontsPromise = Promise.all([
      document.fonts.load(`400 80px Anton`),
      document.fonts.load(`400 30px 'IBM Plex Sans'`),
      document.fonts.load(`600 30px 'IBM Plex Sans'`),
      document.fonts.load(`500 30px 'IBM Plex Mono'`),
      document.fonts.load(`600 30px 'IBM Plex Mono'`),
    ])
      .catch(() => {})
      .then(() => document.fonts.ready);
  }
  return fontsPromise;
}

/* ---------- rendu de la vignette ---------- */

function drawFallbackName(ctx, name, x, y, w, h) {
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  setLetterSpacing(ctx, 1);
  let size = 88;
  let wrapped;
  do {
    ctx.font = `400 ${size}px ${DISP}`;
    wrapped = wrapText(ctx, (name || "").toUpperCase(), w - 80, 3);
    size -= 4;
  } while (wrapped.truncated && size >= 48);
  const lh = (size + 4) * 1.1;
  const top = y + h / 2 - ((wrapped.lines.length - 1) * lh) / 2;
  wrapped.lines.forEach((line, i) => ctx.fillText(line, x + w / 2, top + i * lh));
  ctx.restore();
}

async function renderRacecard(canvas, race) {
  await loadFonts();
  const [image, logo] = await Promise.all([
    loadImage(race.image_url),
    loadImage(race.organizer?.logo_url),
  ]);

  const warnings = [];
  if (race.image_url && !image) {
    warnings.push("L'image de l'ultra n'a pas pu être chargée (CORS ou URL cassée) : le nom est affiché à la place.");
  }
  if (race.organizer?.logo_url && !logo) {
    warnings.push("Le logo de l'organisateur n'a pas pu être chargé : seul son nom est affiché.");
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);

  // Fond parchemin
  ctx.fillStyle = COLORS.parchment;
  ctx.fillRect(0, 0, W, H);

  // Carte blanche avec ombre légère
  ctx.save();
  ctx.shadowColor = "rgba(27,43,32,0.14)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.r);
  ctx.fillStyle = COLORS.card;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, CARD.x + 1, CARD.y + 1, CARD.w - 2, CARD.h - 2, CARD.r - 1);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  const x0 = CARD.x + CARD.pad;
  const innerW = CARD.w - CARD.pad * 2;
  const right = x0 + innerW;
  const bottom = CARD.y + CARD.h;

  // Zone image
  const imgY = CARD.y + CARD.pad;
  const imgH = Math.round(CARD.h * 0.37);
  ctx.save();
  roundRect(ctx, x0, imgY, innerW, imgH, 24);
  ctx.fillStyle = COLORS.imageBg;
  ctx.fill();
  ctx.clip();
  if (image) drawImageContain(ctx, image, x0, imgY, innerW, imgH);
  else drawFallbackName(ctx, race.name, x0, imgY, innerW, imgH);
  ctx.restore();

  // --- Pile du bas, ancrée sur le bas de la carte ---
  const orgName = organizerName(race);
  const footerH = 108;
  const footerLineY = bottom - footerH;
  const formatH = 50;
  const formatY = footerLineY - 30 - formatH;
  const statsH = 44;
  const statsY = formatY - 24 - statsH;
  const dashY = statsY - 22;

  // --- Ligne de méta ---
  let y = imgY + imgH + 34;
  const metaH = 46;
  const metaMid = y + metaH / 2;
  let mx = x0;

  const flag = getFlagEmoji(race.country);
  if (flag) {
    ctx.save();
    ctx.font = `34px ${EMOJI}`;
    ctx.textBaseline = "middle";
    ctx.fillText(flag, mx, metaMid + 2);
    mx += ctx.measureText(flag).width + 12;
    ctx.restore();
  }
  if (race.country) {
    ctx.save();
    ctx.font = `600 26px ${MONO}`;
    setLetterSpacing(ctx, 2.5);
    ctx.fillStyle = COLORS.moss;
    const cap = ctx.measureText("H").actualBoundingBoxAscent || 18;
    const label = race.country.toUpperCase();
    ctx.fillText(label, mx, metaMid + cap / 2);
    mx += ctx.measureText(label).width + 18;
    ctx.restore();
  }

  // Badge ouvert / fermé à droite (dessiné avant la discipline pour connaître la place restante)
  const statusW = drawPill(ctx, race.open ? "OUVERT" : "FERMÉ", right, y + 3, {
    bg: race.open ? COLORS.openBg : COLORS.closedBg,
    fg: race.open ? COLORS.moss : COLORS.brick,
    font: `500 22px ${MONO}`,
    height: 40,
    padX: 18,
    radius: 6,
    letterSpacing: 1.5,
    align: "right",
  });

  if (race.discipline && mx < right - statusW - 140) {
    const color = DISCIPLINE_COLORS[race.discipline] || "#6E6E66";
    drawPill(ctx, race.discipline.toUpperCase(), mx, y + 2, {
      bg: `${color}E6`,
      fg: "#FFFFFF",
      border: darken(color, 0.25),
      borderWidth: 4,
      font: `600 22px ${SANS}`,
      height: 42,
      padX: 20,
      letterSpacing: 1,
      shadow: true,
    });
  }
  y += metaH + 22;

  // --- Nom de l'ultra : 2 lignes max, taille réduite si nécessaire ---
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.textBaseline = "alphabetic";
  setLetterSpacing(ctx, 0.5);
  let titleSize = 76;
  let title;
  for (;;) {
    ctx.font = `400 ${titleSize}px ${DISP}`;
    title = wrapText(ctx, (race.name || "").toUpperCase(), innerW, 2);
    if (!title.truncated || titleSize <= 50) break;
    titleSize -= 4;
  }
  const titleLH = Math.round(titleSize * 1.12);
  const titleCap = ctx.measureText("H").actualBoundingBoxAscent || titleSize * 0.75;
  title.lines.forEach((line, i) => ctx.fillText(line, x0, y + titleCap + i * titleLH));
  ctx.restore();
  y += titleCap + (title.lines.length - 1) * titleLH + 30;

  // --- Description courte : 4 lignes max, limitée par la place restante ---
  if (race.blurb && race.blurb.trim()) {
    ctx.save();
    ctx.font = `400 30px ${SANS}`;
    ctx.fillStyle = COLORS.blurb;
    ctx.textBaseline = "top";
    const lh = 44;
    const fit = Math.floor((dashY - 18 - y) / lh);
    const maxLines = Math.max(0, Math.min(4, fit));
    if (maxLines > 0) {
      const { lines } = wrapText(ctx, race.blurb, innerW, maxLines);
      lines.forEach((line, i) => ctx.fillText(line, x0, y + i * lh));
    }
    ctx.restore();
  }

  // --- Séparateur pointillé ---
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, dashY);
  ctx.lineTo(right, dashY);
  ctx.stroke();
  ctx.restore();

  // --- Stats ---
  ctx.save();
  ctx.textBaseline = "alphabetic";
  const statsBase = statsY + statsH - 8;
  let sx = x0;
  const stat = (value, unit) => {
    if (!value) return;
    ctx.font = `600 36px ${MONO}`;
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(value, sx, statsBase);
    sx += ctx.measureText(value).width + 10;
    ctx.font = `500 24px ${MONO}`;
    ctx.fillStyle = COLORS.dim;
    ctx.fillText(unit, sx, statsBase);
    sx += ctx.measureText(unit).width + 44;
  };
  stat(formatThousands(race.km), "km");
  stat(formatThousands(race.dplus), "D+");
  if (race.month) {
    ctx.font = `500 26px ${MONO}`;
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = "right";
    ctx.fillText(race.month, right, statsBase);
  }
  ctx.restore();

  // --- Badge format ---
  if (race.format) {
    const label = FORMAT_LABEL[race.format] || race.format;
    const color = FORMAT_COLORS[label] || "#6E6E66";
    const emoji = FORMAT_EMOJI[label];
    drawPill(ctx, label.toUpperCase(), x0, formatY, {
      bg: color,
      fg: "#FFFFFF",
      border: darken(color, 0.25),
      borderWidth: 4,
      font: `600 24px ${SANS}`,
      height: formatH,
      padX: 22,
      letterSpacing: 1,
      shadow: true,
      emoji,
    });
  }

  // --- Pied de carte : organisateur ---
  if (orgName || logo) {
    ctx.save();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CARD.x, footerLineY);
    ctx.lineTo(CARD.x + CARD.w, footerLineY);
    ctx.stroke();

    const mid = footerLineY + (footerH) / 2;
    let fx = x0;
    if (logo) {
      const s = 60;
      ctx.save();
      roundRect(ctx, fx, mid - s / 2, s, s, 14);
      ctx.fillStyle = "#E5DCC3";
      ctx.fill();
      ctx.clip();
      drawImageCover(ctx, logo, fx, mid - s / 2, s, s);
      ctx.restore();
      roundRect(ctx, fx + 1, mid - s / 2 + 1, s - 2, s - 2, 13);
      ctx.strokeStyle = COLORS.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      fx += s + 20;
    }
    if (orgName) {
      ctx.font = `600 28px ${SANS}`;
      ctx.fillStyle = COLORS.dim;
      ctx.textBaseline = "middle";
      const maxW = right - fx;
      const text = ctx.measureText(orgName).width > maxW ? ellipsize(ctx, orgName, maxW) : orgName;
      ctx.fillText(text, fx, mid + 1);
    }
    ctx.restore();
  }

  // --- Signature de marque ---
  ctx.save();
  ctx.font = `400 46px ${DISP}`;
  setLetterSpacing(ctx, 6);
  ctx.fillStyle = COLORS.rust;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ULTRARIDE.EU", W / 2 + 3, bottom + (H - bottom) / 2 + 2);
  ctx.restore();

  return warnings;
}

/* ---------- légende ---------- */

function buildCaption(race) {
  const flag = getFlagEmoji(race.country);
  const first = [flag, race.blurb?.trim()].filter(Boolean).join(" ");

  const km = formatThousands(race.km);
  const dplus = formatThousands(race.dplus);
  const where = [
    race.country,
    km && `${km} km`,
    dplus && `${dplus} m D+`,
    race.month,
  ].filter(Boolean).join(" · ");
  const what = [race.discipline, race.mode].filter(Boolean).join(" · ");

  const org = instagramHandle(race.organizer?.instagram) || organizerName(race);

  const disciplineTag = race.discipline ? `#${normalize(race.discipline).replace(/[^a-z0-9]/g, "")}` : null;
  const tags = ["#ultracycling", "#ultradistance", "#bikepacking", disciplineTag, "#ultraride"]
    .filter(Boolean).join(" ");

  const blocks = [
    first,
    [where && `📍 ${where}`, what && `🚴 ${what}`].filter(Boolean).join("\n"),
    org,
    "👉 Toutes les infos sur ultraride.eu",
    tags,
  ];
  return blocks.filter(Boolean).join("\n\n");
}

/* ---------- page ---------- */

export default function InstagramGenerator() {
  const [races, setRaces] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [includeUnpublished, setIncludeUnpublished] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [rendering, setRendering] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [caption, setCaption] = useState("");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);
  const renderSeq = useRef(0);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("races")
        .select("*, organizer:organizers!races_organizer_id_fkey(id, name, logo_url, instagram)")
        .order("name", { ascending: true });
      if (error) setError(error.message);
      else setRaces(data);
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!races) return [];
    const q = normalize(search.trim());
    return races
      .filter((r) => includeUnpublished || r.status === "published")
      .filter((r) => !q || normalize(r.name).includes(q));
  }, [races, search, includeUnpublished]);

  const selected = useMemo(
    () => races?.find((r) => r.id === selectedId) || null,
    [races, selectedId]
  );

  useEffect(() => {
    if (!selected || !canvasRef.current) return;
    const seq = ++renderSeq.current;
    setCaption(buildCaption(selected));
    setCopied(false);
    setRendering(true);
    setWarnings([]);
    renderRacecard(canvasRef.current, selected)
      .then((w) => { if (seq === renderSeq.current) setWarnings(w); })
      .catch((e) => { if (seq === renderSeq.current) setWarnings([`Erreur de rendu : ${e.message}`]); })
      .finally(() => { if (seq === renderSeq.current) setRendering(false); });
  }, [selected]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas || !selected) return;
    try {
      canvas.toBlob((blob) => {
        if (!blob) { setError("L'export PNG a échoué."); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ultraride-${slugify(selected.name)}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } catch (e) {
      setError(`Export impossible : ${e.message}`);
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Impossible de copier dans le presse-papiers.");
    }
  };

  return (
    <div>
      <h1 className="h1">Vignettes Instagram</h1>
      {error && <div className="error-box">{error}</div>}

      <div className="ig-gen">
        <div className="panel ig-gen-list">
          <div className="field">
            <label htmlFor="ig-search">Rechercher un ultra</label>
            <input
              id="ig-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom de l'ultra…"
            />
          </div>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 12px" }}>
            <input
              type="checkbox"
              checked={includeUnpublished}
              onChange={(e) => setIncludeUnpublished(e.target.checked)}
            />
            Inclure les non publiés
          </label>

          {races === null ? (
            <p className="muted">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="muted">Aucun ultra ne correspond.</p>
          ) : (
            <>
              <div className="muted mono" style={{ fontSize: 11, marginBottom: 6 }}>
                {filtered.length} ultra{filtered.length !== 1 ? "s" : ""}
              </div>
              <div className="ig-gen-items">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`ig-gen-item${r.id === selectedId ? " active" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <span>{getFlagEmoji(r.country) || ""} {r.name}</span>
                    {r.status !== "published" && <span className="badge badge-draft">{r.status}</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          {!selected && <p className="muted">Choisis un ultra dans la liste pour générer sa vignette.</p>}
          <div style={{ display: selected ? "block" : "none" }}>
            <canvas ref={canvasRef} width={W} height={H} className="ig-gen-canvas" />
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "12px 0" }}>
              <button className="btn btn-primary" onClick={download} disabled={rendering}>
                Télécharger PNG
              </button>
              <span className="muted mono" style={{ fontSize: 11 }}>
                {rendering ? "Rendu en cours…" : `${W} × ${H} px`}
              </span>
            </div>
            {warnings.map((w) => (
              <p key={w} className="field-hint" style={{ color: "var(--brick)", margin: "0 0 6px" }}>⚠ {w}</p>
            ))}

            <div className="field" style={{ marginTop: 16, maxWidth: 560 }}>
              <label htmlFor="ig-caption">Légende</label>
              <textarea
                id="ig-caption"
                rows={14}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
            <button className="btn" onClick={copyCaption} style={{ marginTop: 8 }}>
              {copied ? "Copié ✓" : "Copier la légende"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
