import { expect, it } from "vitest";
import { getGravityLevel } from "../../src/gravity/campaign";
it("requires two complete revolutions and human sequential launches throughout the campaign", () => {
  for (let index = 0; index < 45; index++) {
    const level = getGravityLevel(42, index);
    expect(level.journey).toBeUndefined();
    expect(level.objective.turns).toBeGreaterThanOrEqual(2);
    for (const r of level.requirements ?? [])
      expect(r.turns ?? level.objective.turns).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < level.witness.length; i++)
      expect(
        level.witness[i].time - level.witness[i - 1].time,
      ).toBeGreaterThanOrEqual(4.8);
  }
});

it("uses only generated transforms backed by complete offline survival evidence", async () => {
  const { default: transforms } =
    await import("../../src/gravity/campaign-endless-transforms.json");
  const { default: evidence } =
    await import("../../docs/verification/stable-campaign.json");
  for (const [key, variants] of Object.entries(transforms))
    for (const variant of variants) {
      const split = key.lastIndexOf(":"),
        profile = key.slice(0, split),
        band = Number(key.slice(split + 1));
      const proof = evidence.generation.find(
        (p) =>
          p.profile === profile &&
          p.band === band &&
          p.quarter === variant.quarter &&
          p.reflected === variant.reflected,
      );
      expect(
        proof,
        `${key}/${variant.quarter}/${variant.reflected}`,
      ).toBeDefined();
      expect(proof!.accepted).toBe(true);
      expect(proof!.scenarios).toHaveLength(22);
      expect(
        proof!.scenarios.every(
          (s) =>
            s.ok &&
            s.duration - s.completion! >= s.requiredPostCompletionSeconds &&
            s.minimumLaps >= s.requiredPostCompletionLaps,
        ),
      ).toBe(true);
    }
});
