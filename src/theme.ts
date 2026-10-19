import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
export const THEME_KEY = "orbit.theme.v1";
const listeners = new Set<() => void>();
let listening = false;
const valid = (value: unknown): value is Theme =>
  value === "dark" || value === "light";

function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(THEME_KEY);
    if (valid(value)) return value;
  } catch {
    /* The in-memory document preference still works without storage. */
  }
  return "dark";
}
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#000000" : "#e9ecef");
}
export function readTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  return valid(current) ? current : storedTheme();
}
export function initializeTheme() {
  applyTheme(storedTheme());
  if (!listening) {
    window.addEventListener("storage", (event) => {
      if (event.key !== THEME_KEY && event.key !== null) return;
      applyTheme(storedTheme());
      listeners.forEach((listener) => listener());
    });
    listening = true;
  }
}
export function setTheme(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* Retain the current document theme. */
  }
  listeners.forEach((listener) => listener());
}
export function useTheme() {
  const theme = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    readTheme,
    () => "dark" as Theme,
  );
  return [theme, setTheme] as const;
}

const light = {
  ground: "#e9ecef",
  charcoal: "#303943",
  slate: "#626d78",
  blue: "#527c9a",
  checkpoint: "#168dff",
  rust: "#b76550",
  aim: "#8a0f4b",
  aimPath: "#7956cf",
  aimRing: "#7a60d6",
  handle: "#697783",
  danger: "#c9675e",
  softLine: "rgba(48,57,67,.24)",
  strongLine: "rgba(48,57,67,.58)",
  projectileColors: ["#a45c52", "#64846a", "#8c6796"],
};
const dark: typeof light = {
  ground: "#000000",
  charcoal: "#e3eaf0",
  slate: "#a4b2bf",
  blue: "#8bbad5",
  checkpoint: "#62b5ff",
  rust: "#e49c83",
  aim: "#f09bbf",
  aimPath: "#bd9cf2",
  aimRing: "#bd9cf2",
  handle: "#a4b2bf",
  danger: "#ee9c90",
  softLine: "rgba(227,234,240,.3)",
  strongLine: "rgba(227,234,240,.58)",
  projectileColors: ["#ff5678", "#2bd99a", "#b886ff"],
};
/** Standalone light review canvases keep their palette; the app initializes its theme before paint. */
export function isDarkTheme(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.theme === "dark"
  );
}
export function canvasColors() {
  return isDarkTheme() ? dark : light;
}

/** Preserve each planet's hue while giving dark-mode bodies more chroma, without whitening them. */
export function visibleParticleColor(color: string): string {
  if (!isDarkTheme()) return color;
  if (/^#[\da-f]{6}$/i.test(color)) {
    const channels = [1, 3, 5].map(
      (start) => parseInt(color.slice(start, start + 2), 16) / 255,
    );
    const minimum = Math.min(...channels),
      maximum = Math.max(...channels);
    const chroma = maximum - minimum;
    if (chroma < 1e-6) return color;
    const saturation = Math.max(
      0.82,
      Math.min(0.96, (chroma / maximum) * 1.12),
    );
    const value = 0.96,
      floor = value * (1 - saturation);
    return (
      "#" +
      channels
        .map((channel) =>
          Math.round(
            (floor + ((channel - minimum) / chroma) * (value - floor)) * 255,
          )
            .toString(16)
            .padStart(2, "0"),
        )
        .join("")
    );
  }
  return color.replace(
    /^hsl\(([-+\d.]+)\s+([\d.]+)%\s+([\d.]+)%\)$/i,
    (_, hue, saturation, lightness) =>
      `hsl(${hue} ${Math.max(88, Number(saturation))}% ${Math.max(54, Math.min(60, Number(lightness) + 20))}%)`,
  );
}
