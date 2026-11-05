import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { isNative } from "./native";
import { PassportSheet } from "../pages/PalmaresSection";

// L'app n'a pas d'impression : on y produit le même Passeport Ultra que la
// version imprimée du site. La fiche est rendue avec le même composant
// (PassportSheet) et les mêmes styles d'impression (index.css, @media print),
// photographiée, puis posée sur une page A4 avec les marges de @page (10 mm).

const PAPER = "#FBF8F0";
const PAGE_W = 210, PAGE_H = 297, MARGIN = 10;

// Recopie les règles .pp-* du bloc @media print, préfixées par .pp-capture :
// toute évolution du passeport imprimé s'applique automatiquement au PDF de l'app.
function printRulesForCapture() {
  let css = "";
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of Array.from(rules || [])) {
      if (!(rule instanceof CSSMediaRule) || !/print/.test(rule.media.mediaText)) continue;
      for (const r of Array.from(rule.cssRules)) {
        const sel = r.selectorText;
        if (!sel || !/\.pp-/.test(sel) || /body|html|\.pp-portal/.test(sel)) continue;
        const scoped = sel.split(",").map((x) => `.pp-capture ${x.trim()}`).join(", ");
        css += `${scoped}{${r.style.cssText}}\n`;
      }
    }
  }
  return css;
}

async function captureSheet(props) {
  const html2canvas = (await import("html2canvas")).default;
  const style = document.createElement("style");
  style.textContent = printRulesForCapture();
  const host = document.createElement("div");
  host.className = "pp-capture";
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W - 2 * MARGIN}mm;background:${PAPER};`;
  document.head.appendChild(style);
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(PassportSheet, props)));
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const sheet = host.querySelector(".pp-sheet");
    return await html2canvas(sheet, { scale: 2.5, backgroundColor: PAPER, logging: false });
  } finally {
    root.unmount();
    host.remove();
    style.remove();
  }
}

export async function buildPassportPdf({ profile, user, results }) {
  const stats = {
    count: results.length,
    km: results.reduce((s, r) => s + (r.distance_km || 0), 0),
    dplus: results.reduce((s, r) => s + (r.elevation_gain || 0), 0),
  };
  const canvas = await captureSheet({ profile, user, results, stats });
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const contentW = PAGE_W - 2 * MARGIN, contentH = PAGE_H - 2 * MARGIN;
  const pxPerMm = canvas.width / contentW;
  const pagePx = Math.floor(contentH * pxPerMm);
  // Une longue liste continue sur les pages suivantes, comme à l'impression.
  for (let y = 0, page = 0; y < canvas.height; y += pagePx, page++) {
    if (page > 0) doc.addPage();
    const h = Math.min(pagePx, canvas.height - y);
    const slice = document.createElement("canvas");
    slice.width = canvas.width; slice.height = h;
    slice.getContext("2d").drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    doc.setFillColor(PAPER); doc.rect(0, 0, PAGE_W, PAGE_H, "F");
    doc.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", MARGIN, MARGIN, contentW, h / pxPerMm);
  }
  return doc;
}

// Ouvre la feuille de partage avec le PDF (Enregistrer dans Fichiers, Imprimer, Mail…).
export async function sharePassportPdf(data) {
  const doc = await buildPassportPdf(data);
  const fileName = "passeport-ultra.pdf";
  if (isNative) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const base64 = doc.output("datauristring").split(",")[1];
    const { uri } = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
    try { await Share.share({ title: "Mon Passeport Ultra", files: [uri] }); return "shared"; }
    catch { return "cancelled"; }
  }
  doc.save(fileName);
  return "downloaded";
}
