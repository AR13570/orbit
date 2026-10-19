import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import {
  createState,
  fireFrom,
  goalProgress,
  objectiveText,
  step,
} from "../../src/gravity/simulation";
import { gravityForceAt, gravityLaunchSpeed } from "../../src/gravity/physics";
import type { GravityLevel, GravityState } from "../../src/gravity/types";
const base: GravityLevel = {
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
      radius: 20,
      strength: 1440000,
    },
  ],
  objective: { kind: "loop", count: 1, turns: 1, hold: 1 },
  witness: [],
};
const speed = Math.sqrt((1440000 * 200) / 41600);
function run(state: GravityState, seconds: number) {
  for (let n = 0; n < Math.round(seconds * 120); n++) step(state, 1 / 120);
}
describe("rebuilt Gravity physical core", () => {
  it("uses physical velocity and force, leaving acceleration of playback to the engine", () => {
    expect(gravityLaunchSpeed(0.5)).toBe(210);
    expect(gravityForceAt({ x: 350, y: 450 }, base.bodies).x).toBeCloseTo(
      124.13793103448276,
    );
  });
  it("launches 128 planets anywhere without evicting earlier ones", () => {
    const state = createState({
      ...base,
      bodies: [],
      physics: { planetGravity: false, planetCollisions: "none" },
      objective: { kind: "none", count: 0, turns: 1, hold: 0 },
    });
    for (let n = 0; n < 128; n++)
      expect(fireFrom(state, { x: n, y: 100 }, { x: 1, y: 0 })).toBe(true);
    step(state, 1 / 120);
    expect(state.particles.filter((p) => p.alive)).toHaveLength(128);
    expect(state.particles[0].position.x).toBeCloseTo(1 / 120);
    expect(fireFrom(state, { x: NaN, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });
  it("conserves momentum when moving planets mutually attract", () => {
    const state = createState({
      ...base,
      bodies: [],
      physics: { planetGravity: true, planetGravityStrength: 1200 },
    });
    fireFrom(state, { x: 300, y: 450 }, { x: 0, y: 0 });
    fireFrom(state, { x: 600, y: 450 }, { x: 0, y: 0 });
    state.particles[0].mass = 2;
    state.particles[1].mass = 5;
    run(state, 2);
    const [a, b] = state.particles;
    expect(a.position.x).toBeGreaterThan(300);
    expect(b.position.x).toBeLessThan(600);
    expect(2 * a.velocity.x + 5 * b.velocity.x).toBeCloseTo(0, 10);
  });
  it("preserves a bound orbit for 200 physical seconds even outside the viewport", () => {
    const state = createState({
      ...base,
      bounds: { x: 0, y: 0, width: 50, height: 50 },
    });
    fireFrom(state, base.launch, { x: speed, y: 0 });
    run(state, 200);
    expect(state.particles[0].alive).toBe(true);
    expect(
      Math.hypot(
        state.particles[0].position.x - 450,
        state.particles[0].position.y - 450,
      ),
    ).toBeCloseTo(200, 1);
    expect(state.particles[0].trail.length).toBeLessThanOrEqual(721);
    expect(goalProgress(state).complete).toBe(true);
  });
  it.each(["none", "elastic", "merge"] as const)(
    "honors %s planet contacts",
    (policy) => {
      const state = createState({
        ...base,
        bodies: [],
        physics: {
          planetGravity: false,
          planetCollisions: policy,
          planetRadius: 5,
        },
      });
      fireFrom(state, { x: 400, y: 450 }, { x: 10, y: 0 });
      fireFrom(state, { x: 420, y: 450 }, { x: -10, y: 0 });
      run(state, 1);
      const live = state.particles.filter((p) => p.alive);
      expect(live).toHaveLength(policy === "merge" ? 1 : 2);
      if (policy === "elastic") expect(live[0].velocity.x).toBeLessThan(0);
      if (policy === "merge") {
        expect(live[0].mass).toBe(2);
        expect(live[0].velocity.x).toBeCloseTo(0);
      }
      if (policy === "none") expect(live[0].velocity.x).toBe(10);
    },
  );
  it("absorbs swept well contacts unless body collisions are disabled", () => {
    for (const enabled of [true, false]) {
      const state = createState({
        ...base,
        physics: { bodyCollisions: enabled },
      });
      fireFrom(state, { x: 350, y: 450 }, { x: 30000, y: 0 });
      step(state, 1 / 120);
      expect(state.particles[0].alive).toBe(!enabled);
    }
  });
  it("rejects unbound flyby credit even after a recorded revolution", () => {
    const state = createState(base);
    fireFrom(state, base.launch, { x: 1000, y: 0 });
    state.particles[0].orbits.a.winding =
      state.particles[0].orbits.a.localWinding = Math.PI * 2;
    expect(goalProgress(state).current).toBe(0);
  });
  it("assigns each planet to at most one explicit body requirement", () => {
    const state = createState({
      ...base,
      bodies: [
        ...base.bodies,
        { ...base.bodies[0], id: "b", position: { x: 500, y: 450 } },
      ],
      requirements: [
        { bodyId: "a", count: 1 },
        { bodyId: "b", count: 1 },
      ],
    });
    fireFrom(state, base.launch, { x: speed, y: 0 });
    for (const track of Object.values(state.particles[0].orbits))
      track.winding = track.localWinding = Math.PI * 2;
    expect(goalProgress(state).current).toBe(1);
  });
});
describe("rebuilt Gravity engine", () => {
  it("predicts the same N body path as a live launch without altering the original state", () => {
    const level = {
      ...base,
      physics: { planetGravity: true, planetGravityStrength: 10000 },
    };
    const engine = new GravityEngine(1, level);
    engine.setTimeScale(1);
    engine.launchFrom({ x: 500, y: 650 }, { x: 0, y: 0 });
    const before = engine.getSnapshot(),
      path = engine.predictFrom(base.launch, { x: speed, y: 0 }, 1);
    expect(engine.getSnapshot()).toEqual(before);
    engine.launchFrom(base.launch, { x: speed, y: 0 });
    for (let n = 0; n < 120; n++) engine.update(1 / 120);
    const actual = engine.getSnapshot().particles[1].position;
    expect(path.at(-1)!.x).toBeCloseTo(actual.x, 9);
    expect(path.at(-1)!.y).toBeCloseTo(actual.y, 9);
  });
  it("changes playback duration, not spatial orbit geometry, and freezes while paused", () => {
    const slow = new GravityEngine(1, base),
      fast = new GravityEngine(1, base);
    slow.setTimeScale(0.5);
    fast.setTimeScale(2);
    for (const e of [slow, fast]) e.launchFrom(base.launch, { x: speed, y: 0 });
    for (let n = 0; n < 480; n++) slow.update(1 / 120);
    for (let n = 0; n < 120; n++) fast.update(1 / 120);
    expect(fast.getSnapshot().particles[0].position).toEqual(
      slow.getSnapshot().particles[0].position,
    );
    fast.setPaused(true);
    const before = fast.getSnapshot();
    fast.update(1);
    expect(fast.getSnapshot()).toEqual(before);
  });
  it("latches completion while motion and launches continue and retry resets it", () => {
    const engine = new GravityEngine(1, base);
    engine.setTimeScale(1);
    engine.launchFrom(base.launch, { x: speed, y: 0 });
    for (let n = 0; n < 2400; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().complete).toBe(true);
    const before = engine.getSnapshot();
    engine.update(0.1);
    expect(engine.getSnapshot().elapsed).toBeGreaterThan(before.elapsed);
    expect(engine.launchFrom({ x: 700, y: 450 }, { x: 0, y: 10 })).toBe(true);
    engine.retry();
    expect(engine.getSnapshot().complete).toBe(false);
    expect(engine.getSnapshot().particles).toHaveLength(0);
  });
  it("uses the injected level provider for initial load and explicit navigation", () => {
    const engine = new GravityEngine(7, undefined, (seed, index) => ({
      ...base,
      seed,
      index,
    }));
    engine.skip();
    expect(engine.getSnapshot().level.index).toBe(1);
    expect(engine.getSnapshot().level.seed).toBe(7);
  });
});

describe("kinematic wells and navigation", () => {
  it("positions moving wells deterministically and resets to their time zero pose", () => {
    const level = {
      ...base,
      motions: [
        {
          bodyId: "a",
          kind: "circle" as const,
          center: { x: 450, y: 450 },
          radius: 50,
          period: 4,
        },
      ],
    };
    const engine = new GravityEngine(1, level);
    engine.setTimeScale(1);
    expect(engine.getSnapshot().level.bodies[0].position).toEqual({
      x: 500,
      y: 450,
    });
    for (let n = 0; n < 120; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().level.bodies[0].position.x).toBeCloseTo(450, 8);
    expect(engine.getSnapshot().level.bodies[0].position.y).toBeCloseTo(500, 8);
    engine.retry();
    expect(engine.getSnapshot().level.bodies[0].position).toEqual({
      x: 500,
      y: 450,
    });
    expect(level.bodies[0].position).toEqual({ x: 450, y: 450 });
  });
  it("predicts moving well forces from the current phase", () => {
    const level = {
      ...base,
      motions: [
        {
          bodyId: "a",
          kind: "oscillate" as const,
          center: { x: 450, y: 450 },
          amplitude: { x: 40, y: 0 },
          period: 6,
        },
      ],
    };
    const engine = new GravityEngine(1, level);
    engine.setTimeScale(1);
    engine.update(0.25);
    const path = engine.predictFrom(base.launch, { x: speed, y: 0 }, 1),
      before = engine.getSnapshot();
    engine.launchFrom(base.launch, { x: speed, y: 0 });
    for (let n = 0; n < 120; n++) engine.update(1 / 120);
    expect(path.at(-1)!.x).toBeCloseTo(
      engine.getSnapshot().particles[0].position.x,
      9,
    );
    expect(before.level.bodies[0].position.x).not.toBe(
      engine.getSnapshot().level.bodies[0].position.x,
    );
  });
  it("evaluates boundness relative to moving well velocity", () => {
    const state = createState({
      ...base,
      motions: [
        {
          bodyId: "a",
          kind: "oscillate",
          center: { x: 450, y: 450 },
          amplitude: { x: 1000, y: 0 },
          period: 1,
        },
      ],
    });
    fireFrom(state, base.launch, { x: 0, y: 0 });
    state.particles[0].orbits.a.winding =
      state.particles[0].orbits.a.localWinding = Math.PI * 2;
    expect(goalProgress(state).current).toBe(0);
  });
  it("navigates to a selected provider index, sanitizes invalid indices and clears trails", () => {
    const engine = new GravityEngine(1, undefined, (seed, index) => ({
      ...base,
      seed,
      index,
    }));
    engine.goTo(12);
    expect(engine.getSnapshot().level.index).toBe(12);
    engine.launchFrom(base.launch, { x: speed, y: 0 });
    engine.clearTrails();
    expect(engine.getSnapshot().particles[0].trail).toEqual([]);
    engine.goTo(NaN);
    expect(engine.getSnapshot().level.index).toBe(12);
  });
});

it("resolves a fast swept elastic contact without swapping planet sides", () => {
  const state = createState({
    ...base,
    bodies: [],
    physics: {
      planetGravity: false,
      planetCollisions: "elastic",
      planetRadius: 5,
    },
  });
  fireFrom(state, { x: 400, y: 450 }, { x: 6000, y: 0 });
  fireFrom(state, { x: 420, y: 450 }, { x: -6000, y: 0 });
  step(state, 1 / 120);
  expect(state.particles[0].velocity.x).toBe(-6000);
  expect(state.particles[0].position.x).toBeLessThan(
    state.particles[1].position.x,
  );
});
it("retains the requested trail duration with a fixed per planet memory budget", () => {
  const state = createState({ ...base, physics: { trailSeconds: 24 } });
  fireFrom(state, base.launch, { x: speed, y: 0 });
  run(state, 30);
  const trail = state.particles[0].trail;
  expect(trail.length).toBeLessThanOrEqual(512);
  expect(state.elapsed - trail[0].time).toBeGreaterThan(23.8);
});
it("simulates all 128 mutually attracting planets deterministically", () => {
  const level = {
    ...base,
    bodies: [],
    physics: { planetGravity: true, planetCollisions: "none" as const },
  };
  const a = createState(level),
    b = createState(level);
  for (const state of [a, b])
    for (let n = 0; n < 128; n++)
      fireFrom(
        state,
        { x: 100 + (n % 16) * 40, y: 100 + Math.floor(n / 16) * 60 },
        { x: 0, y: 0 },
      );
  run(a, 0.25);
  run(b, 0.25);
  expect(a.particles.filter((p) => p.alive)).toHaveLength(128);
  expect(a).toEqual(b);
  expect(a.particles[0].position.x).toBeGreaterThan(100);
});

describe("ordered swept contact events", () => {
  it("resolves an earlier planet contact before a later well absorption", () => {
    const state = createState({
      ...base,
      bodies: [
        {
          id: "well",
          kind: "attractor",
          position: { x: 480, y: 450 },
          radius: 5,
          strength: 0,
        },
      ],
      physics: {
        planetGravity: false,
        planetCollisions: "elastic",
        planetRadius: 5,
      },
    });
    fireFrom(state, { x: 400, y: 450 }, { x: 12000, y: 0 });
    fireFrom(state, { x: 430, y: 450 }, { x: 0, y: 0 });
    step(state, 1 / 120);
    expect(state.particles[0].alive).toBe(true);
    expect(state.particles[0].position.x).toBeCloseTo(420, 8);
    expect(state.particles[0].velocity.x).toBe(0);
    expect(state.particles[1].alive).toBe(false);
    expect(state.particles[1].position.x).toBeCloseTo(470, 8);
  });
  it("uses only remaining drift time across a three planet impact chain", () => {
    const state = createState({
      ...base,
      bodies: [],
      physics: {
        planetGravity: false,
        planetCollisions: "elastic",
        planetRadius: 5,
      },
    });
    fireFrom(state, { x: 400, y: 450 }, { x: 12000, y: 0 });
    fireFrom(state, { x: 430, y: 450 }, { x: 0, y: 0 });
    fireFrom(state, { x: 460, y: 450 }, { x: 0, y: 0 });
    step(state, 1 / 120);
    expect(state.particles.map((p) => p.velocity.x)).toEqual([0, 0, 12000]);
    expect(
      state.particles.reduce((sum, p) => sum + p.mass * p.position.x, 0),
    ).toBeCloseTo(1390, 8);
    [420, 450, 520].forEach((x, i) =>
      expect(state.particles[i].position.x).toBeCloseTo(x, 8),
    );
  });
});

it("preserves center of mass and momentum through successive merge events", () => {
  const state = createState({
    ...base,
    bodies: [],
    physics: { planetCollisions: "merge", planetRadius: 5 },
  });
  fireFrom(state, { x: 400, y: 450 }, { x: 12000, y: 0 });
  fireFrom(state, { x: 430, y: 450 }, { x: 0, y: 0 });
  fireFrom(state, { x: 460, y: 450 }, { x: 0, y: 0 });
  state.particles[0].mass = 2;
  step(state, 1 / 120);
  const live = state.particles.filter((p) => p.alive);
  expect(live).toHaveLength(1);
  expect(live[0].mass).toBe(4);
  expect(live[0].velocity.x).toBeCloseTo(6000, 8);
  expect(live[0].position.x * live[0].mass).toBeCloseTo(1890, 8);
});
it("sweeps a moving absorbing well against a stationary planet", () => {
  const state = createState({
    ...base,
    bodies: [
      {
        id: "well",
        kind: "attractor",
        position: { x: 0, y: 0 },
        radius: 5,
        strength: 0,
      },
    ],
    motions: [
      {
        bodyId: "well",
        kind: "oscillate",
        center: { x: 400, y: 450 },
        amplitude: { x: 2000, y: 0 },
        period: 1,
      },
    ],
    physics: { planetRadius: 5 },
  });
  fireFrom(state, { x: 450, y: 450 }, { x: 0, y: 0 });
  step(state, 1 / 120);
  expect(state.particles[0].alive).toBe(false);
  expect(state.particles[0].position).toEqual({ x: 450, y: 450 });
});
it("keeps overlapping elastic clusters finite with bounded contact processing", () => {
  const state = createState({
    ...base,
    bodies: [],
    physics: {
      planetGravity: false,
      planetCollisions: "elastic",
      planetRadius: 5,
    },
  });
  for (let n = 0; n < 12; n++)
    fireFrom(state, { x: 450, y: 450 }, { x: 0, y: 0 });
  step(state, 1 / 120);
  expect(state.particles.filter((p) => p.alive)).toHaveLength(12);
  expect(
    state.particles.every(
      (p) => Number.isFinite(p.position.x) && Number.isFinite(p.velocity.x),
    ),
  ).toBe(true);
  expect(state.particles.reduce((sum, p) => sum + p.position.x, 0)).toBeCloseTo(
    5400,
    8,
  );
});

it("keeps moving well absorption active when a dense overlap cluster exhausts its contact budget", () => {
  const state = createState({
    ...base,
    bodies: [
      {
        id: "well",
        kind: "attractor",
        position: { x: 0, y: 450 },
        radius: 5,
        strength: 0,
      },
    ],
    motions: [
      {
        bodyId: "well",
        kind: "oscillate",
        center: { x: 0, y: 450 },
        amplitude: { x: 20000, y: 0 },
        period: 1,
      },
    ],
    physics: {
      planetGravity: false,
      planetCollisions: "elastic",
      planetRadius: 5,
    },
  });
  for (let n = 0; n < 64; n++)
    fireFrom(state, { x: 450, y: 450 }, { x: 0, y: 0 });
  step(state, 1 / 120);
  expect(state.particles.filter((p) => p.alive)).toHaveLength(0);
});
it("describes requirement targets by their visible positions", () => {
  const single = { ...base, requirements: [{ bodyId: "a", count: 1 }] };
  expect(objectiveText(single)).toContain("orbiting the core");
  const multiple = {
    ...single,
    bodies: [
      ...base.bodies,
      {
        ...base.bodies[0],
        id: "internal-well-2",
        position: { x: 700, y: 450 },
      },
    ],
    requirements: [{ bodyId: "internal-well-2", count: 2 }],
  };
  expect(objectiveText(multiple)).toContain("around the rightmost core");
  expect(objectiveText(multiple)).not.toContain("internal-well-2");
});

describe("simultaneous contacts at the fixed step endpoint", () => {
  it("absorbs every planet reaching a well surface exactly at the endpoint", () => {
    const state = createState({
      ...base,
      bodies: [
        {
          id: "well",
          kind: "attractor",
          position: { x: 450, y: 450 },
          radius: 5,
          strength: 0,
        },
      ],
      physics: { planetRadius: 5 },
    });
    fireFrom(state, { x: 420, y: 450 }, { x: 2400, y: 0 });
    fireFrom(state, { x: 480, y: 450 }, { x: -2400, y: 0 });
    step(state, 1 / 120);
    expect(state.particles.map((p) => p.alive)).toEqual([false, false]);
    expect(state.particles.map((p) => p.position.x)).toEqual([440, 460]);
  });
  it("propagates a touching elastic impact chain at the endpoint without delaying momentum transfer", () => {
    const state = createState({
      ...base,
      bodies: [],
      physics: {
        planetGravity: false,
        planetCollisions: "elastic",
        planetRadius: 5,
      },
    });
    fireFrom(state, { x: 400, y: 450 }, { x: 2400, y: 0 });
    fireFrom(state, { x: 430, y: 450 }, { x: 0, y: 0 });
    fireFrom(state, { x: 440, y: 450 }, { x: 0, y: 0 });
    step(state, 1 / 120);
    expect(state.particles.map((p) => p.velocity.x)).toEqual([0, 0, 2400]);
    expect(state.particles.map((p) => p.position.x)).toEqual([420, 430, 440]);
  });
});
