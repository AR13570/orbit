import { describe, expect, it } from "vitest";
import {
  particlePairPotential,
  planetAccelerations,
} from "../../src/gravity/physics";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import { createGravityPrediction } from "../../src/gravity/prediction";
import { recoverSurfaceOverlaps } from "../../src/gravity/surface-support";
import type { GravityLevel, GravityState } from "../../src/gravity/types";

const level: GravityLevel = {
  index: 0,
  seed: 1,
  family: "none",
  bounds: { x: -2000, y: -2000, width: 4000, height: 4000 },
  launch: { x: 0, y: 0 },
  bodies: [],
  physics: { planetRadius: 8, planetCollisions: "soft" },
  objective: { kind: "none", count: 0, turns: 2, hold: 0 },
  witness: [],
};
function pair(distance: number, speed = 0, mass = 1, tangent = 0) {
  const state = createState(level);
  fireFrom(state, { x: 0, y: 0 }, { x: speed, y: tangent });
  fireFrom(state, { x: distance, y: 0 }, { x: 0, y: 0 });
  state.particles[1].mass = mass;
  return state;
}
function run(state: GravityState, seconds: number, dt = 1 / 120) {
  for (let n = 0; n < Math.round(seconds / dt); n++) step(state, dt);
}
function distance(state: GravityState) {
  const [a, b] = state.particles;
  return Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
}
function totals(state: GravityState) {
  return state.particles.reduce(
    (sum, p) => ({
      x: sum.x + p.mass * p.velocity.x,
      y: sum.y + p.mass * p.velocity.y,
      angular:
        sum.angular +
        p.mass * (p.position.x * p.velocity.y - p.position.y * p.velocity.x),
      kinetic:
        sum.kinetic + 0.5 * p.mass * (p.velocity.x ** 2 + p.velocity.y ** 2),
    }),
    { x: 0, y: 0, angular: 0, kinetic: 0 },
  );
}

