import { expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { getGravityLevel } from "../../src/gravity/campaign";
import { fitGravityFrame } from "../../src/gravity/renderer";
it("gathers a nearby sequential launch in the fitted mobile campaign field", () => {
  const engine = new GravityEngine(42, undefined, getGravityLevel);
  engine.goTo(11);
  engine.setTimeScale(1);
  engine.setParticleInteraction(true);
  engine.setParticleGrouping(true);
  const level = engine.getLevel();
  engine.setDefaultViewScale(fitGravityFrame(level, 492, 818).camera.scale);
  engine.setProjectileSize(1.4);
  const shot = level.witness[0];
  engine.setLaunch(shot.position!, { angle: shot.angle, power: shot.power });
  engine.launch();
  for (let n = 0; n < 90; n++) engine.update(1 / 120);
  const first = engine.getSnapshot().particles[0],
    core = level.bodies.find((b) => b.kind === "attractor")!;
  const dx = first.position.x - core.position.x,
    dy = first.position.y - core.position.y,
    r = Math.hypot(dx, dy);
  const separation =
    first.radius + engine.getSnapshot().physics.planetRadius + 20;
  engine.launchFrom(
    {
      x: first.position.x - (dy / r) * separation,
      y: first.position.y + (dx / r) * separation,
    },
    { ...first.velocity },
  );
  let touching = 0,
    minimumGap = Infinity;
  for (let n = 0; n < 960; n++) {
    engine.update(1 / 120);
    const particles = engine
      .getRenderSnapshot()
      .particles.filter((p) => p.alive);
    if (particles.length !== 2) break;
    const [a, b] = particles;
    const gap =
      Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y) -
      a.radius -
      b.radius;
    minimumGap = Math.min(minimumGap, gap);
    if (gap < 0.01) touching++;
  }
  expect(minimumGap).toBeGreaterThanOrEqual(-1e-6);
  expect(touching).toBeGreaterThan(120);
  expect(engine.getSnapshot().particles.filter((p) => p.alive)).toHaveLength(2);
});
it("keeps enlarged-particle attraction conservative and mass weighted with the original far field", async () => {
  const { createState, fireFrom } =
    await import("../../src/gravity/simulation");
  const { planetAccelerations, particlePairPotential } =
    await import("../../src/gravity/physics");
  const level = getGravityLevel(42, 11);
  level.bodies = [];
  const state = createState(level);
  fireFrom(state, { x: 0, y: 0 }, { x: 0, y: 0 });
  fireFrom(state, { x: 52, y: 0 }, { x: 0, y: 0 });
  const [a, b] = state.particles;
  a.radius = 20;
  a.mass = 2;
  b.radius = 32;
  b.mass = 4;
  for (const distance of [1, 52, 60, 120, 155.99, 156, 156.01, 240]) {
    b.position.x = distance;
    const [first, second] = planetAccelerations(
      state.particles,
      [],
      state.physics,
    );
    b.position.x = distance + 1e-4;
    const above = particlePairPotential(
      a,
      b,
      state.physics.planetGravityStrength,
    );
    b.position.x = distance - 1e-4;
    const below = particlePairPotential(
      a,
      b,
      state.physics.planetGravityStrength,
    );
    expect(first.x).toBeCloseTo((above - below) / 2e-4 / a.mass, 5);
    expect(first.x * a.mass + second.x * b.mass).toBeCloseTo(0, 10);
    expect(first.x).toBeGreaterThan(0);
    if (distance === 240)
      expect(first.x).toBeCloseTo(
        (state.physics.planetGravityStrength * 4 * 240) /
          (240 * 240 + 26 * 26) ** 1.5,
        11,
      );
  }
});
