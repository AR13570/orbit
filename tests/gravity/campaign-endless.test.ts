import { expect, it } from "vitest";
import { generateGravityLevel, verifyLevel } from "../../src/gravity/generator";
import {
  campaignEndlessLayoutId,
  CAMPAIGN_ENDLESS_IDS,
  campaignEndlessDifficulty,
} from "../../src/gravity/campaign-endless";
it("deterministically shuffles proved field profiles without immediate identical-profile repeats", () => {
  for (const seed of [0, 7, 42, 137, 0xffffffff])
    for (const start of [45, 10002, Number.MAX_SAFE_INTEGER - 30]) {
      const sequence = Array.from({ length: 24 }, (_, i) =>
        campaignEndlessLayoutId(seed, start + i),
      );
      sequence.forEach((id, i) => {
        expect(CAMPAIGN_ENDLESS_IDS).toContain(id);
        if (i) expect(id.split(":")[0]).not.toBe(sequence[i - 1].split(":")[0]);
      });
    }
  expect(
    Array.from({ length: 10 }, (_, i) => campaignEndlessLayoutId(7, 45 + i)),
  ).not.toEqual(
    Array.from({ length: 10 }, (_, i) => campaignEndlessLayoutId(42, 45 + i)),
  );
});
it("raises population and full revolution demand only to explicitly proved ceilings", () => {
  expect(campaignEndlessDifficulty(45).band).toBe(0);
  expect(campaignEndlessDifficulty(85).band).toBe(1);
  expect(campaignEndlessDifficulty(125).band).toBe(2);
  expect(campaignEndlessDifficulty(99999).band).toBe(2);
  for (const index of [45, 85, 125, 99999]) {
    const level = generateGravityLevel(42, index);
    expect(level.objective.turns).toBeGreaterThanOrEqual(2);
    expect(level.objective.turns).toBeLessThanOrEqual(
      2 + campaignEndlessDifficulty(index).band,
    );
    expect(level.journey).toBeUndefined();
    expect(level.objective.hold).toBe(0);
    expect(level.objective.count).toBeLessThanOrEqual(3);
  }
});
it("replays generated objectives, varies orientations and protects cached metadata", () => {
  const shapes = new Set<string>();
  for (let index = 45; index < 85; index++) {
    const level = generateGravityLevel(137, index);
    expect(verifyLevel(level), `${index}: ${level.title}`).toBe(true);
    shapes.add(JSON.stringify(level.bodies));
    const original = structuredClone(level);
    level.bodies.pop();
    expect(generateGravityLevel(137, index)).toEqual(original);
  }
  expect(shapes.size).toBeGreaterThan(9);
}, 60000);
