// Coût des vérifications IA (Claude Haiku 5.5). Le coût exact en dollars est
// calculé par l'Edge Function à chaque appel (cache et palier > 100 k tokens
// compris) ; ici on ne fait que l'afficher et le convertir en euros.
export const EUR_PER_USD = 1 / 1.1202; // taux BCE/marché du 23 oct. 2026

export function eur(usd, { approx = false } = {}) {
  const v = Number(usd || 0) * EUR_PER_USD;
  const digits = v === 0 ? 2 : v < 0.01 ? 4 : v < 1 ? 3 : 2;
  return `${approx ? "≈ " : ""}${v.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} €`;
}

export function usd(v) {
  return `${Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 4 })} $`;
}

export function tokens(n) {
  const v = Number(n || 0);
  return v >= 10_000 ? `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k` : v.toLocaleString("fr-FR");
}
