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
import { gravityLaunchSpeed } from "../../src/gravity/physics";
describe("stable authored campaign", () => {
  it("constructs 45 honestly identified population and field variants across nine structures promptly", () => {
    const start = performance.now(),
      catalog = getCampaignCatalog();
    expect(performance.now() - start).toBeLessThan(100);
    expect(CAMPAIGN_LEVEL_COUNT).toBe(45);
    expect(catalog).toHaveLength(45);
    expect(new Set(catalog.map((e) => e.family)).size).toBe(9);
    expect(
      new Set(catalog.map((e) => `${e.family}:${e.field}:${e.population}`))
        .size,
    ).toBe(45);
    expect(getGravityLevel(7, 0).bodies).toEqual(getGravityLevel(42, 0).bodies);
  });
  it("replays every objective with reachable humanly sequential shots and physically enlarged cores", () => {
    for (let index = 0; index < 45; index++) {
      const level = getGravityLevel(42, index);
      expect(verifyLevel(level), `${index}: ${level.title}`).toBe(true);
      expect(level.index).toBe(index);
      expect(level.journey).toBeUndefined();
      expect(level.objective.turns).toBe(2);
      expect(level.physics?.planetGravity).toBe(true);
      expect(level.physics?.planetCollisions).toBe("none");
      for (const [i, shot] of level.witness.entries()) {
        expect(
          Math.hypot(shot.velocity!.x, shot.velocity!.y),
        ).toBeLessThanOrEqual(gravityLaunchSpeed(1));
        expect(shot.power).toBeLessThanOrEqual(1);
        if (i)
          expect(shot.time - level.witness[i - 1].time).toBeGreaterThanOrEqual(
            4.8,
          );
      }
      for (const body of level.bodies)
        expect(body.radius).toBeGreaterThanOrEqual(
          body.kind === "attractor" ? 96 : 57,
        );
      if (level.requirements) {
        expect(level.requirements).toHaveLength(
          level.bodies.filter((b) => b.kind === "attractor").length,
        );
        expect(new Set(level.requirements.map((r) => r.count)).size).toBe(1);
      }
    }
  }, 60000);
  it("moves to deterministic generated variants and protects cached state", () => {
    expect(getGravityLevel(42, 44).source).toBe("campaign");
    expect(getGravityLevel(42, 45).source).toBe("procedural");
    expect(getGravityLevel(42, 10000).index).toBe(10000);
    const level = getGravityLevel(42, 12),
      original = structuredClone(level);
    level.bodies[0].position.x = -100;
    expect(getGravityLevel(42, 12)).toEqual(original);
  });
  it("keeps representative witnesses valid with half physics steps", () => {
    for (const index of [0, 1, 2, 5, 8, 24, 35, 44])
      expect(
        witnessCompletionTime(getGravityLevel(42, index), 1 / 240),
      ).not.toBeNull();
  }, 60000);
});
