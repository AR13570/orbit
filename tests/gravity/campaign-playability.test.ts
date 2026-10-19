import { expect, it } from "vitest";
import { getGravityLevel } from "../../src/gravity/campaign";
import { proofScenarios, stableProof } from "./stable-authoring-utils";
for (const size of ["small-maximum", "maximum"])
  it(`all 45 campaigns retain every planet for 120 seconds and 10 more laps at ${size}`, () => {
    for (let index = 0; index < 45; index++) {
      const level = getGravityLevel(42, index),
        scenario = proofScenarios(level).find((s) => s.name === size)!;
      const result = stableProof(level, level.witness, scenario);
      expect(
        result.ok,
        `${index + 1}: ${level.title}: ${JSON.stringify(result)}`,
      ).toBe(true);
      expect(result.duration - result.completion!).toBeGreaterThanOrEqual(120);
      expect(result.minimumLaps).toBeGreaterThanOrEqual(10);
    }
  }, 60000);
