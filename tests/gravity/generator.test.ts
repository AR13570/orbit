import { describe, expect, it } from "vitest";
import { generateGravityLevel, verifyLevel } from "../../src/gravity/generator";
import { buildCampaignEndlessLevel } from "../../src/gravity/campaign-endless";
import { distance } from "../../src/game/physics";
import { CAMPAIGN_ENDLESS_IDS as ENDLESS_LAYOUT_IDS } from "../../src/gravity/campaign-endless";
import { physicsSettings } from "../../src/gravity/physics";
describe("structural endless Gravity puzzles", () => {
  it("validates each current proved field at every demand band", () => {
    for (const profile of ENDLESS_LAYOUT_IDS)
      for (const index of [45, 85, 125]) {
        const level = buildCampaignEndlessLevel(42, index, profile);
        expect(verifyLevel(level), `${profile}/${index}`).toBe(true);
      }
  }, 60000);
  it("traverses every structural family without immediate repetition and replays all generated witnesses", () => {
    const families = new Set<string>(),
      geometries = new Set<string>();
    let previous = "";
    for (let index = 45; index < 165; index++) {
      const level = generateGravityLevel(42, index);
      const physics = physicsSettings(level.physics);
      expect(verifyLevel(level), `${index}: ${level.layout}`).toBe(true);
      expect(level.layout).not.toBe(previous);
      previous = level.layout!;
      families.add(level.layout!);
      geometries.add(
        JSON.stringify({
          bodies: level.bodies,
          physics: level.physics,
          motions: level.motions,
          requirements: level.requirements,
          objective: level.objective,
        }),
      );
      expect(
        level.bodies.every(
          (body) =>
            distance(body.position, level.launch) >
            body.radius + physics.planetRadius,
        ),
      ).toBe(true);
      expect(
        level.bodies.every(
          (body) => Number.isFinite(body.strength) && body.strength > 0,
        ),
      ).toBe(true);
    }
    expect(families.size).toBe(9);
    expect(ENDLESS_LAYOUT_IDS.length).toBeGreaterThanOrEqual(9);
    expect(families.size).toBe(9);
    expect(geometries.size).toBeGreaterThanOrEqual(ENDLESS_LAYOUT_IDS.length);
  }, 60000);
  it("varies seed distribution, protects cached data and preserves structural goal semantics", () => {
    const sequence = (seed: number) =>
      Array.from({ length: 6 }, (_, n) => generateGravityLevel(seed, n).layout);
    expect(sequence(7)).not.toEqual(sequence(42));
    const original = generateGravityLevel(42, 17),
      expected = structuredClone(original);
    original.bodies.pop();
    expect(generateGravityLevel(42, 17)).toEqual(expected);
    for (let index = 0; index < 34; index++) {
      const level = generateGravityLevel(42, index);
      if (level.layout === "binary-wide") expect(level.family).toBe("tour");
      if (level.layout === "counterflow") expect(level.family).toBe("counter");
    }
  });
  it("handles distant indices, invalid inputs and unsigned seed boundaries without caps", () => {
    for (const seed of [1, 2, 137, 4294967295, NaN, Infinity, -8])
      for (const index of [4, 53, 999, 10000, 65535, NaN, Infinity, -9]) {
        const level = generateGravityLevel(seed, index);
        expect(verifyLevel(level), `${seed}/${index}: ${level.layout}`).toBe(
          true,
        );
        expect(Number.isSafeInteger(level.index)).toBe(true);
      }
    expect(generateGravityLevel(42, 10000).index).toBe(10000);
  }, 60000);
  it("keeps cold generation within a bounded interactive budget", () => {
    const started = performance.now();
    for (let index = 0; index < 34; index++)
      generateGravityLevel(0xabcd1234, index + 20000);
    expect(performance.now() - started).toBeLessThan(4000);
  });
});
