import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exportDraft,
  importDraft,
  levelShareUrl,
  sharedDraft,
  newDraft,
  parseDraft,
  toGravityLevel,
  MAX_PORTABLE_LENGTH,
} from "../../src/gravity/creator/model";
import { resolveGravitySeed } from "../../src/gravity/seed";
beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("portable Gravity skies", () => {
  it("round trips unicode names, per-core goals and physics in a bounded URL", () => {
    const sky = newDraft();
    sky.name = "Ciel étoilé ☄";
    sky.objective.kind = "paired";
    sky.requirements = [
      {
        bodyId: sky.bodies[0].id,
        count: 3,
        turns: 2,
        direction: "counterclockwise",
      },
    ];
    sky.physics = {
      planetGravity: true,
      bodyCollisions: false,
      planetCollisions: "elastic",
      trailSeconds: 30,
    };
    const url = new URL(
      levelShareUrl(sky, "https://orbit.example/?mode=odessey&seed=17#old"),
    );
    expect(url.searchParams.get("mode")).toBe("creator");
    expect(url.searchParams.has("seed")).toBe(false);
    expect(url.hash).toBe("");
    expect(sharedDraft(url.search)).toEqual(sky);
    expect(importDraft(exportDraft(sky))).toEqual(sky);
    expect(toGravityLevel(sky).requirements).toEqual(sky.requirements);
  });
  it("preserves legacy drafts without silently opting them into new physics", () => {
    const legacy = newDraft();
    delete legacy.physics;
    expect(parseDraft(legacy).physics).toBeUndefined();
    expect(toGravityLevel(legacy).physics).toBeUndefined();
  });
  it("rejects malformed links, excessive input and invalid physical values", () => {
    expect(() => sharedDraft("?sky=%%%bad")).toThrow(/invalid/);
    expect(() =>
      sharedDraft(`?sky=${"a".repeat(MAX_PORTABLE_LENGTH + 1)}`),
    ).toThrow(/large/);
    expect(() => importDraft("x".repeat(MAX_PORTABLE_LENGTH + 1))).toThrow(
      /large/,
    );
    const sky = newDraft();
    expect(() =>
      parseDraft({ ...sky, physics: { planetGravity: "true" } }),
    ).toThrow();
    expect(() =>
      parseDraft({ ...sky, physics: { planetCollisions: "explode" } }),
    ).toThrow();
    expect(() =>
      parseDraft({ ...sky, physics: { planetMass: Infinity } }),
    ).toThrow();
    expect(() =>
      parseDraft({ ...sky, requirements: [{ bodyId: "missing", count: 1 }] }),
    ).toThrow();
    expect(() =>
      parseDraft({
        ...sky,
        requirements: [{ bodyId: sky.bodies[0].id, count: 999 }],
      }),
    ).toThrow();
  });
});
describe("Gravity seed persistence", () => {
  it("keeps a random default universe across visits while explicit URL seeds remain independent", () => {
    const first = resolveGravitySeed("");
    expect(Number.isInteger(first)).toBe(true);
    expect(resolveGravitySeed("")).toBe(first);
    expect(localStorage.getItem("orbit.gravity.default-seed.v1")).toBe(
      String(first),
    );
    expect(resolveGravitySeed("?seed=17")).toBe(17);
    expect(resolveGravitySeed("")).toBe(first);
  });
  it("ignores corrupted stored seed values and can still play when storage fails", () => {
    localStorage.setItem("orbit.gravity.default-seed.v1", "Infinity");
    expect(Number.isInteger(resolveGravitySeed(""))).toBe(true);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    const first = resolveGravitySeed("");
    expect(resolveGravitySeed("")).toBe(first);
    expect(resolveGravitySeed("?seed=4")).toBe(4);
  });
});
