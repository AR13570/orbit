import { FORCE_PALETTE } from "../../src/render/force-palette";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  initializeTheme,
  readTheme,
  setTheme,
  THEME_KEY,
  canvasColors,
} from "../../src/theme";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

it("starts in dark mode without an existing preference", () => {
  initializeTheme();
  expect(readTheme()).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(canvasColors().ground).toBe("#000000");
});
it("restores an explicit light preference and changes the canvas with the interface", () => {
  localStorage.setItem(THEME_KEY, "light");
  initializeTheme();
  expect(canvasColors().ground).toBe("#e9ecef");
  setTheme("dark");
  expect(localStorage.getItem(THEME_KEY)).toBe("dark");
  expect(canvasColors().ground).toBe("#000000");
});
it("keeps the selected theme when storage writes are blocked", () => {
  initializeTheme();
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  setTheme("light");
  expect(readTheme()).toBe("light");
  expect(document.documentElement.dataset.theme).toBe("light");
});
it("defaults to dark when stored data is invalid", () => {
  localStorage.setItem(THEME_KEY, "unexpected");
  initializeTheme();
  expect(readTheme()).toBe("dark");
});

it("uses luminous dark force fields on a pure-black canvas and restores the light palette", () => {
  const luminance = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  setTheme("light");
  const lightAttractor = FORCE_PALETTE.attractor;
  const lightRepeller = FORCE_PALETTE.repellent;
  setTheme("dark");
  expect(canvasColors().ground).toBe("#000000");
  for (const [dark, light] of [
    [FORCE_PALETTE.attractor, lightAttractor],
    [FORCE_PALETTE.repellent, lightRepeller],
  ]) {
    expect(dark.body).not.toBe(light.body);
    expect(luminance(dark.wave)).toBeGreaterThan(luminance(light.wave) * 1.4);
    // Both theme variants keep labels readable on their own core face.
    for (const palette of [dark, light]) {
      const linear = (hex: string) => {
        const channels = [1, 3, 5]
          .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map((c) =>
            c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
          );
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const body = linear(palette.body),
        glyph = linear(palette.glyph);
      expect(
        (Math.max(body, glyph) + 0.05) / (Math.min(body, glyph) + 0.05),
      ).toBeGreaterThan(4.5);
    }
  }
  setTheme("light");
  expect(FORCE_PALETTE.attractor).toEqual(lightAttractor);
  expect(FORCE_PALETTE.repellent).toEqual(lightRepeller);
});
