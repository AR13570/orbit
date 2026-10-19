import { expect, it } from "vitest";
import { CAMPAIGN_DESIGNS } from "../../src/gravity/campaign-design";
import { getGravityLevel } from "../../src/gravity/campaign";
import { CAMPAIGN_ENDLESS_IDS } from "../../src/gravity/campaign-endless";
import evidence from "../../docs/verification/stable-campaign.json";

it("paces local loops with different objectives and a shared three-planet finale", () => {
  expect(CAMPAIGN_DESIGNS).toHaveLength(45);
  let singleCoreStreak = 0;
  const last = new Map<string, number>();
  for (const [index, design] of CAMPAIGN_DESIGNS.entries()) {
    singleCoreStreak = design.cores.length === 1 ? singleCoreStreak + 1 : 0;
    expect(
      singleCoreStreak,
      `single-core streak at level ${index + 1}`,
    ).toBeLessThanOrEqual(3);
    const previous = last.get(design.layout);
    if (previous !== undefined)
      expect(
        index - previous,
        `base recurrence at level ${index + 1}`,
      ).toBeGreaterThanOrEqual(4);
    last.set(design.layout, index);
    const row = evidence.campaign.find((entry) => entry.index === index);
    expect(row).toMatchObject({
      base: design.layout,
      field: design.field,
      population: design.population,
    });
  }
  const finale = getGravityLevel(42, 44);
  expect(finale.sharedOrbit?.length).toBeGreaterThan(1);
  expect(finale.objective.count).toBe(3);
  expect(finale.objective.turns).toBeGreaterThanOrEqual(2);
});

it("preserves the stable endless profile order when campaign pacing changes", () => {
  expect(CAMPAIGN_ENDLESS_IDS).toEqual([
    "open-sky:gentle",
    "neighbouring-systems:gentle",
    "common-centre:gentle",
    "the-shield:gentle",
    "long-channel:gentle",
    "the-divide:gentle",
    "open-crown:gentle",
    "closed-garden:gentle",
    "broken-necklace:gentle",
    "open-sky:deep",
    "common-centre:deep",
    "the-shield:deep",
    "long-channel:deep",
    "open-crown:deep",
    "closed-garden:deep",
    "broken-necklace:deep",
    "open-sky:broad",
    "the-shield:broad",
    "long-channel:broad",
    "closed-garden:broad",
  ]);
});
