import { describe, expect, it } from "vitest";
import {
  generateGravityLevel,
  verifyLevel,
  witnessCompletionTime,
} from "../../src/gravity/generator";
import { distance } from "../../src/game/physics";
describe("procedural Gravity puzzles", () => {
  it("varies objective order by seed from the very first puzzle", () => {
    const sequence = (seed: number) =>
      Array.from({ length: 6 }, (_, n) => generateGravityLevel(seed, n).family);
    expect(sequence(7)).not.toEqual(sequence(42));
  });
  it("replays a seed exactly and changes layouts on successive levels", () => {
    expect(generateGravityLevel(42, 17)).toEqual(generateGravityLevel(42, 17));
    expect(generateGravityLevel(42, 18).bodies).not.toEqual(
      generateGravityLevel(42, 17).bodies,
    );
  });
  it("produces 120 playable varied levels with clear launchers and no consecutive repeated families", () => {
    const families = new Set<string>(),
      layouts = new Set<string>();
    let previous = "";
    for (let index = 0; index < 120; index++) {
      const level = generateGravityLevel(42, index);
      expect(verifyLevel(level), `level ${index} ${level.family}`).toBe(true);
      expect(
        level.bodies.every(
          (b) => distance(b.position, level.launch) > b.radius + 15,
        ),
      ).toBe(true);
      expect(level.family).not.toBe(previous);
      previous = level.family;
      families.add(level.family);
      layouts.add(JSON.stringify(level.bodies));
    }
    expect(families.size).toBe(5);
    expect(layouts.size).toBe(120);
  }, 60000);
  it("keeps only repellers that delay a verified solution", () => {
    let withObstacles = 0;
    for (let seed = 0; seed < 4; seed++)
      for (let index = 0; index < 10; index++) {
        const level = generateGravityLevel(seed, index),
          repellers = level.bodies.filter((body) => body.kind === "repellent");
        expect(repellers.length).toBeLessThanOrEqual(2);
        if (!repellers.length) continue;
        withObstacles++;
        const unobstructed = {
          ...level,
          bodies: level.bodies.filter((body) => body.kind === "attractor"),
        };
        const easyTime = witnessCompletionTime(unobstructed),
          obstacleTime = witnessCompletionTime(level);
        expect(easyTime).not.toBeNull();
        expect(obstacleTime).not.toBeNull();
        expect(obstacleTime!).toBeGreaterThanOrEqual(easyTime! + 0.5);
      }
    expect(withObstacles).toBeGreaterThan(0);
  }, 60000);
  it("keeps distant levels and unsigned seed boundaries playable", () => {
    for (const seed of [1, 2, 137, 4294967295]) {
      for (const index of [4, 10, 53, 100, 999, 65535]) {
        const level = generateGravityLevel(seed, index);
        expect(verifyLevel(level), `seed ${seed}, level ${index}`).toBe(true);
      }
    }
  }, 60000);
});
