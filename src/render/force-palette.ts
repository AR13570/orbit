import { isDarkTheme } from "../theme";
const light = {
  attractor: {
    body: "#303943",
    rim: "#4f5863",
    glyph: "#e3eaf0",
    wave: "#694880",
  },
  repellent: {
    body: "#a95724",
    rim: "#c67d48",
    glyph: "#fff0df",
    wave: "#965a2c",
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
    body: "#8f4925",
    rim: "#c88950",
    glyph: "#fff2e5",
    wave: "#ffc27d",
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
