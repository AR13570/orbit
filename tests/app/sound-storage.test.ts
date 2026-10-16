import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});
afterEach(() => vi.restoreAllMocks());
it("starts with sound on for absent or invalid storage and restores both choices after a module reload", async () => {
  let preference = await import("../../src/soundPreference");
  expect(preference.readSoundMuted()).toBe(false);
  localStorage.setItem(preference.SOUND_MUTED_KEY, "corrupt");
  expect(preference.readSoundMuted()).toBe(false);
  preference.setSoundMuted(true);
  vi.resetModules();
  preference = await import("../../src/soundPreference");
  expect(preference.readSoundMuted()).toBe(true);
  preference.setSoundMuted(false);
  vi.resetModules();
  preference = await import("../../src/soundPreference");
  expect(preference.readSoundMuted()).toBe(false);
});
it("keeps the session choice through blocked writes and later blocked reads", async () => {
  const preference = await import("../../src/soundPreference");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  preference.setSoundMuted(true);
  expect(preference.readSoundMuted()).toBe(true);
  preference.setSoundMuted((muted) => !muted);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(preference.readSoundMuted()).toBe(false);
});
it("keeps a successfully read saved mute when storage later becomes inaccessible", async () => {
  const preference = await import("../../src/soundPreference");
  localStorage.setItem(preference.SOUND_MUTED_KEY, "true");
  expect(preference.readSoundMuted()).toBe(true);
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  expect(preference.readSoundMuted()).toBe(true);
});
