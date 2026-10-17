import { expect, it } from "vitest";
import {
  buildEndlessGravityLevel,
  endlessLayoutId,
  ENDLESS_LAYOUT_IDS,
} from "../../src/gravity/endless";
import {
  generateGravityLevel,
  mixGravitySeed,
  verifyLevel,
} from "../../src/gravity/generator";
import { createState, goalProgress } from "../../src/gravity/simulation";
import { CAMPAIGN_ENDLESS_IDS } from "../../src/gravity/campaign-endless";

const authoringOnly = [
  "unequal-binary",
  "triple-line",
  "broken-ring",
  "repeller-gate",
  "unequal-chain",
];

it("retains unfinished fixtures for authoring while scheduling only verified ENDLESS formations", () => {
  expect(ENDLESS_LAYOUT_IDS).toHaveLength(24);
  for (const id of authoringOnly) {
    expect(ENDLESS_LAYOUT_IDS, id).not.toContain(id);
    const retained = buildEndlessGravityLevel(42, 90, id, 0);
    const state = createState(retained);
    expect(retained.witness, id).toHaveLength(8);
    expect(goalProgress(state).target, id).toBe(8);
    expect(retained.objective.turns, id).toBe(3);
    expect(state.physics.planetGravity, id).toBe(true);
    expect(state.physics.planetCollisions, id).toBe("soft");
    expect(state.physics.planetRadius, id).toBe(6);
    expect(state.physics.planetGravityStrength, id).toBe(96000);
    expect(verifyLevel(retained), id).toBe(false);
  }
  for (const seed of [0, 7, 42, 137, 4294967295]) {
    const selected = Array.from(
      { length: ENDLESS_LAYOUT_IDS.length },
      (_, offset) => endlessLayoutId(mixGravitySeed(seed, 0), 45 + offset),
    );
    expect(new Set(selected), `${seed} formation cycle`).toEqual(
      new Set(ENDLESS_LAYOUT_IDS),
    );
    expect(
      selected.some((id) => authoringOnly.includes(id)),
      `${seed} selection`,
    ).toBe(false);
  }
}, 10000);

it("boots the saved seed 42 and index 45 with a verified ENDLESS formation", () => {
  const level = generateGravityLevel(42, 45);
  expect(level.index).toBe(45);
  expect(level.seed).toBe(42);
  expect(CAMPAIGN_ENDLESS_IDS).toContain(level.layout);
  expect(authoringOnly).not.toContain(level.layout);
  expect(verifyLevel(level)).toBe(true);
});
