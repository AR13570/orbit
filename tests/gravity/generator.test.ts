import { describe, expect, it } from "vitest";
import { generateGravityLevel, verifyLevel } from "../../src/gravity/generator";
import { GRAVITY_LAYOUTS, buildGravityLayout } from "../../src/gravity/layouts";
import { distance } from "../../src/game/physics";
import { ENDLESS_LAYOUT_IDS } from "../../src/gravity/endless";
import { physicsSettings } from "../../src/gravity/physics";
describe("structural endless Gravity puzzles", () => {
  it("validates every canonical fallback with its actual objective and physics", () => {
    for (const layout of GRAVITY_LAYOUTS) {
      const level = buildGravityLayout(layout, {
        seed: 0,
        index: 0,
        title: layout.id,
        source: "procedural",
      });
      expect(verifyLevel(level), layout.id).toBe(true);
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
    expect(families).toEqual(new Set(ENDLESS_LAYOUT_IDS));
    expect(families.size).toBeGreaterThanOrEqual(20);
    expect(geometries.size).toBeGreaterThan(110);
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
