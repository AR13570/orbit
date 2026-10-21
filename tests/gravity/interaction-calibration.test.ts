import { expect, it } from "vitest";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import { gravityForceAt, planetAccelerations } from "../../src/gravity/physics";
import type { GravityLevel } from "../../src/gravity/types";

const level: GravityLevel = {
  seed: 42,
  index: 0,
  family: "none",
  bounds: { x: -1200, y: -1200, width: 2400, height: 2400 },
  launch: { x: 190, y: 0 },
  bodies: [
    {
      id: "core",
      kind: "attractor",
      position: { x: 0, y: 0 },
      radius: 96,
      strength: 12000000,
      softening: 180,
    },
  ],
  physics: { planetRadius: 6, planetMass: 1, planetCollisions: "none" },
  objective: { kind: "none", count: 0, turns: 2, hold: 0 },
  witness: [],
};

it("gives nearby small planets a noticeable mutual pull beside a full-size campaign core even without grouping", () => {
  const state = createState(level);
  fireFrom(state, { x: 190, y: -20 }, { x: 0, y: 164 });
  fireFrom(state, { x: 190, y: 20 }, { x: 0, y: 164 });
  const on = planetAccelerations(state.particles, level.bodies, state.physics);
  const off = planetAccelerations(state.particles, level.bodies, {
    ...state.physics,
    planetGravity: false,
  });
  const corePull = Math.hypot(off[0].x, off[0].y);
  const mutualPull = Math.hypot(on[0].x - off[0].x, on[0].y - off[0].y);
  expect(mutualPull / corePull).toBeGreaterThan(0.15);
  expect(on[0].y - off[0].y).toBeGreaterThan(0);
  expect(on[1].y - off[1].y).toBeLessThan(0);
});

it("lets nearby planets travelling together settle on their surfaces beside a core when grouping is on", () => {
  const state = createState({
    ...level,
    physics: { ...level.physics, planetCollisions: "soft" },
  });
  const speed = Math.sqrt(-gravityForceAt(level.launch, level.bodies).x * 190);
  for (const angle of [-0.1, 0.1])
    fireFrom(
      state,
      { x: 190 * Math.cos(angle), y: 190 * Math.sin(angle) },
      { x: 0, y: speed },
    );
  let touchingSteps = 0;
  for (let i = 0; i < 120 * 8; i++) {
    step(state, 1 / 120);
    const [a, b] = state.particles;
    const separation = Math.hypot(
      a.position.x - b.position.x,
      a.position.y - b.position.y,
    );
    if (separation <= a.radius + b.radius + 0.01 && i > 120 * 4)
      touchingSteps++;
  }
  expect(state.particles.every((p) => p.alive)).toBe(true);
  expect(touchingSteps).toBeGreaterThan(120);
});

it("keeps close attraction conservative and distant force unchanged", async () => {
  const { particlePairPotential, PARTICLE_GRAVITY_STRENGTH } =
    await import("../../src/gravity/physics");
  const state = createState({ ...level, bodies: [] });
  fireFrom(state, { x: 0, y: 0 }, { x: 0, y: 0 });
  fireFrom(state, { x: 40, y: 0 }, { x: 0, y: 0 });
  const [a, b] = state.particles;
  for (const r of [0.01, 12, 30, 59.99, 60, 60.01, 120]) {
    b.position.x = r;
    const acceleration = planetAccelerations(
      state.particles,
      [],
      state.physics,
    )[0].x;
    b.position.x = r + 1e-4;
    const above = particlePairPotential(a, b, PARTICLE_GRAVITY_STRENGTH);
    b.position.x = r - 1e-4;
    const below = particlePairPotential(a, b, PARTICLE_GRAVITY_STRENGTH);
    expect(acceleration).toBeCloseTo((above - below) / 2e-4 / a.mass, 5);
    if (r >= 60)
      expect(acceleration).toBe(
        (PARTICLE_GRAVITY_STRENGTH / (r * r + 60 * 60) ** 1.5) * r,
      );
  }
});
