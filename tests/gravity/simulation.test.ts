import { describe, expect, it } from "vitest";
import {
  createState,
  fire,
  step,
  goalProgress,
  orbitFraction,
} from "../../src/gravity/simulation";
import type { GravityLevel } from "../../src/gravity/types";
const level: GravityLevel = {
  index: 0,
  seed: 1,
  family: "loop",
  bounds: { x: 0, y: 0, width: 900, height: 900 },
  launch: { x: 450, y: 650 },
  bodies: [
    {
      id: "a",
      kind: "attractor",
      position: { x: 450, y: 450 },
      radius: 40,
      strength: 1440000,
    },
  ],
  objective: { kind: "loop", count: 1, turns: 1, hold: 0 },
  witness: [],
};
// Circular speed for radius 200 with the existing softened inverse-square force.
const aim = {
  angle: 0,
  power: Math.sqrt((1440000 * 200) / (200 * 200 + 40 * 40)) / 420,
};
function advance(state: ReturnType<typeof createState>, seconds: number) {
  for (let n = 0; n < seconds * 120; n++) step(state, 1 / 120);
}
describe("Gravity simulation", () => {
  it("completes a sustained loop and preserves its living orbiter for many revolutions", () => {
    const state = createState(level);
    fire(state, aim);
    advance(state, 55);
    expect(goalProgress(state).complete).toBe(true);
    expect(state.particles[0].alive).toBe(true);
    expect(
      Math.hypot(
        state.particles[0].position.x - 450,
        state.particles[0].position.y - 450,
      ),
    ).toBeGreaterThan(180);
    expect(Math.abs(state.particles[0].orbits.a.winding)).toBeGreaterThan(
      4 * Math.PI,
    );
  });
  it("allows later shots while earlier ones keep flying, with distinct colors", () => {
    const state = createState({
      ...level,
      objective: { kind: "crowd", count: 3, turns: 1, hold: 1 },
    });
    fire(state, aim);
    advance(state, 2);
    fire(state, aim);
    advance(state, 2);
    fire(state, aim);
    advance(state, 22);
    expect(state.particles.filter((p) => p.alive)).toHaveLength(3);
    expect(new Set(state.particles.map((p) => p.color)).size).toBe(3);
    expect(goalProgress(state).complete).toBe(true);
  });
  it("recognizes opposite directions and does not count a partial flyby", () => {
    const state = createState({
      ...level,
      objective: { kind: "counter", count: 2, turns: 1, hold: 0 },
    });
    fire(state, aim);
    advance(state, 3);
    expect(goalProgress(state).current).toBe(0);
    fire(state, { ...aim, angle: Math.PI });
    advance(state, 24);
    expect(goalProgress(state).complete).toBe(true);
  });
  it("kills a swept collision and removes all objective credit", () => {
    const state = createState(level);
    fire(state, aim);
    advance(state, 20);
    expect(goalProgress(state).current).toBe(1);
    state.particles[0].position = { x: 350, y: 450 };
    state.particles[0].velocity = { x: 30000, y: 0 };
    step(state, 1 / 120);
    expect(state.particles[0].alive).toBe(false);
    expect(goalProgress(state).current).toBe(0);
  });
  it("keeps each projectile on its own path when another passes nearby", () => {
    const solo = createState(level),
      together = createState(level);
    for (const state of [solo, together]) {
      fire(state, aim);
      advance(state, 1);
    }
    fire(together, { ...aim, angle: Math.PI });
    for (let n = 0; n < 1200; n++) {
      step(solo, 1 / 120);
      step(together, 1 / 120);
    }
    expect(together.particles[0].position).toEqual(solo.particles[0].position);
    expect(together.particles[0].velocity).toEqual(solo.particles[0].velocity);
    expect(together.particles[1].alive).toBe(true);
  });
  it("bounds projectile memory and expires trails by time even after impact", () => {
    const state = createState(level);
    for (let n = 0; n < 50; n++) fire(state, aim);
    expect(state.particles.filter((p) => p.alive).length).toBeLessThanOrEqual(
      12,
    );
    advance(state, 15);
    expect(state.particles.every((p) => p.trail.length <= 100)).toBe(true);
    expect(
      state.particles.every((p) =>
        p.trail.every((t) => state.elapsed - t.time <= 3.01),
      ),
    ).toBe(true);
    for (const p of state.particles) p.alive = false;
    advance(state, 4);
    expect(state.particles).toHaveLength(0);
  });
  it("rejects non-finite shots and never treats back-and-forth motion as a full loop", () => {
    const state = createState(level);
    fire(state, { angle: NaN, power: 1 });
    expect(state.particles).toHaveLength(0);
    fire(state, aim);
    advance(state, 4);
    state.particles[0].velocity.x *= -1;
    state.particles[0].velocity.y *= -1;
    advance(state, 4);
    expect(goalProgress(state).current).toBe(0);
  });
});

describe("multi-body objective credit", () => {
  it("requires a different live projectile for each populated body", () => {
    const paired = {
      ...level,
      family: "paired" as const,
      bodies: [
        ...level.bodies,
        { ...level.bodies[0], id: "b", position: { x: 550, y: 450 } },
      ],
      objective: { kind: "paired" as const, count: 2, turns: 1, hold: 0 },
    };
    const state = createState(paired);
    fire(state, aim);
    for (const track of Object.values(state.particles[0].orbits))
      track.winding = track.localWinding = Math.PI * 2;
    expect(goalProgress(state).current).toBe(1);
    expect(goalProgress(state).complete).toBe(false);
    fire(state, aim);
    state.particles[1].orbits.b.winding =
      state.particles[1].orbits.b.localWinding = Math.PI * 2;
    expect(goalProgress(state).complete).toBe(true);
  });
});

