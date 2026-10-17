import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { getGravityLevel } from "../../src/gravity/campaign";

function launchNeighbours(interaction = true) {
  const engine = new GravityEngine(42, getGravityLevel(42, 0));
  engine.setTimeScale(1);
  engine.setParticleGrouping(true);
  engine.setParticleInteraction(interaction);
  const core = engine.getSnapshot().level.bodies[0];
  const speed = Math.sqrt((core.strength * 100) / (100 ** 2 + 40 ** 2));
  engine.launchFrom(
    { x: core.position.x + 100, y: core.position.y },
    { x: 0, y: speed },
  );
  for (let i = 0; i < 36; i++) engine.update(1 / 120);
  const first = engine.getSnapshot().particles[0];
  const angle =
    Math.atan2(
      first.position.y - core.position.y,
      first.position.x - core.position.x,
    ) +
    2 * Math.asin(30 / 200);
  const position = {
    x: core.position.x + 100 * Math.cos(angle),
    y: core.position.y + 100 * Math.sin(angle),
  };
  const velocity = { x: -speed * Math.sin(angle), y: speed * Math.cos(angle) };
  return { engine, position, velocity, core };
}
const separation = (engine: GravityEngine) => {
  const [a, b] = engine.getSnapshot().particles;
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
};

describe("minimum size neighbours around the real first core", () => {
  it.each([1 / 120, 1 / 240])(
    "visibly approaches then remains in surface contact while orbiting with frame interval=%s",
    (dt) => {
      const { engine, position, velocity, core } = launchNeighbours();
      engine.launchFrom(position, velocity);
      const identities = engine
        .getSnapshot()
        .particles.map(({ id, mass, radius }) => ({ id, mass, radius }));
      expect(identities.map(({ mass, radius }) => ({ mass, radius }))).toEqual([
        { mass: 1, radius: 6 },
        { mass: 1, radius: 6 },
      ]);
      const angularMomentum = () =>
        engine
          .getSnapshot()
          .particles.reduce(
            (sum, p) =>
              sum +
              p.mass *
                ((p.position.x - core.position.x) * p.velocity.y -
                  (p.position.y - core.position.y) * p.velocity.x),
            0,
          );
      const initialAngularMomentum = angularMomentum();
      const initial = separation(engine);
      for (let i = 0; i < Math.round(0.15 / dt); i++) engine.update(dt);
      const approaching = separation(engine);
      expect(approaching).toBeLessThan(initial - 1);
      expect(approaching).toBeGreaterThan(20);
      let contactAt: number | undefined;
      let maxLateSeparation = 0;
      for (let i = 0; i < Math.round(12 / dt); i++) {
        engine.update(dt);
        const distance = separation(engine);
        expect(distance).toBeGreaterThanOrEqual(12 - 1e-6);
        if (distance < 12.05) contactAt ??= 0.15 + (i + 1) * dt;
        if (i * dt > 1)
          maxLateSeparation = Math.max(maxLateSeparation, distance);
      }
      expect(contactAt).toBeLessThan(0.6);
      expect(maxLateSeparation).toBeLessThan(12.1);
      const final = engine.getSnapshot();
      expect(final.particles.every((p) => p.alive)).toBe(true);
      expect(angularMomentum()).toBeCloseTo(initialAngularMomentum, 6);
      expect(
        final.particles.map(({ id, mass, radius }) => ({ id, mass, radius })),
      ).toEqual(identities);
      expect(
        final.particles.every(
          (p) => Math.abs(p.orbits[core.id].winding) > Math.PI * 4,
        ),
      ).toBe(true);
    },
  );

  it("leaves the same circular neighbours separate when interaction is switched off", () => {
    const { engine, position, velocity } = launchNeighbours(false);
    engine.launchFrom(position, velocity);
    for (let i = 0; i < 1200; i++) engine.update(1 / 120);
    expect(separation(engine)).toBeGreaterThan(29.9);
    expect(separation(engine)).toBeLessThan(30.1);
    expect(engine.getSnapshot().particles.every((p) => p.alive)).toBe(true);
  });

  it("predicts the encounter using the same captured world as live flight", () => {
    const { engine, position, velocity } = launchNeighbours();
    const before = engine.getSnapshot();
    const prediction = engine.predictFrom(position, velocity, 2);
    expect(engine.getSnapshot()).toEqual(before);
    engine.launchFrom(position, velocity);
    for (let i = 0; i < 240; i++) engine.update(1 / 120);
    const actual = engine.getSnapshot().particles[1].position;
    expect(actual.x).toBeCloseTo(prediction.at(-1)!.x, 8);
    expect(actual.y).toBeCloseTo(prediction.at(-1)!.y, 8);
  });
});
