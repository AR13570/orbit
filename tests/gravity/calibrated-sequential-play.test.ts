import { expect, it } from "vitest";
import { getGravityLevel } from "../../src/gravity/campaign";
import {
  buildCampaignEndlessLevel,
  CAMPAIGN_ENDLESS_IDS,
} from "../../src/gravity/campaign-endless";
import { GRAVITY_SPEED_SCALE } from "../../src/gravity/physics";
import { stableProof } from "./stable-authoring-utils";

it("keeps campaign and endless fields solvable with at least 3.5 real seconds between individual launches", () => {
  const levels = [
    ...Array.from({ length: 45 }, (_, index) => getGravityLevel(42, index)),
    ...CAMPAIGN_ENDLESS_IDS.flatMap((profile) =>
      [45, 85, 125].map((index) =>
        buildCampaignEndlessLevel(42, index, profile),
      ),
    ),
  ];
  for (const level of levels) {
    // Give each subsequent shot five additional physical seconds of thinking time.
    const shots = level.witness.map((shot, index) => ({
      ...shot,
      time: shot.time + index * 5,
    }));
    for (let i = 1; i < shots.length; i++)
      expect(
        (shots[i].time - shots[i - 1].time) / GRAVITY_SPEED_SCALE,
      ).toBeGreaterThanOrEqual(3.5);
    for (const [radius, mass] of [
      [6, 1],
      [32, 4],
    ]) {
      const proof = stableProof(level, shots, {
        name: "calibrated human play",
        radius,
        mass,
        postCompletionSeconds: 30,
        postCompletionLaps: 2,
      });
      expect(
        proof.ok,
        `${level.title}/${level.index}/radius ${radius}: ${JSON.stringify(proof)}`,
      ).toBe(true);
    }
  }
}, 60000);
