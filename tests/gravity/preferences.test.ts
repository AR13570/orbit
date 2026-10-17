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

it("defaults grouping off and remembers a separate explicit choice", async () => {
  const { PARTICLE_GROUPING_KEY, readParticleGrouping, saveParticleGrouping } =
    await import("../../src/gravity/preferences");
  expect(readParticleGrouping()).toBe(false);
  localStorage.setItem(PARTICLE_GROUPING_KEY, "garbage");
  expect(readParticleGrouping()).toBe(false);
  saveParticleGrouping(true);
  expect(readParticleGrouping()).toBe(true);
  saveParticleInteraction(false);
  expect(readParticleGrouping()).toBe(true);
  saveParticleGrouping(false);
  expect(readParticleGrouping()).toBe(false);
});

it("remembers grouping for the session if browser storage is unavailable", async () => {
  const { readParticleGrouping, saveParticleGrouping } =
    await import("../../src/gravity/preferences");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  saveParticleGrouping(true);
  expect(readParticleGrouping()).toBe(true);
  saveParticleGrouping(false);
  expect(readParticleGrouping()).toBe(false);
});
