import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import {
  physicsSettings,
  planetAccelerations,
} from "../../src/gravity/physics";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import type { GravityLevel, GravityState } from "../../src/gravity/types";

const empty: GravityLevel = {
  index: 0,
  seed: 1,
  family: "none",
  bounds: { x: 0, y: 0, width: 900, height: 900 },
  launch: { x: 420, y: 350 },
  bodies: [],
  objective: { kind: "none", count: 0, turns: 1, hold: 0 },
  witness: [],
};
function parallelPair(state: GravityState) {
  fireFrom(state, { x: 420, y: 350 }, { x: 0, y: 80 });
  fireFrom(state, { x: 480, y: 350 }, { x: 0, y: 80 });
}
function run(state: GravityState, seconds: number) {
  for (let n = 0; n < seconds * 120; n++) step(state, 1 / 120);
}

describe("visible mutual particle attraction", () => {
  it("bends nearby moving paths by more than ten world units in two seconds by default", () => {
    const interacting = createState(empty);
    const disabled = createState({
      ...empty,
      physics: { planetGravity: false },
    });
    parallelPair(interacting);
    parallelPair(disabled);
    run(interacting, 2);
    run(disabled, 2);
    expect(
      interacting.particles[0].position.x - disabled.particles[0].position.x,
    ).toBeGreaterThan(10);
    expect(
      disabled.particles[1].position.x - interacting.particles[1].position.x,
    ).toBeGreaterThan(10);
    expect(disabled.particles[0].position).toEqual({
      x: 420,
      y: expect.closeTo(510, 8),
    });
  });
  it("has no self force and attracts with equal opposite forces for unequal masses", () => {
    const state = createState(empty);
    parallelPair(state);
    state.particles[0].mass = 2;
    state.particles[1].mass = 5;
    const accelerations = planetAccelerations(
      state.particles,
      [],
      physicsSettings(),
    );
    expect(accelerations[0].x).toBeGreaterThan(0);
    expect(accelerations[1].x).toBeLessThan(0);
    expect(2 * accelerations[0].x + 5 * accelerations[1].x).toBeCloseTo(0, 12);
    expect(
      planetAccelerations([state.particles[0]], [], physicsSettings()),
    ).toEqual([{ x: 0, y: 0 }]);
    run(state, 2);
    expect(
      2 * state.particles[0].velocity.x + 5 * state.particles[1].velocity.x,
    ).toBeCloseTo(0, 9);
    expect(
      2 * state.particles[0].velocity.y + 5 * state.particles[1].velocity.y,
    ).toBeCloseTo(560, 9);
  });
  it("keeps a near-coincident close encounter finite without repulsion", () => {
    const state = createState(empty);
    fireFrom(state, { x: 450, y: 450 }, { x: 1, y: 0 });
    fireFrom(state, { x: 450.001, y: 450 }, { x: -1, y: 0 });
    expect(
      planetAccelerations(state.particles, [], state.physics)[0].x,
    ).toBeGreaterThan(0);
    run(state, 5);
    expect(
      state.particles.every(
        (p) =>
          p.alive &&
          [p.position.x, p.position.y, p.velocity.x, p.velocity.y].every(
            Number.isFinite,
          ),
      ),
    ).toBe(true);
    expect(
      state.particles[0].velocity.x + state.particles[1].velocity.x,
    ).toBeCloseTo(0, 10);
  });
});

