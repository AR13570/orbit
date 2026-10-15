import { afterEach, beforeEach, expect, it, vi } from "vitest";
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
afterEach(() => vi.restoreAllMocks());
it("defaults to the authored profile and restores a valid size choice", async () => {
  const prefs = await import("../../src/gravity/preferences");
  expect(prefs.readProjectileSize()).toBe(1);
  prefs.saveProjectileSize(1.7);
  expect(prefs.readProjectileSize()).toBe(1.7);
});
it.each([
  "",
  " ",
  "garbage",
  "NaN",
  "Infinity",
  "-1",
  "0",
  "0.5",
  "0.9",
  "3",
  "null",
])("ignores corrupt or out-of-range stored size %j", async (value) => {
  const prefs = await import("../../src/gravity/preferences");
  localStorage.setItem(prefs.PROJECTILE_SIZE_KEY, value);
  expect(prefs.readProjectileSize()).toBe(1);
});
it("retains a choice for the session when storage is blocked", async () => {
  const prefs = await import("../../src/gravity/preferences");
  localStorage.setItem(prefs.PROJECTILE_SIZE_KEY, "0.5");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  prefs.saveProjectileSize(2);
  expect(prefs.readProjectileSize()).toBe(2);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(prefs.readProjectileSize()).toBe(2);
});
it("falls back safely when storage cannot be read before choosing", async () => {
  const prefs = await import("../../src/gravity/preferences");
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(prefs.readProjectileSize()).toBe(1);
});
it("preserves fine size choices and only rounds beyond the slider's precision", async () => {
  const prefs = await import("../../src/gravity/preferences");
  localStorage.setItem(prefs.PROJECTILE_SIZE_KEY, "1.23");
  expect(prefs.readProjectileSize()).toBe(1.23);
  prefs.saveProjectileSize(1.773);
  expect(prefs.readProjectileSize()).toBe(1.77);
  expect(localStorage.getItem(prefs.PROJECTILE_SIZE_KEY)).toBe("1.77");
});