it("does not confuse two shared orbits around a pair with separate local orbits", () => {
  const binary = {
    ...level,
    family: "paired" as const,
    launch: { x: 450, y: 630 },
    bodies: [
      { ...level.bodies[0], id: "a", position: { x: 410, y: 450 }, radius: 30 },
      { ...level.bodies[0], id: "b", position: { x: 490, y: 450 }, radius: 30 },
    ],
    objective: { kind: "paired" as const, count: 2, turns: 1, hold: 0 },
  };
  const state = createState(binary);
  fire(state, { angle: 0, power: 0.22 });
  fire(state, { angle: Math.PI, power: 0.22 });
  advance(state, 40);
  expect(state.particles.filter((p) => p.alive)).toHaveLength(2);
  expect(goalProgress(state).current).toBe(0);
  expect(orbitFraction(state, state.particles[0], "a")).toBeLessThan(1);
});

it("preserves an old live orbiter when repeated crashes fill the trail budget", () => {
  const state = createState(level);
  fire(state, aim);
  advance(state, 2);
  for (let n = 0; n < 40; n++) {
    fire(state, { angle: -Math.PI / 2, power: 1 });
    advance(state, 0.1);
  }
  expect(state.particles.some((p) => p.id === 0 && p.alive)).toBe(true);
  expect(state.particles.length).toBeLessThanOrEqual(24);
});

it("keeps living projectile colors distinct after failed shots cycle the palette", () => {
  const state = createState(level);
  fire(state, aim);
  for (let n = 0; n < 11; n++) {
    fire(state, { angle: -Math.PI / 2, power: 1 });
    advance(state, 0.6);
  }
  fire(state, aim);
  const living = state.particles.filter((p) => p.alive);
  expect(living).toHaveLength(2);
  expect(new Set(living.map((p) => p.color)).size).toBe(2);
});

it("counts a full wide orbit without an invisible distance cutoff", () => {
  const wide = { ...level, launch: { x: 450, y: 810 } };
  const state = createState(wide);
  fire(state, {
    angle: 0,
    power: Math.sqrt((1440000 * 360) / (360 * 360 + 40 * 40)) / 420,
  });
  advance(state, 40);
  expect(state.particles[0].alive).toBe(true);
  expect(goalProgress(state).complete).toBe(true);
});

it("retains revolution progress through the far side of an elliptical orbit", () => {
  const state = createState(level);
  fire(state, { ...aim, power: aim.power * 1.15 });
  advance(state, 55);
  expect(state.particles[0].alive).toBe(true);
  expect(goalProgress(state).complete).toBe(true);
});

it("completes a familiar orbit in ten seconds with faster launches and stronger pull", () => {
  const state = createState(level);
  fire(state, aim);
  expect(
    Math.hypot(state.particles[0].velocity.x, state.particles[0].velocity.y),
  ).toBeGreaterThan(125);
  advance(state, 10);
  expect(goalProgress(state).complete).toBe(true);
  advance(state, 20);
  const particle = state.particles[0];
  expect(particle.alive).toBe(true);
  expect(
    Math.hypot(particle.position.x - 450, particle.position.y - 450),
  ).toBeGreaterThan(180);
  expect(
    Math.hypot(particle.position.x - 450, particle.position.y - 450),
  ).toBeLessThan(220);
});

it("counts a wide local orbit in a paired puzzle without awarding its neighboring body", () => {
  const wide = {
    ...level,
    family: "paired" as const,
    launch: { x: 450, y: 810 },
    bodies: [
      ...level.bodies,
      {
        ...level.bodies[0],
        id: "b",
        radius: 1,
        strength: 900,
        position: { x: 1050, y: 450 },
      },
    ],
    objective: { kind: "paired" as const, count: 2, turns: 1, hold: 0 },
  };
  const state = createState(wide);
  fire(state, {
    angle: 0,
    power: Math.sqrt((1440000 * 360) / (360 * 360 + 40 * 40)) / 420,
  });
  advance(state, 25);
  expect(state.particles[0].alive).toBe(true);
  expect(goalProgress(state).current).toBe(1);
  expect(orbitFraction(state, state.particles[0], "a")).toBe(1);
});

it("does not fill separate-body goals with identical routes that visit both wells", () => {
  const state = createState({
    index: 4,
    seed: 3839010268,
    family: "paired",
    bounds: { x: 0, y: 0, width: 900, height: 900 },
    launch: { x: 468.1821043784517, y: 434.6922771227768 },
    bodies: [
      {
        id: "a",
        position: { x: 477.0245657899742, y: 569.9646718556916 },
        radius: 28.348140221089125,
        kind: "attractor",
        strength: 723255.3485950779,
      },
      {
        id: "b",
        position: { x: 371.05041418770804, y: 340.12883460252385 },
        radius: 28.348140221089125,
        kind: "attractor",
        strength: 723255.3485950779,
      },
    ],
    objective: { kind: "paired", count: 2, turns: 1, hold: 1 },
    witness: [
      { angle: 2.3763177011523293, power: 0.18348209236146834, time: 0 },
      {
        angle: 9.325983035605288,
        power: 0.18348209236146834,
        time: 1.4999999999999998,
      },
    ],
  });
  for (let n = 0; n < 2; n++)
    fire(state, { angle: 0.17453292519943295, power: 0.275 });
  for (let n = 0; n < 75 * 120; n++) {
    step(state, 1 / 120);
    expect(goalProgress(state).current).toBeLessThan(2);
  }
});
