import { describe, it, expect } from "vitest";
import { getGravityLevel } from "../../src/gravity/campaign";
import { generateGravityLevel, verifyLevel } from "../../src/gravity/generator";
import {
  createState,
  goalProgress,
  objectiveText,
} from "../../src/gravity/simulation";
import {
  buildEndlessGravityLevel,
  ENDLESS_LAYOUT_IDS,
} from "../../src/gravity/endless";
import { gravityDifficulty } from "../../src/gravity/difficulty";
const target = (index: number) =>
  goalProgress(createState(generateGravityLevel(42, index))).target;
describe("steadily increasing endless Gravity", () => {
  it("offers broad visible variety immediately without recent formation repeats", () => {
    const fingerprints = new Set<string>(),
      recent: string[] = [];
    for (let index = 45; index < 103; index++) {
      const level = generateGravityLevel(137, index);
      const canonical = buildEndlessGravityLevel(137, 45, level.layout!, 0);
      const fingerprint = JSON.stringify({
        bodies: canonical.bodies,
        physics: canonical.physics,
        motions: canonical.motions,
      });
      expect(recent.slice(-5)).not.toContain(fingerprint);
      recent.push(fingerprint);
      fingerprints.add(fingerprint);
    }
    expect(fingerprints.size).toBeGreaterThanOrEqual(25);
  });
  it("describes mixed population goals without timed conditions", () => {
    expect(objectiveText(generateGravityLevel(42, 46))).not.toMatch(
      /hold|seconds/i,
    );
    const mixed = objectiveText(
      buildEndlessGravityLevel(42, 10000, "hexagon", 0),
    );
    expect(mixed).toContain("8 planets across 6 cores for 3 revolutions");
    expect(mixed.length).toBeLessThan(150);
    expect(
      objectiveText(buildEndlessGravityLevel(42, 10000, "binary-wide", 0)),
    ).toContain("8 planets orbiting both cores for 3 revolutions");
  });
  it("proves every eligible formation at the maximum physical demand", () => {
    expect(ENDLESS_LAYOUT_IDS.length).toBeGreaterThanOrEqual(20);
    for (const id of ENDLESS_LAYOUT_IDS) {
      const level = buildEndlessGravityLevel(42, 1000000000, id, 0);
      expect(level.objective.hold).toBe(0);
      expect(goalProgress(createState(level)).target).toBe(8);
      expect(level.objective.turns).toBe(3);
      expect(createState(level).physics.planetGravity, id).toBe(true);
      level.witness.forEach((shot, i) => {
        expect(shot.power, id).toBeLessThanOrEqual(1);
        if (i)
          expect(
            shot.time - level.witness[i - 1].time,
            id,
          ).toBeGreaterThanOrEqual(0.299);
      });
      expect(verifyLevel(level), id).toBe(true);
    }
  }, 60000);
  it("replays maximum-demand interaction witnesses under representative rotations and seeds", () => {
    for (const [seed, rotation] of [
      [7, 0.371],
      [137, 1.413],
    ])
      for (const id of ENDLESS_LAYOUT_IDS) {
        const level = buildEndlessGravityLevel(seed, 1000000000, id, rotation);
        expect(verifyLevel(level), `${seed}/${rotation}: ${id}`).toBe(true);
      }
  }, 60000);
  it("retains the exact requested budget and whole solution in canonical fallbacks", () => {
    for (const id of ENDLESS_LAYOUT_IDS)
      for (const index of [45, 60, 75, 90, 65535]) {
        const canonical = buildEndlessGravityLevel(42, index, id, 0),
          profile = gravityDifficulty(index);
        expect(goalProgress(createState(canonical)).target).toBe(
          profile.population,
        );
        expect(canonical.objective).toMatchObject({
          turns: profile.turns,
          hold: 0,
        });
        expect(canonical.witness).toHaveLength(8);
      }
    expect(buildEndlessGravityLevel(42, 45, "elastic-pair", 0).witness).toEqual(
      buildEndlessGravityLevel(42, 65535, "elastic-pair", 0).witness,
    );
  });
  it("keeps the profile nondecreasing at distant indices without increasing physical force", () => {
    const indices = [
      45,
      46,
      78,
      79,
      112,
      113,
      104,
      105,
      224,
      225,
      284,
      285,
      1000,
      10000,
      65535,
      Number.MAX_SAFE_INTEGER - 1,
    ].sort((a, b) => a - b);
    let previous = { population: 0, turns: 0 };
    for (const index of indices) {
      const profile = gravityDifficulty(index);
      for (const key of ["population", "turns"] as const)
        expect(profile[key]).toBeGreaterThanOrEqual(previous[key]);
      previous = profile;
    }
    const early = buildEndlessGravityLevel(42, 45, "moving-carousel", 0),
      late = buildEndlessGravityLevel(42, 10000, "moving-carousel", 0);
    expect(late.bodies).toEqual(early.bodies);
    expect(late.physics).toEqual(early.physics);
    expect(late.motions).toEqual(early.motions);
  });
  it("preserves every authored population and revolution goal with interaction enabled", () => {
    const populations = [
      1, 2, 4, 5, 2, 7, 2, 1, 2, 6, 1, 2, 3, 4, 3, 3, 3, 4, 4, 5, 5, 5, 4, 6, 5,
      6, 5, 5, 5, 1, 1, 4, 12, 9, 4, 7, 10, 8, 2, 2, 4, 8, 8, 15, 6,
    ];
    populations.forEach((count, index) => {
      const state = createState(getGravityLevel(42, index));
      expect(goalProgress(state).target, `campaign ${index}`).toBe(count);
      expect(state.level.objective.turns).toBe(index === 44 ? 2 : 1);
      expect(state.physics.planetGravity).toBe(true);
    });
  });
  it("increases the actual required population instead of resetting it with a layout", () => {
    expect(target(45)).toBe(6);
    expect(target(60)).toBe(7);
    expect(target(75)).toBe(8);
    expect(generateGravityLevel(42, 45).objective).toMatchObject({
      turns: 2,
      hold: 0,
    });
    expect(generateGravityLevel(42, 90).objective.turns).toBe(3);
    expect(target(10000)).toBe(8);
  });
  it("keeps each consecutive objective budget nondecreasing and physically solvable", () => {
    let previous = { count: 0, turns: 0 };
    for (let index = 45; index < 180; index++) {
      const level = generateGravityLevel(42, index),
        count = goalProgress(createState(level)).target;
      expect(count, `${index} ${level.layout}`).toBeGreaterThanOrEqual(
        previous.count,
      );
      expect(level.objective.turns).toBeGreaterThanOrEqual(previous.turns);
      expect(level.objective.hold).toBe(0);
      expect(verifyLevel(level), `${index} ${level.layout}`).toBe(true);
      previous = {
        count,
        turns: level.objective.turns,
      };
    }
  }, 60000);
});