describe("particle interaction engine override", () => {
  it("switches immediately without resetting flight, time, trails or progress", () => {
    const engine = new GravityEngine(1, empty);
    engine.setTimeScale(1);
    engine.launchFrom(empty.launch, { x: 0, y: 80 });
    engine.update(0.1);
    const before = engine.getSnapshot();
    engine.setParticleInteraction(false);
    expect(engine.getSnapshot()).toEqual({
      ...before,
      physics: { ...before.physics, planetGravity: false },
      groupSpin: { groups: {} },
    });
    engine.setParticleInteraction(true);
    expect(engine.getSnapshot()).toEqual({
      ...before,
      groupSpin: { groups: {} },
    });
  });
  it("persists only the explicit interaction override across retry and provider navigation", () => {
    const engine = new GravityEngine(1, undefined, (seed, index) => ({
      ...empty,
      seed,
      index,
      physics: { planetGravity: index % 2 === 0, planetRadius: 3 + index },
    }));
    expect(engine.getSnapshot().physics.planetGravity).toBe(true);
    engine.goTo(1);
    expect(engine.getSnapshot().physics.planetGravity).toBe(false);
    engine.setParticleInteraction(true);
    engine.retry();
    expect(engine.getSnapshot().physics.planetGravity).toBe(true);
    engine.goTo(3);
    expect(engine.getSnapshot().physics).toMatchObject({
      planetGravity: true,
      planetRadius: 6,
    });
    engine.setParticleInteraction(false);
    engine.skip();
    expect(engine.getSnapshot().physics).toMatchObject({
      planetGravity: false,
      planetRadius: 7,
    });
    engine.setPhysics({ planetRadius: 12 });
    engine.goTo(5);
    expect(engine.getSnapshot().physics).toMatchObject({
      planetGravity: false,
      planetRadius: 8,
    });
  });
  it("retains the explicit preference when a completed level advances", () => {
    const level: GravityLevel = {
      ...empty,
      family: "loop",
      launch: { x: 450, y: 650 },
      objective: { kind: "loop", count: 1, turns: 1, hold: 0 },
      bodies: [
        {
          id: "core",
          kind: "attractor",
          position: { x: 450, y: 450 },
          radius: 20,
          strength: 1440000,
        },
      ],
    };
    const engine = new GravityEngine(1, undefined, (seed, index) => ({
      ...level,
      seed,
      index,
    }));
    engine.setTimeScale(1);
    engine.setParticleInteraction(false);
    engine.launchFrom(level.launch, {
      x: Math.sqrt((1440000 * 200) / 41600),
      y: 0,
    });
    for (let n = 0; n < 2400; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().complete).toBe(true);
    engine.advance();
    expect(engine.getSnapshot()).toMatchObject({
      level: { index: 1 },
      physics: { planetGravity: false },
      particles: [],
      elapsed: 0,
    });
  });
  it("predicts with the active override and leaves live state untouched", () => {
    const engine = new GravityEngine(1, empty);
    engine.setTimeScale(1);
    engine.launchFrom({ x: 480, y: 350 }, { x: 0, y: 80 });
    engine.setParticleInteraction(false);
    const off = engine.predictFrom(empty.launch, { x: 0, y: 80 }, 2);
    engine.setParticleInteraction(true);
    const before = engine.getSnapshot();
    const on = engine.predictFrom(empty.launch, { x: 0, y: 80 }, 2);
    expect(engine.getSnapshot()).toEqual(before);
    expect(on.at(-1)!.x - off.at(-1)!.x).toBeGreaterThan(10);
    engine.launchFrom(empty.launch, { x: 0, y: 80 });
    for (let n = 0; n < 240; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().particles[1].position.x).toBeCloseTo(
      on.at(-1)!.x,
      9,
    );
  });
});

it("lets particles pass through with gravity off and grouping disabled, while grouping transfers momentum", () => {
  const make = (grouping: boolean) => {
    const engine = new GravityEngine(1, empty);
    engine.setTimeScale(1);
    engine.setParticleInteraction(false);
    engine.setParticleGrouping(grouping);
    engine.launchFrom({ x: 420, y: 350 }, { x: 40, y: 0 });
    engine.launchFrom({ x: 460, y: 350 }, { x: -40, y: 0 });
    for (let n = 0; n < 120; n++) engine.update(1 / 120);
    return engine.getSnapshot();
  };
  const free = make(false),
    grouped = make(true);
  expect(free.particles[0].position.x).toBeGreaterThan(
    free.particles[1].position.x,
  );
  expect(free.particles.map((p) => p.velocity.x)).toEqual([40, -40]);
  expect(grouped.particles.every((p) => p.alive)).toBe(true);
  expect(
    grouped.particles[0].position.x - grouped.particles[1].position.x,
  ).toBeGreaterThan(16);
  expect(grouped.particles[0].velocity.x).toBeGreaterThan(30);
  expect(grouped.particles[0].velocity.x).toBeLessThan(40);
  expect(
    grouped.particles[0].velocity.x + grouped.particles[1].velocity.x,
  ).toBeCloseTo(0, 10);
});

it("keeps mutual gravity and grouping independent through resets, navigation and predictions", () => {
  const engine = new GravityEngine(1, undefined, (seed, index) => ({
    ...empty,
    seed,
    index,
  }));
  engine.setParticleGrouping(false);
  engine.setParticleInteraction(true);
  engine.launchFrom({ x: 480, y: 350 }, { x: 0, y: 80 });
  const before = engine.getSnapshot();
  const path = engine.predictFrom(empty.launch, { x: 0, y: 80 }, 2);
  expect(path.at(-1)!.x).toBeGreaterThan(empty.launch.x + 10);
  expect(engine.getSnapshot()).toEqual(before);
  engine.setParticleGrouping(true);
  expect(engine.getSnapshot().particles).toEqual(before.particles);
  expect(engine.getSnapshot().physics.planetGravity).toBe(true);
  engine.retry();
  expect(engine.getSnapshot().physics.planetCollisions).toBe("soft");
  engine.skip();
  expect(engine.getSnapshot().physics.planetCollisions).toBe("soft");
  engine.setParticleGrouping(false);
  engine.goTo(3);
  expect(engine.getSnapshot().physics).toMatchObject({
    planetGravity: true,
    planetCollisions: "none",
  });
});
