import { it, expect } from "vitest";
import {
  generateGravityLevel,
  verifyGeneratedLevel,
} from "../../src/gravity/generator";
import { CAMPAIGN_DESIGNS } from "../../src/gravity/campaign-design";
import {
  buildCampaignEndlessLevel,
  campaignEndlessBlueprint,
  campaignEndlessDifficulty,
  campaignEndlessLayoutId,
  ENDLESS_CAMPAIGN_TEMPLATES,
  CAMPAIGN_ENDLESS_IDS,
} from "../../src/gravity/campaign-endless";
import {
  createState,
  goalProgress,
  objectiveText,
} from "../../src/gravity/simulation";
it("reshuffles developed campaign templates while alternating actual goal families", () => {
  for (const seed of [0, 7, 42, 137, 0xffffffff]) {
    const last = new Map<string, string>(),
      seen = new Set<string>(),
      recent: string[] = [];
    for (let index = 45; index < 165; index++) {
      const id = campaignEndlessLayoutId(seed, index);
      const template = CAMPAIGN_DESIGNS.findIndex((d) => d.layout === id);
      expect(template).toBeGreaterThanOrEqual(0);
      const goal = CAMPAIGN_DESIGNS[template].goal;
      const family = goal === "orbit" || goal === "counter" ? "local" : goal;
      expect(last.get(family)).not.toBe(id);
      last.set(family, id);
      seen.add(id);
      recent.push(family);
      if (recent.length >= 6)
        expect(new Set(recent.slice(-6))).toEqual(
          new Set(["local", "shared", "relay"]),
        );
    }
    expect(seen).toEqual(new Set(CAMPAIGN_ENDLESS_IDS));
  }
});
it("raises a global bounded demand without increasing population or physical speed", () => {
  expect(
    [45, 75, 105, Number.MAX_SAFE_INTEGER - 1].map(
      (i) => campaignEndlessDifficulty(i).band,
    ),
  ).toEqual([0, 1, 2, 2]);
  for (const template of ENDLESS_CAMPAIGN_TEMPLATES) {
    let previous = campaignEndlessBlueprint(template, 0);
    for (const band of [1, 2]) {
      const next = campaignEndlessBlueprint(template, band);
      expect(next.bodies).toEqual(previous.bodies);
      expect(next.physics).toEqual(previous.physics);
      expect(next.motions).toEqual(previous.motions);
      expect(next.objective.count).toBe(previous.objective.count);
      expect(next.objective.turns).toBeGreaterThanOrEqual(
        previous.objective.turns,
      );
      expect(next.objective.turns).toBeLessThanOrEqual(3);
      for (let i = 0; i < (next.journey?.legs.length ?? 0); i++) {
        const leg = next.journey!.legs[i];
        expect(leg.sweep).toBeGreaterThanOrEqual(
          previous.journey!.legs[i].sweep,
        );
        if (previous.journey!.legs[i].sweep === Math.PI * 2)
          expect(leg.sweep).toBe(Math.PI * 2);
      }
      previous = next;
    }
  }
});
it("verifies every template and difficulty band at calibrated sizes and outermost bounds", () => {
  for (const id of CAMPAIGN_ENDLESS_IDS)
    for (const index of [45, 75, 105]) {
      const level = buildCampaignEndlessLevel(42, index, id, 0);
      expect(verifyGeneratedLevel(level), `${id}/${index}`).toBe(true);
      expect(goalProgress(createState(level)).target).toBeLessThanOrEqual(4);
      expect(level.objective.hold).toBe(0);
      expect(level.physics?.planetGravity).toBe(true);
      expect(level.physics?.planetCollisions).toBe("none");
      expect(objectiveText(level)).not.toMatch(/seconds|hold/i);
      level.witness.forEach((shot, i) => {
        expect(shot.power).toBeLessThanOrEqual(1);
        if (i)
          expect(shot.time - level.witness[i - 1].time).toBeGreaterThanOrEqual(
            0.3 - 1e-9,
          );
      });
    }
}, 60000);
it("preserves relays, captures, directions and shared goals under rotation and reflection", () => {
  for (const id of CAMPAIGN_ENDLESS_IDS)
    for (const reflected of [false, true]) {
      const level = buildCampaignEndlessLevel(137, 105, id, 0.731, reflected);
      expect(verifyGeneratedLevel(level), `${id}/${reflected}`).toBe(true);
      const normal = buildCampaignEndlessLevel(137, 105, id, 0.731);
      expect(level.journey).toEqual(normal.journey);
      expect(level.sharedOrbit).toEqual(normal.sharedOrbit);
      expect(level.sharedCounter).toBe(normal.sharedCounter);
      for (let i = 0; i < (level.requirements?.length ?? 0); i++) {
        const direction = normal.requirements![i].direction;
        expect(level.requirements![i].direction).toBe(
          reflected && direction
            ? direction === "clockwise"
              ? "counterclockwise"
              : "clockwise"
            : direction,
        );
      }
    }
}, 60000);
it("continues through distant indices with new campaign mechanics and no easier fallback", () => {
  for (const index of [
    45,
    46,
    75,
    105,
    106,
    1000,
    10000,
    65535,
    Number.MAX_SAFE_INTEGER - 1,
  ]) {
    const level = generateGravityLevel(42, index);
    expect(CAMPAIGN_ENDLESS_IDS).toContain(level.layout);
    expect(verifyGeneratedLevel(level), `${index}/${level.layout}`).toBe(true);
  }
}, 60000);
