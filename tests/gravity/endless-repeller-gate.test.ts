import { expect, it } from "vitest";
import { buildEndlessGravityLevel } from "../../src/gravity/endless";
import {
  generateGravityLevel,
  mixGravitySeed,
} from "../../src/gravity/generator";
import { getGravityLevel } from "../../src/gravity/campaign";
import { createState, goalProgress } from "../../src/gravity/simulation";
import {
  campaignEndlessLayoutId,
  CAMPAIGN_ENDLESS_IDS,
} from "../../src/gravity/campaign-endless";

const legacyAuthoringLayouts = [
  "unequal-binary",
  "triple-line",
  "broken-ring",
  "repeller-gate",
  "unequal-chain",
];

it("retains legacy fixtures for authoring without treating their solvability as a runtime gate", () => {
  for (const id of legacyAuthoringLayouts) {
    const retained = buildEndlessGravityLevel(42, 90, id, 0);
    const state = createState(retained);
    expect(retained.layout).toBe(id);
    expect(retained.witness).toHaveLength(8);
    expect(goalProgress(state).target).toBe(8);
    expect(retained.objective.turns).toBe(3);
    expect(state.physics).toMatchObject({
      planetGravity: true,
      planetCollisions: "soft",
      planetRadius: 6,
      planetGravityStrength: 96000,
    });
    expect(
      retained.witness.every((shot) =>
        [
          shot.position!.x,
          shot.position!.y,
          shot.velocity!.x,
          shot.velocity!.y,
        ].every(Number.isFinite),
      ),
    ).toBe(true);
  }
});

it("loads saved endless progress through the current field-profile runtime API", () => {
  const profile = campaignEndlessLayoutId(mixGravitySeed(42, 0), 45);
  expect(CAMPAIGN_ENDLESS_IDS).toContain(profile);
  const level = generateGravityLevel(42, 45);
  expect(level).toEqual(getGravityLevel(42, 45));
  expect(level).toMatchObject({
    index: 45,
    seed: 42,
    source: "procedural",
    layout: profile.split(":")[0],
  });
  expect(legacyAuthoringLayouts).not.toContain(level.layout);
  expect(level.objective.turns).toBeGreaterThanOrEqual(2);
  expect(level.journey).toBeUndefined();
  expect(level.witness.length).toBeGreaterThan(0);
  expect(createState(level).physics).toMatchObject({
    planetGravity: true,
    planetCollisions: "none",
  });
});
