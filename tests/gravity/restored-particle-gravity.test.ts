import { expect, it } from "vitest";
import {
  planetAccelerations,
  particlePairPotential,
} from "../../src/gravity/physics";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import type { GravityLevel } from "../../src/gravity/types";

const level: GravityLevel = {
  seed: 42,
  index: 0,
  family: "none",
  bounds: { x: -2000, y: -2000, width: 4000, height: 4000 },
  launch: { x: 0, y: 0 },
  bodies: [],
  witness: [],
  physics: {
    planetGravity: true,
    planetCollisions: "soft",
    planetRadius: 8,
    planetGravityStrength: 96000,
  },
  objective: { kind: "none", count: 0, turns: 2, hold: 0 },
};

it("restores the earlier surface attraction instead of damping normal-size planets across sixty world units", () => {
  const s = createState(level);
  fireFrom(s, { x: 0, y: 0 }, { x: 0, y: 0 });
  fireFrom(s, { x: 16, y: 0 }, { x: 0, y: 0 });
  s.particles[1].mass = 4;
  const [a, b] = planetAccelerations(s.particles, [], s.physics);
  // G=96000, distance=16, softening=8, plus the smooth nearby enhancement.
  // No arbitrary sixty-unit floor suppresses the radius-scaled base force.
  expect(a.x).toBeCloseTo(1230.8486374303516, 7);
  expect(b.x).toBeCloseTo(-307.7121593575879, 7);
  expect(a.x + 4 * b.x).toBeCloseTo(0, 9);
});

it.each(["none", "soft"] as const)(
  "adds every member's mass to a group's pull with %s contact",
  (policy) => {
    const s = createState({
      ...level,
      physics: { ...level.physics, planetCollisions: policy },
    });
    fireFrom(s, { x: 0, y: -8 }, { x: 0, y: 0 });
    fireFrom(s, { x: 0, y: 8 }, { x: 0, y: 0 });
    fireFrom(s, { x: 80, y: 0 }, { x: 0, y: 0 });
    const both = planetAccelerations(s.particles, [], s.physics)[2];
    const first = planetAccelerations(
      [s.particles[0], s.particles[2]],
      [],
      s.physics,
    )[1];
    const second = planetAccelerations(
      [s.particles[1], s.particles[2]],
      [],
      s.physics,
    )[1];
    expect(both.x).toBeCloseTo(first.x + second.x, 12);
    expect(both.y).toBeCloseTo(0, 12);
    expect(both.x).toBeCloseTo(2 * first.x, 12);
    s.particles[1].mass = 4;
    const heavier = planetAccelerations(s.particles, [], s.physics)[2];
    expect(heavier.x).toBeCloseTo(5 * first.x, 12);
  },
);

it("keeps capture energy consistent with the restored force at different separations", () => {
  const s = createState(level);
  fireFrom(s, { x: 0, y: 0 }, { x: 0, y: 0 });
  fireFrom(s, { x: 16, y: 0 }, { x: 0, y: 0 });
  const [a, b] = s.particles;
  a.mass = 2;
  b.mass = 4;
  for (const radius of [0.1, 8, 16, 40, 60, 95.99, 96, 96.01, 120]) {
    b.position.x = radius;
    const acceleration = planetAccelerations(s.particles, [], s.physics)[0].x;
    b.position.x = radius + 1e-4;
    const above = particlePairPotential(a, b, s.physics.planetGravityStrength);
    b.position.x = radius - 1e-4;
    const below = particlePairPotential(a, b, s.physics.planetGravityStrength);
    expect(acceleration).toBeCloseTo((above - below) / 2e-4 / a.mass, 4);
  }
});

it("accelerates a supported unequal-mass group toward a third planet without losing total momentum", () => {
  const s = createState(level);
  s.groupSpin = { groups: {} };
  fireFrom(s, { x: -8, y: 0 }, { x: 0, y: 0 });
  fireFrom(s, { x: 8, y: 0 }, { x: 0, y: 0 });
  fireFrom(s, { x: 200, y: 80 }, { x: 0, y: 0 });
  s.particles[1].mass = 4;
  s.particles[2].mass = 4;
  for (let n = 0; n < 60; n++) step(s, 1 / 120);
  const [a, b, third] = s.particles;
  expect((a.mass * a.position.x + b.mass * b.position.x) / 5).toBeGreaterThan(
    5.5,
  );
  expect((a.mass * a.position.y + b.mass * b.position.y) / 5).toBeGreaterThan(
    0.2,
  );
  expect(third.position.x).toBeLessThan(199);
  expect(
    Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y),
  ).toBeCloseTo(16, 5);
  expect(
    s.particles.reduce((p, body) => p + body.mass * body.velocity.x, 0),
  ).toBeCloseTo(0, 8);
  expect(
    s.particles.reduce((p, body) => p + body.mass * body.velocity.y, 0),
  ).toBeCloseTo(0, 8);
});
