export function getCheckerStyle(color) {
  return {
    backgroundColor: color,
    backgroundImage: `
      linear-gradient(45deg, #FFFFFF 25%, transparent 25%, transparent 75%, #FFFFFF 75%, #FFFFFF),
      linear-gradient(45deg, #FFFFFF 25%, transparent 25%, transparent 75%, #FFFFFF 75%, #FFFFFF),
      linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4))
    `,
    backgroundSize: "10px 10px, 10px 10px, 100% 100%",
    backgroundPosition: "0 0, 5px 5px, 0 0",
  };
}

export const FORMAT_CHECKER_COLORS = {
  Course: "#000000",
  Aventure: "#15793F",
  Endurance: "#B3382C",
};
