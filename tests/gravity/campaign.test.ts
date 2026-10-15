import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_LEVEL_COUNT,
  getCampaignCatalog,
  getGravityLevel,
} from "../../src/gravity/campaign";
import {
  verifyLevel,
  witnessCompletionTime,
} from "../../src/gravity/generator";

describe("reference inspired authored campaign", () => {
  it("constructs the campaign catalog within an interactive startup budget", () => {
    const started = performance.now();
    getCampaignCatalog();
    expect(performance.now() - started).toBeLessThan(100);
  });
  it("has 45 authored entries with at least 24 genuinely named geometries", () => {
    expect(CAMPAIGN_LEVEL_COUNT).toBe(45);
    const catalog = getCampaignCatalog();
    expect(catalog).toHaveLength(45);
    expect(
      new Set(catalog.map((entry) => entry.family)).size,
    ).toBeGreaterThanOrEqual(24);
    expect(getGravityLevel(7, 0).bodies).toEqual(getGravityLevel(42, 0).bodies);
  });
  it("verifies every authored witness using the actual simulation", () => {
    for (let index = 0; index < 45; index++) {
      const level = getGravityLevel(42, index);
      expect(verifyLevel(level), `${index}: ${level.title}`).toBe(true);
      expect(level.index).toBe(index);
      level.witness.forEach((shot, shotIndex) => {
        expect(shot.power, `${index}: shot ${shotIndex}`).toBeLessThanOrEqual(
          1,
        );
        if (shotIndex)
          expect(
            shot.time - level.witness[shotIndex - 1].time,
            `${index}: shot ${shotIndex}`,
          ).toBeGreaterThanOrEqual(0.299);
      });
      for (const body of level.bodies) {
        expect(body.position.x - body.radius).toBeGreaterThan(0);
        expect(body.position.x + body.radius).toBeLessThan(900);
        expect(body.position.y - body.radius).toBeGreaterThan(0);
        expect(body.position.y + body.radius).toBeLessThan(900);
      }
    }
  }, 60000);
  it("moves into endless play, remains deterministic and protects cached data", () => {
    expect(getGravityLevel(42, 44).source).toBe("campaign");
    expect(getGravityLevel(42, 45).source).toBe("procedural");
    expect(getGravityLevel(42, 10000).index).toBe(10000);
    const level = getGravityLevel(42, 12),
      pristine = structuredClone(level);
    level.bodies[0].position.x = -100;
    expect(getGravityLevel(42, 12)).toEqual(pristine);
  });
  it("keeps selected witnesses valid with half sized physics steps", () => {
    for (const index of [0, 8, 22, 34, 41, 44])
      expect(
        witnessCompletionTime(getGravityLevel(42, index), 1 / 240),
      ).not.toBeNull();
  }, 60000);
});
