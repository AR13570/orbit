import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import type { GravityLevel, GravityState } from "../../src/gravity/types";

const empty: GravityLevel = {
  index: 0,
  seed: 1,
  family: "none",
  bounds: { x: 0, y: 0, width: 900, height: 900 },
  launch: { x: 400, y: 450 },
  bodies: [],
  physics: { planetRadius: 4 },
  objective: { kind: "none", count: 0, turns: 1, hold: 0 },
  witness: [],
};
function run(state: GravityState, seconds: number) {
  for (let n = 0; n < Math.round(seconds * 120); n++) step(state, 1 / 120);
}
function separation(state: GravityState, a: number, b: number) {
  return Math.hypot(
    state.particles[a].position.x - state.particles[b].position.x,
    state.particles[a].position.y - state.particles[b].position.y,
  );
}

describe("natural gravitational gathering", () => {
  it("dissipates only approaching normal velocity while preserving tangential motion and both planets", () => {
    const state = createState({
      ...empty,
      physics: { ...empty.physics, planetGravity: false },
    });
    fireFrom(state, { x: 400, y: 450 }, { x: 10, y: 7 });
    fireFrom(state, { x: 408, y: 450 }, { x: -10, y: -3 });
    step(state, 1 / 120);
    expect(state.particles).toHaveLength(2);
    expect(state.particles.map((p) => p.alive)).toEqual([true, true]);
    expect(state.particles[0].velocity.y).toBe(7);
    expect(state.particles[1].velocity.y).toBe(-3);
    expect(state.particles[0].velocity.x).toBe(0);
    expect(state.particles[1].velocity.x).toBe(0);
    expect(
      state.particles[0].velocity.x + state.particles[1].velocity.x,
    ).toBeCloseTo(0, 10);
    expect(separation(state, 0, 1)).toBeGreaterThan(8);
  });

  it("attracts and captures unequal sizes without changing identity, mass, radius or color", () => {
    const state = createState(empty);
    fireFrom(state, { x: 400, y: 450 }, { x: 0, y: 12 });
    fireFrom(state, { x: 460, y: 450 }, { x: 0, y: 12 });
    state.particles[0].mass = 8;
    state.particles[0].radius = 6;
    state.particles[1].radius = 3;
    const identities = state.particles.map(({ id, mass, radius, color }) => ({
      id,
      mass,
      radius,
      color,
    }));
    run(state, 0.5);
    expect(state.particles[0].position.x).toBeGreaterThan(400);
    expect(state.particles[1].position.x).toBeLessThan(460);
    run(state, 9.5);
    expect(
      state.particles.map(({ id, mass, radius, color }) => ({
        id,
        mass,
        radius,
        color,
      })),
    ).toEqual(identities);
    expect(state.particles.every((p) => p.alive)).toBe(true);
    expect(separation(state, 0, 1)).toBeGreaterThanOrEqual(9 - 1e-7);
    expect(separation(state, 0, 1)).toBeLessThan(10);
    expect(
      8 * state.particles[0].velocity.x + state.particles[1].velocity.x,
    ).toBeCloseTo(0, 8);
    expect(
      8 * state.particles[0].velocity.y + state.particles[1].velocity.y,
    ).toBeCloseTo(108, 8);
  });

  it("comes to surface contact under gravity without rebounding", () => {
    const state = createState(empty);
    fireFrom(state, { x: 420, y: 450 }, { x: 0, y: 0 });
    fireFrom(state, { x: 480, y: 450 }, { x: 0, y: 0 });
    for (let n = 0; n < 600; n++) {
      step(state, 1 / 120);
      expect(
        state.particles[1].velocity.x - state.particles[0].velocity.x,
      ).toBeLessThanOrEqual(1e-7);
    }
    expect(separation(state, 0, 1)).toBeCloseTo(8, 6);
  });

  it("allows a three planet gravitational encounter without forcing every member into a compact group", () => {
    const state = createState(empty);
    fireFrom(state, { x: 420, y: 430 }, { x: 5, y: 9 });
    fireFrom(state, { x: 480, y: 430 }, { x: 5, y: 9 });
    fireFrom(state, { x: 450, y: 481.9615242270663 }, { x: 5, y: 9 });
    run(state, 0.25);
    expect(separation(state, 0, 1)).toBeGreaterThan(50);
    let closest = Infinity;
    for (let n = 0; n < 1170; n++) {
      step(state, 1 / 120);
      for (const [a, b] of [
        [0, 1],
        [1, 2],
        [0, 2],
      ]) {
        const distance = separation(state, a, b);
        expect(distance).toBeGreaterThanOrEqual(8 - 1e-6);
        closest = Math.min(closest, distance);
      }
    }
    expect(closest).toBeLessThan(8.1);
    expect(state.particles).toHaveLength(3);
    expect(state.particles.every((p) => p.alive)).toBe(true);
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [0, 2],
    ]) {
      expect(separation(state, a, b)).toBeGreaterThanOrEqual(8 - 1e-6);
    }
    expect(
      state.particles.reduce((sum, p) => sum + p.velocity.x, 0),
    ).toBeCloseTo(15, 8);
    expect(
      state.particles.reduce((sum, p) => sum + p.velocity.y, 0),
    ).toBeCloseTo(27, 8);
    expect(
      state.particles.reduce((sum, p) => sum + p.position.x, 0) / 3,
    ).toBeCloseTo(500, 5);
  });

  it("allows already separating contacts to escape without any attachment", () => {
    const state = createState(empty);
    fireFrom(state, { x: 400, y: 450 }, { x: -1000, y: 0 });
    fireFrom(state, { x: 408, y: 450 }, { x: 1000, y: 0 });
    run(state, 1);
    expect(state.particles.every((p) => p.alive)).toBe(true);
    expect(separation(state, 0, 1)).toBeGreaterThan(300);
    expect(state.particles[0].velocity.x).toBeLessThan(-100);
    expect(state.particles[1].velocity.x).toBeGreaterThan(100);
  });

  it("sweeps fast unequal-mass contacts without tunneling or losing momentum", () => {
    const state = createState({
      ...empty,
      physics: { ...empty.physics, planetGravity: false },
    });
    fireFrom(state, { x: 400, y: 450 }, { x: 30000, y: 0 });
    fireFrom(state, { x: 500, y: 450 }, { x: -10000, y: 0 });
    state.particles[0].mass = 2;
    state.particles[1].mass = 5;
    step(state, 1 / 120);
    expect(state.particles[0].position.x).toBeLessThan(
      state.particles[1].position.x,
    );
    expect(separation(state, 0, 1)).toBeGreaterThanOrEqual(8);
    expect(
      2 * state.particles[0].velocity.x + 5 * state.particles[1].velocity.x,
    ).toBeCloseTo(10000, 8);
    expect(
      state.particles[1].velocity.x - state.particles[0].velocity.x,
    ).toBeCloseTo(0, 8);
    expect(state.particles[0].velocity.x).toBeCloseTo(10000 / 7, 8);
  });

  it("resolves coincident planets into finite distinct surfaces", () => {
    const state = createState(empty);
    for (let n = 0; n < 3; n++)
      fireFrom(state, { x: 450, y: 450 }, { x: 0, y: 0 });
    run(state, 1);
    expect(
      state.particles.every(
        (p) =>
          p.alive &&
          [p.position.x, p.position.y, p.velocity.x, p.velocity.y].every(
            Number.isFinite,
          ),
      ),
    ).toBe(true);
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [0, 2],
    ])
      expect(separation(state, a, b)).toBeGreaterThanOrEqual(8 - 1e-6);
  });

  it("disables mutual attraction through the engine without adding contact attachment", () => {
    const engine = new GravityEngine(1, empty);
    engine.setTimeScale(1);
    engine.setParticleInteraction(false);
    engine.launchFrom({ x: 420, y: 450 }, { x: 0, y: 10 });
    engine.launchFrom({ x: 480, y: 450 }, { x: 0, y: 10 });
    for (let n = 0; n < 1200; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().particles.map((p) => p.position)).toEqual([
      { x: 420, y: expect.closeTo(550, 8) },
      { x: 480, y: expect.closeTo(550, 8) },
    ]);
  });

  it("predicts soft contact and subsequent gravity using an isolated copy of the live world", () => {
    const engine = new GravityEngine(1, empty);
    engine.setTimeScale(1);
    engine.launchFrom({ x: 480, y: 450 }, { x: -20, y: 0 });
    const before = engine.getSnapshot();
    const prediction = engine.predictFrom(
      { x: 420, y: 450 },
      { x: 20, y: 0 },
      2,
    );
    expect(engine.getSnapshot()).toEqual(before);
    engine.launchFrom({ x: 420, y: 450 }, { x: 20, y: 0 });
    for (let n = 0; n < 240; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().particles[1].position.x).toBeCloseTo(
      prediction.at(-1)!.x,
      9,
    );
    expect(engine.getSnapshot().particles[1].position.y).toBeCloseTo(
      prediction.at(-1)!.y,
      9,
    );
    expect(engine.getSnapshot().particles.every((p) => p.alive)).toBe(true);
  });
});
