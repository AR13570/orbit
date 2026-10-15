import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  PARTICLE_INTERACTION_KEY,
  readParticleInteraction,
  saveParticleInteraction,
} from "../../src/gravity/preferences";
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
it("distinguishes an absent or invalid preference from an authored override", () => {
  expect(readParticleInteraction()).toBeNull();
  localStorage.setItem(PARTICLE_INTERACTION_KEY, "garbage");
  expect(readParticleInteraction()).toBeNull();
  saveParticleInteraction(false);
  expect(readParticleInteraction()).toBe(false);
  saveParticleInteraction(true);
  expect(readParticleInteraction()).toBe(true);
});
it("keeps an explicit choice for the session when storage is blocked", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  saveParticleInteraction(false);
  expect(readParticleInteraction()).toBe(false);
  saveParticleInteraction(true);
  expect(readParticleInteraction()).toBe(true);
});
