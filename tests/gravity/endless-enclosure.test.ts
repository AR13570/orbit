import { expect, it } from "vitest";
import { buildEndlessGravityLevel } from "../../src/gravity/endless";
import { witnessCompletionTime } from "../../src/gravity/generator";
import { createState, goalProgress } from "../../src/gravity/simulation";

it("completes every eight-well-enclosure demand with natural soft contacts across rotations", () => {
  for (const [seed, rotation] of [
    [42, 0],
    [7, 0.371],
    [137, 1.413],
    [0, 2.9],
    [4294967295, 5.8],
  ]) {
    for (const index of [45, 60, 75, 90, 65535]) {
      const level = buildEndlessGravityLevel(
        seed,
        index,
        "eight-well-enclosure",
        rotation,
      );
      const state = createState(level);
      expect(state.physics.planetGravity).toBe(true);
      expect(state.physics.planetCollisions).toBe("soft");
      expect(goalProgress(state).target).toBe(
        index < 60 ? 6 : index < 75 ? 7 : 8,
      );
      expect(level.objective.turns).toBe(index < 90 ? 2 : 3);
      expect(level.witness).toHaveLength(8);
      for (const dt of [1 / 120, 1 / 240]) {
        expect(
          witnessCompletionTime(level, dt),
          `${seed}/${rotation}/${index}/${dt}`,
        ).not.toBeNull();
      }
    }
  }
}, 60000);
