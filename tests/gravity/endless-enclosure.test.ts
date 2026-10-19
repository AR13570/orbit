import { expect, it } from "vitest";
import { buildEndlessGravityLevel } from "../../src/gravity/endless";
import { createState, goalProgress } from "../../src/gravity/simulation";

it("retains the legacy enclosure as an editable central goal surrounded by eight independent wells", () => {
  const original = buildEndlessGravityLevel(42, 90, "eight-well-enclosure", 0);
  for (const [seed, rotation] of [
    [42, 0],
    [7, 0.371],
    [137, 1.413],
  ]) {
    const level = buildEndlessGravityLevel(
      seed,
      90,
      "eight-well-enclosure",
      rotation,
    );
    const state = createState(level);
    expect(level.bodies).toHaveLength(9);
    expect(new Set(level.bodies.map((body) => body.id)).size).toBe(9);
    expect(level.requirements).toEqual([
      { bodyId: "well-1", count: 8, turns: 3 },
    ]);
    expect(goalProgress(state).target).toBe(8);
    expect(state.physics).toMatchObject({
      planetGravity: true,
      planetCollisions: "soft",
      planetRadius: 6,
    });
    expect(level.witness).toHaveLength(8);
    for (let i = 0; i < level.bodies.length; i++) {
      const body = level.bodies[i],
        base = original.bodies[i];
      expect({ ...body, position: base.position }).toEqual(base);
      expect(
        Math.hypot(body.position.x - 450, body.position.y - 450),
      ).toBeCloseTo(
        Math.hypot(base.position.x - 450, base.position.y - 450),
        8,
      );
    }
  }
});
