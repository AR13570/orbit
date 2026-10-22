import { expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import type { GravityLevel } from "../../src/gravity/types";
const empty: GravityLevel = {
  index: 0,
  seed: 42,
  family: "none",
  bounds: { x: 0, y: 0, width: 2000, height: 2000 },
  launch: { x: 400, y: 450 },
  bodies: [],
  objective: { kind: "none", count: 0, turns: 2, hold: 0 },
  witness: [],
  physics: {
    planetGravity: true,
    planetCollisions: "soft",
    bodyCollisions: false,
  },
};
it("keeps fast grazing bodies on their surfaces while allowing them to separate", () => {
  const s = createState(empty);
  // Retain enough tangential speed to escape after normal momentum transfer
  // under the stronger default attraction.
  fireFrom(s, { x: 400, y: 450 }, { x: 430, y: 0 });
  fireFrom(s, { x: 440, y: 466 }, { x: 0, y: 0 });
  s.particles[0].radius = 12;
  s.particles[0].mass = 4;
  s.particles[1].radius = 6;
  s.particles[1].mass = 1;
  let touched = false;
  for (let n = 0; n < 240; n++) {
    step(s, 1 / 120);
    const [a, b] = s.particles;
    const distance = Math.hypot(
      b.position.x - a.position.x,
      b.position.y - a.position.y,
    );
    expect(distance, `surface penetration at step ${n}`).toBeGreaterThanOrEqual(
      18 - 1e-6,
    );
    // A fast glance may collide and separate within one fixed step. Its
    // non-settled contact record also confirms that the swept impact occurred.
    touched ||=
      distance < 18.01 || Object.keys(s.passingContacts ?? {}).length > 0;
    expect(a.mass * a.velocity.x + b.mass * b.velocity.x).toBeCloseTo(1720, 7);
    expect(a.mass * a.velocity.y + b.mass * b.velocity.y).toBeCloseTo(0, 7);
  }
  const [a, b] = s.particles;
  expect(touched).toBe(true);
  expect(a.alive && b.alive).toBe(true);
  expect(
    Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y),
  ).toBeGreaterThan(36);
  expect(a.velocity.x).toBeGreaterThan(100);
  expect(Math.hypot(b.velocity.x, b.velocity.y)).toBeGreaterThan(10);
});
it("uses grouping for momentum transfer independently of the attraction toggle", () => {
  const result = (grouping: boolean) => {
    const e = new GravityEngine(42, empty);
    e.setTimeScale(1);
    e.setParticleInteraction(false);
    e.setParticleGrouping(grouping);
    e.launchFrom({ x: 400, y: 450 }, { x: 120, y: 0 });
    e.launchFrom({ x: 440, y: 450 }, { x: 0, y: 0 });
    for (let n = 0; n < 120; n++) e.update(1 / 120);
    return e.getSnapshot().particles;
  };
  const off = result(false),
    on = result(true);
  expect(off.map((p) => p.velocity.x)).toEqual([120, 0]);
  expect(off[0].position.x).toBeGreaterThan(off[1].position.x);
  expect(on[0].position.x).toBeLessThan(on[1].position.x);
  expect(on[0].velocity.x).toBeCloseTo(60, 8);
  expect(on[1].velocity.x).toBeCloseTo(60, 8);
});
it("recognises a bound group after a fast head-on impact dissipates relative motion", () => {
  const e = new GravityEngine(42, empty);
  e.setTimeScale(1);
  e.setParticleInteraction(true);
  e.setParticleGrouping(true);
  e.launchFrom({ x: 400, y: 450 }, { x: 200, y: 0 });
  e.launchFrom({ x: 440, y: 450 }, { x: 0, y: 0 });
  for (let n = 0; n < 84; n++) e.update(1 / 120);
  const state = e.getSnapshot(),
    [a, b] = state.particles;
  const dx = b.position.x - a.position.x,
    dy = b.position.y - a.position.y;
  const distance = Math.hypot(dx, dy);
  const omega =
    (dx * (b.velocity.y - a.velocity.y) - dy * (b.velocity.x - a.velocity.x)) /
    (distance * distance);
  expect(distance).toBeCloseTo(a.radius + b.radius, 6);
  expect(state.passingContacts).toBeUndefined();
  expect(Math.abs(omega)).toBeGreaterThan(0.002);
  expect(a.velocity.x * a.mass + b.velocity.x * b.mass).toBeCloseTo(200, 7);
});
it("absorbs a core-contained planet before an equal-time surface correction can rescue it", () => {
  const s = createState({
    ...empty,
    bodies: [
      {
        id: "core",
        kind: "attractor",
        position: { x: 0, y: 0 },
        radius: 1,
        strength: 0,
      },
    ],
    physics: {
      planetGravity: false,
      planetCollisions: "soft",
      planetRadius: 1,
      bodyCollisions: true,
    },
  });
  fireFrom(s, { x: 2.2, y: 0 }, { x: 0, y: 0 });
  fireFrom(s, { x: 1.19, y: 1.59 }, { x: 0, y: 0 });
  step(s, 1 / 120);
  expect(s.particles.find((p) => p.id === 1)?.alive).toBe(false);
  expect(s.particles.find((p) => p.id === 0)?.alive).toBe(true);
});
