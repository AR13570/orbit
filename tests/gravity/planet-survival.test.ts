import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { getGravityLevel } from "../../src/gravity/campaign";
import { buildEndlessGravityLevel } from "../../src/gravity/endless";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";

describe("launched planet survival", () => {
  it.each([
    ["new creator sky", () => toGravityLevel(newDraft())],
    ["campaign swarm", () => getGravityLevel(42, 35)],
    [
      "endless swarm",
      () => buildEndlessGravityLevel(42, 45, "merging-swarm", 0),
    ],
  ] as const)(
    "keeps unequal planets distinct when gravity pulls them together in %s",
    (_name, level) => {
      const engine = new GravityEngine(42, level());
      engine.setTimeScale(1);
      engine.setParticleGrouping(true);
      engine.launchFrom({ x: 410, y: 100 }, { x: 0, y: 0 });
      engine.setProjectileSize(2);
      const before = engine.getSnapshot();
      engine.launchFrom(
        {
          x: 410 + before.particles[0].radius + before.physics.planetRadius + 8,
          y: 100,
        },
        { x: 0, y: 0 },
      );
      const original = engine
        .getSnapshot()
        .particles.map(({ id, radius, mass }) => ({ id, radius, mass }));
      const contactDistance = original[0].radius + original[1].radius;
      let closest = Infinity;
      for (let frame = 0; frame < 240; frame++) {
        engine.update(1 / 120);
        const particles = engine.getSnapshot().particles;
        expect(particles.filter((p) => p.alive)).toHaveLength(2);
        expect(
          particles.map(({ id, radius, mass }) => ({ id, radius, mass })),
        ).toEqual(original);
        const distance = Math.hypot(
          particles[0].position.x - particles[1].position.x,
          particles[0].position.y - particles[1].position.y,
        );
        expect(distance).toBeGreaterThanOrEqual(contactDistance - 1e-7);
        closest = Math.min(closest, distance);
      }
      expect(closest).toBeLessThan(contactDistance + 1);
    },
  );
});