describe("gentle particle encounters", () => {
  it("gradually restores a stopped deeply bound passage with a per-step correction budget", () => {
    const state = pair(4, 0, 4, 0.4);
    state.passingContacts = { "0:1": { slowSince: -1 } };
    const before = totals(state);
    const center =
      (state.particles[0].position.x + 4 * state.particles[1].position.x) / 5;
    recoverSurfaceOverlaps(state, state.particles, 1 / 120);
    expect(distance(state)).toBeGreaterThan(4);
    expect(distance(state)).toBeLessThanOrEqual(4 + 32 / 120 + 1e-10);
    expect(
      (state.particles[0].position.x + 4 * state.particles[1].position.x) / 5,
    ).toBeCloseTo(center, 12);
    expect(totals(state).x).toBeCloseTo(before.x, 12);
    expect(totals(state).y).toBeCloseTo(before.y, 12);
    expect(totals(state).angular).toBeCloseTo(before.angular, 12);
    run(state, 3);
    expect(distance(state)).toBeCloseTo(16, 6);
    expect(state.passingContacts).toBeUndefined();
  });

  it.each(["death", "policy"])(
    "clears transient passage state after %s",
    (change) => {
      const state = pair(16, 400);
      step(state, 1 / 120);
      expect(state.passingContacts).toBeDefined();
      if (change === "death") state.particles[1].alive = false;
      else state.physics.planetCollisions = "none";
      recoverSurfaceOverlaps(
        state,
        state.particles.filter((p) => p.alive),
      );
      expect(state.passingContacts).toBeUndefined();
    },
  );

  it("converges during gradual trapped-passage recovery at 120 and 240 Hz", () => {
    const coarse = pair(4, 0, 4, 0.4);
    coarse.passingContacts = { "0:1": { slowSince: -1 } };
    const fine = structuredClone(coarse);
    run(coarse, 2);
    run(fine, 2, 1 / 240);
    for (let i = 0; i < 2; i++)
      expect(
        Math.hypot(
          coarse.particles[i].position.x - fine.particles[i].position.x,
          coarse.particles[i].position.y - fine.particles[i].position.y,
        ),
      ).toBeLessThan(0.02);
    expect(coarse.passingContacts).toBeUndefined();
    expect(fine.passingContacts).toBeUndefined();
  });

  it("limits contact acceleration while retaining distant visible attraction and mass response", () => {
    const close = pair(16, 0, 5);
    const forces = planetAccelerations(close.particles, [], close.physics);
    // The previous near-field law gives 1341.64 here, overwhelming small aim changes.
    expect(forces[0].x).toBeGreaterThan(10);
    expect(forces[0].x).toBeLessThan(100);
    expect(forces[0].x + 5 * forces[1].x).toBeCloseTo(0, 11);
    const far = pair(120);
    expect(
      planetAccelerations(far.particles, [], far.physics)[0].x,
    ).toBeGreaterThan(4);
    const nearby = pair(60);
    nearby.physics.planetCollisions = "none";
    run(nearby, 2);
    expect(nearby.particles[0].position.x).toBeGreaterThan(10);
  });

  it.each([1, 4])(
    "lets a fast head-on incoming planet continue past mass %s while transferring momentum",
    (mass) => {
      const state = pair(16, 400, mass);
      const identities = state.particles.map(({ id, mass, radius }) => ({
        id,
        mass,
        radius,
      }));
      step(state, 1 / 120);
      expect(state.particles[0].velocity.x).toBeGreaterThan(250);
      expect(state.particles[1].velocity.x).toBeGreaterThan(3);
      expect(state.particles[0].velocity.x).toBeGreaterThan(
        state.particles[1].velocity.x,
      );
      expect(totals(state).x).toBeCloseTo(400, 9);
      run(state, 1);
      expect(state.particles[0].position.x).toBeGreaterThan(
        state.particles[1].position.x + 100,
      );
      expect(
        state.particles.map(({ id, mass, radius }) => ({ id, mass, radius })),
      ).toEqual(identities);
      expect(state.particles.every((p) => p.alive)).toBe(true);
      expect(totals(state).x).toBeCloseTo(400, 8);
      expect(state.passingContacts).toBeUndefined();
    },
  );

  it("does not convert a weakly unbound glancing pass into a bound surface group", () => {
    const state = pair(16, 110, 1, 50);
    const before = totals(state);
    const relativeEnergy = (world: GravityState) => {
      const [a, b] = world.particles;
      return (
        0.25 *
          ((b.velocity.x - a.velocity.x) ** 2 +
            (b.velocity.y - a.velocity.y) ** 2) +
        particlePairPotential(a, b, world.physics.planetGravityStrength)
      );
    };
    const energy = relativeEnergy(state);
    expect(energy).toBeGreaterThan(0);
    step(state, 1 / 120);
    expect(relativeEnergy(state)).toBeGreaterThan(0.83 * energy);
    expect(relativeEnergy(state)).toBeLessThan(energy);
    run(state, 3);
    expect(distance(state)).toBeGreaterThan(80);
    expect(totals(state).x).toBeCloseTo(before.x, 8);
    expect(totals(state).y).toBeCloseTo(before.y, 8);
    expect(totals(state).angular).toBeCloseTo(before.angular, 7);
  });

  it("settles slow bound surfaces without rebound or changing their shared drift", () => {
    const state = pair(16, 2, 4);
    run(state, 3);
    expect(distance(state)).toBeCloseTo(16, 7);
    expect(state.particles[0].velocity.x).toBeCloseTo(0.4, 7);
    expect(state.particles[1].velocity.x).toBeCloseTo(0.4, 7);
  });

  it("retains gentle gravitational settling from a short surface gap", () => {
    const state = pair(36);
    for (let n = 0; n < 360; n++) {
      step(state, 1 / 120);
      expect(
        state.particles[1].position.x - state.particles[0].position.x,
      ).toBeGreaterThanOrEqual(16 - 1e-7);
    }
    expect(distance(state)).toBeCloseTo(16, 6);
    expect(
      Math.abs(state.particles[1].velocity.x - state.particles[0].velocity.x),
    ).toBeLessThan(1e-6);
  });

  it("keeps fast contact dissipative with interaction off and never snaps an overlapping transit outward", () => {
    const state = pair(16, 400, 4);
    state.physics.planetGravity = false;
    const before = totals(state);
    step(state, 1 / 120);
    const expected = structuredClone(state);
    const positions = state.particles.map((p) => ({ ...p.position }));
    step(state, 1 / 120);
    state.particles.forEach((p, i) => {
      expect(p.position.x).toBeCloseTo(
        positions[i].x + expected.particles[i].velocity.x / 120,
        10,
      );
      expect(p.velocity).toEqual(expected.particles[i].velocity);
    });
    expect(totals(state).x).toBeCloseTo(before.x, 10);
    expect(totals(state).kinetic).toBeLessThan(before.kinetic);
    run(state, 1);
    expect(distance(state)).toBeGreaterThan(100);
  });

  it("clones active fast transits into prediction and converges across physical step sizes", () => {
    const state = pair(16, 400, 4, 20);
    step(state, 1 / 120);
    const coarse = structuredClone(state),
      fine = structuredClone(state);
    const position = { x: 800, y: 800 },
      velocity = { x: 0, y: 10 };
    const job = createGravityPrediction(state, position, velocity, 0.5);
    while (!job.done) job.advance(8);
    fireFrom(coarse, position, velocity);
    fireFrom(fine, position, velocity);
    run(coarse, 0.5);
    run(fine, 0.5, 1 / 240);
    expect(coarse.particles[2].position).toEqual(job.path.at(-1));
    for (let i = 0; i < 2; i++)
      expect(
        Math.hypot(
          coarse.particles[i].position.x - fine.particles[i].position.x,
          coarse.particles[i].position.y - fine.particles[i].position.y,
        ),
      ).toBeLessThan(0.1);
  });

  it("starts a fast overlapping encounter without a positional recovery snap", () => {
    const state = pair(12, 400, 4);
    state.physics.planetGravity = false;
    step(state, 1 / 120);
    expect(state.particles[0].position.x).toBeGreaterThan(2);
    expect(state.particles[1].position.x).toBeLessThan(13);
    expect(state.particles[0].velocity.x).toBeGreaterThan(250);
    expect(totals(state).x).toBeCloseTo(400, 10);
  });

  it("releases a high tangential energy contact even when its inward normal speed is tiny", () => {
    const state = pair(16, 0.2, 1, 200);
    const before = totals(state);
    run(state, 1);
    expect(distance(state)).toBeGreaterThan(100);
    expect(totals(state).x).toBeCloseTo(before.x, 8);
    expect(totals(state).y).toBeCloseTo(before.y, 8);
    expect(totals(state).angular).toBeCloseTo(before.angular, 7);
  });
});
