import { isDarkTheme } from "../theme";
const light = {
  attractor: {
    body: "#303943",
    rim: "#4f5863",
    glyph: "#e3eaf0",
    wave: "#694880",
  },
  repellent: {
    body: "#7043a2",
    rim: "#9565c4",
    glyph: "#f4ebff",
    wave: "#765298",
  },
} as const;
const dark = {
  attractor: {
    body: "#dedde5",
    rim: "#b6b3c2",
    glyph: "#24232b",
    wave: "#c9acf5",
  },
  repellent: {
    body: "#56316e",
    rim: "#8d63ac",
    glyph: "#f2e8ff",
    wave: "#bd93dc",
  },
};
/** Keep force identity consistent while canvas renderers follow live theme changes. */
export const FORCE_PALETTE = {
  get attractor() {
    return isDarkTheme() ? dark.attractor : light.attractor;
  },
  get repellent() {
    return isDarkTheme() ? dark.repellent : light.repellent;
  },
};
