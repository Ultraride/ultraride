export const DISCIPLINE_COLORS = {
  Route: "#6E6E66",
  Gravel: "#15793F",
  VTT: "#C4622D",
};

export function darken(hex, amount = 0.25) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - 255 * amount);
  const g = Math.max(0, ((num >> 8) & 0x00ff) - 255 * amount);
  const b = Math.max(0, (num & 0x0000ff) - 255 * amount);
  return `rgb(${r}, ${g}, ${b})`;
}
