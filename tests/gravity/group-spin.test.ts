import { describe, expect, it, vi } from "vitest";
import { assistGroupSpin } from "../../src/gravity/group-spin";
import * as physics from "../../src/gravity/physics";
import * as surfaces from "../../src/gravity/surface-support";
import { GravityEngine } from "../../src/gravity/engine";
import { createGravityPrediction } from "../../src/gravity/prediction";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import type { GravityLevel, GravityState } from "../../src/gravity/types";

const level: GravityLevel = {
  index: 0,
  seed: 1,
  family: "none",
  bounds: { x: -2000, y: -2000, width: 4000, height: 4000 },
  launch: { x: 0, y: 0 },
  bodies: [],
  physics: { planetRadius: 4 },
  objective: { kind: "none", count: 0, turns: 1, hold: 0 },
  witness: [],
};
function pair(omega = 0, custom = level) {
  const engine = new GravityEngine(1, custom);
  engine.setTimeScale(1);
  engine.launchFrom({ x: -4, y: 0 }, { x: 5, y: 9 - 4 * omega });
  engine.launchFrom({ x: 4, y: 0 }, { x: 5, y: 9 + 4 * omega });
  return engine;
}
function advance(engine: GravityEngine, seconds: number) {
  for (let n = 0; n < Math.round(seconds * 120); n++) engine.update(1 / 120);
}
function run(state: GravityState, seconds: number, hz = 120) {
  for (let n = 0; n < Math.round(seconds * hz); n++) step(state, 1 / hz);
}
function motion(state: GravityState) {
  const mass = state.particles.reduce((s, p) => s + p.mass, 0);
  const c = state.particles.reduce(
    (s, p) => ({
      x: s.x + (p.mass * p.position.x) / mass,
      y: s.y + (p.mass * p.position.y) / mass,
      vx: s.vx + (p.mass * p.velocity.x) / mass,
      vy: s.vy + (p.mass * p.velocity.y) / mass,
    }),
    { x: 0, y: 0, vx: 0, vy: 0 },
  );
  let inertia = 0,
    angular = 0;
  for (const p of state.particles) {
    const x = p.position.x - c.x,
      y = p.position.y - c.y;
    inertia += p.mass * (x * x + y * y);
    angular += p.mass * (x * (p.velocity.y - c.vy) - y * (p.velocity.x - c.vx));
  }
  return { ...c, omega: angular / inertia };
}
function distance(state: GravityState) {
  const [a, b] = state.particles;
  return Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
}

describe("gentle gameplay group spin", () => {
  it("waits for stable contact then accelerates physical rotation gradually to the floor", () => {
    const engine = pair();
    advance(engine, 0.3);
    expect(motion(engine.getSnapshot()).omega).toBeCloseTo(0, 10);
    advance(engine, 0.05);
    expect(motion(engine.getSnapshot()).omega).toBeCloseTo(0, 10);
    advance(engine, 0.5);
    expect(motion(engine.getSnapshot()).omega).toBeGreaterThan(0.009);
    expect(motion(engine.getSnapshot()).omega).toBeLessThan(0.0104);
    advance(engine, 7);
    const state = engine.getSnapshot();
    expect(motion(state).omega).toBeCloseTo(0.12, 5);
    expect(distance(state)).toBeCloseTo(8, 6);
    expect(
      Math.abs(state.particles[1].position.y - state.particles[0].position.y),
    ).toBeGreaterThan(0.2);
  });

  it("retains negative spin and unequal-mass center motion and momentum", () => {
    const state = pair(-0.002).getSnapshot();
    state.particles[0].mass = 3;
    const before = motion(state);
    run(state, 7);
    const after = motion(state);
    expect(after.omega).toBeCloseTo(-0.12, 5);
    expect(after.vx).toBeCloseTo(before.vx, 8);
    expect(after.vy).toBeCloseTo(before.vy, 8);
    expect(after.x).toBeCloseTo(before.x + before.vx * 7, 7);
    expect(after.y).toBeCloseTo(before.y + before.vy * 7, 7);
  });

  it("keeps reference createState worlds free of gameplay torque", () => {
    const state = createState(level);
    fireFrom(state, { x: -4, y: 0 }, { x: 0, y: 0 });
    fireFrom(state, { x: 4, y: 0 }, { x: 0, y: 0 });
    run(state, 4);
    expect(motion(state).omega).toBe(0);
  });

  it("leaves faster existing rotation unchanged and lets excessive spin separate naturally", () => {
    const fast = pair(0.8).getSnapshot();
    run(fast, 3);
    expect(motion(fast).omega).toBeCloseTo(0.8, 5);
    const escaping = pair(100).getSnapshot();
    run(escaping, 1);
    const firstDistance = distance(escaping);
    run(escaping, 3);
    expect(escaping.particles.every((p) => p.alive)).toBe(true);
    expect(distance(escaping)).toBeGreaterThan(firstDistance + 100);
  });

  it("does not assist a fresh impact or a high-speed flyby", () => {
    const impact = pair().getSnapshot();
    impact.particles[0].velocity.x = 100;
    impact.particles[1].velocity.x = -100;
    run(impact, 0.3);
    expect(motion(impact).omega).toBeCloseTo(0, 10);
    const flyby = pair(100).getSnapshot();
    const reference = structuredClone(flyby);
    delete reference.groupSpin;
    run(flyby, 1);
    run(reference, 1);
    expect(flyby.particles).toEqual(reference.particles);
  });

  it("requires binding strong enough for the whole remaining boost", () => {
    const weak = pair(0, {
      ...level,
      physics: { planetRadius: 4, planetGravityStrength: 0.005 },
    }).getSnapshot();
    run(weak, 4);
    expect(motion(weak).omega).toBeCloseTo(0, 10);
  });

  it.each(["none", "elastic", "merge"] as const)(
    "does not assist the %s contact policy",
    (policy) => {
      const state = pair(0, {
        ...level,
        physics: { planetRadius: 4, planetCollisions: policy },
      }).getSnapshot();
      const reference = structuredClone(state);
      delete reference.groupSpin;
      run(state, 1);
      run(reference, 1);
      expect(state.particles).toEqual(reference.particles);
    },
  );

  it("clears qualification immediately on OFF and restarts its delay after ON or physics changes", () => {
    const engine = pair();
    advance(engine, 0.3);
    engine.setParticleInteraction(false);
    expect(engine.getSnapshot().groupSpin?.groups).toEqual({});
    advance(engine, 0.5);
    expect(motion(engine.getSnapshot()).omega).toBeCloseTo(0, 10);
    engine.setParticleInteraction(true);
    advance(engine, 0.3);
    expect(motion(engine.getSnapshot()).omega).toBeCloseTo(0, 10);
    engine.setPhysics({ planetGravityStrength: 96000 });
    advance(engine, 0.3);
    expect(motion(engine.getSnapshot()).omega).toBeCloseTo(0, 10);
    advance(engine, 0.1);
    expect(motion(engine.getSnapshot()).omega).toBeGreaterThan(0);
  });

  it("resets membership qualification on separation and replacement", () => {
    const state = pair().getSnapshot();
    run(state, 0.3);
    state.particles[1].position.x += 10;
    step(state, 1 / 120);
    const [a, b] = state.particles;
    b.position = { x: a.position.x + 8, y: a.position.y };
    a.velocity = { x: 0, y: 0 };
    b.velocity = { x: 0, y: 0 };
    run(state, 0.3);
    expect(motion(state).omega).toBeCloseTo(0, 10);
    b.id = 9;
    run(state, 0.3);
    expect(motion(state).omega).toBeCloseTo(0, 10);
    run(state, 0.1);
    expect(motion(state).omega).toBeGreaterThan(0);
  });

  it("initializes fresh gameplay qualification on retry and level navigation", () => {
    const engine = pair();
    advance(engine, 1);
    engine.retry();
    engine.launchFrom({ x: -4, y: 0 }, { x: 0, y: 0 });
    engine.launchFrom({ x: 4, y: 0 }, { x: 0, y: 0 });
    advance(engine, 0.3);
    expect(motion(engine.getSnapshot()).omega).toBeCloseTo(0, 10);
    advance(engine, 0.2);
    expect(motion(engine.getSnapshot()).omega).toBeGreaterThan(0);
    const navigating = new GravityEngine(1, undefined, () =>
      structuredClone(level),
    );
    navigating.goTo(2);
    navigating.setTimeScale(1);
    navigating.launchFrom({ x: -4, y: 0 }, { x: 0, y: 0 });
    navigating.launchFrom({ x: 4, y: 0 }, { x: 0, y: 0 });
    advance(navigating, 0.3);
    expect(motion(navigating.getSnapshot()).omega).toBeCloseTo(0, 10);
    advance(navigating, 0.2);
    expect(motion(navigating.getSnapshot()).omega).toBeGreaterThan(0);
  });

  it("clones active qualification for predictions with exact live parity", () => {
    const engine = pair();
    advance(engine, 0.6);
    const before = engine.getSnapshot();
    expect(motion(before).omega).toBeGreaterThan(0.002);
    const position = { x: 1000, y: 1000 },
      velocity = { x: 5, y: 9 };
    const expected = engine.predictFrom(position, velocity, 2);
    const job = createGravityPrediction(before, position, velocity, 2);
    while (!job.done) job.advance(8);
    expect(job.path).toEqual(expected);
    expect(engine.getSnapshot()).toEqual(before);
    engine.launchFrom(position, velocity);
    advance(engine, 2);
    expect(engine.getSnapshot().particles[2].position).toEqual(expected.at(-1));
    const live = engine.getSnapshot();
    expect(
      motion({ ...live, particles: live.particles.slice(0, 2) }).omega,
    ).toBeGreaterThan(0.02);
  });

  it("converges at 120 and 240 physical steps per second", () => {
    const coarse = pair().getSnapshot(),
      fine = structuredClone(coarse);
    run(coarse, 4);
    run(fine, 4, 240);
    expect(motion(coarse).omega).toBeCloseTo(motion(fine).omega, 5);
    for (let i = 0; i < 2; i++) {
      expect(
        Math.hypot(
          coarse.particles[i].position.x - fine.particles[i].position.x,
          coarse.particles[i].position.y - fine.particles[i].position.y,
        ),
      ).toBeLessThan(0.01);
    }
  });

  it("adds no pair-normal velocity while providing genuine angular momentum", () => {
    const state = pair().getSnapshot();
    run(state, 0.5);
    const before = structuredClone(state);
    const [a, b] = state.particles;
    const x = b.position.x - a.position.x,
      y = b.position.y - a.position.y;
    const angularBefore = motion(state).omega;
    // The reference takes the identical contact step without the extra torque.
    delete before.groupSpin;
    step(state, 1 / 120);
    step(before, 1 / 120);
    expect(motion(state).omega - angularBefore).toBeCloseTo(0.02 / 120, 7);
    const normal =
      (b.velocity.x - a.velocity.x) * (b.position.x - a.position.x) +
      (b.velocity.y - a.velocity.y) * (b.position.y - a.position.y);
    expect(normal).toBeCloseTo(0, 9);
    expect(Math.hypot(x, y)).toBeCloseTo(distance(state), 8);
    expect(motion(state).vx).toBeCloseTo(motion(before).vx, 10);
    expect(motion(state).vy).toBeCloseTo(motion(before).vy, 10);
  });

  it("uses orbital direction around the dominant attractor when internal spin is zero", () => {
    const state = pair(0, {
      ...level,
      bodies: [
        {
          id: "core",
          kind: "attractor",
          position: { x: -10000, y: 0 },
          radius: 10,
          strength: 1000,
        },
      ],
    }).getSnapshot();
    for (const p of state.particles) p.velocity = { x: 0, y: -10 };
    run(state, 0.6);
    expect(motion(state).omega).toBeLessThan(-0.002);
  });

  it("does not count internal shear as settled rotation", () => {
    const state = pair().getSnapshot();
    fireFrom(state, { x: 12, y: 0 }, { x: 5, y: 20 });
    assistGroupSpin(state, state.particles, 1 / 120);
    expect(state.groupSpin?.groups).toEqual({});
    const reference = structuredClone(state);
    delete reference.groupSpin;
    run(state, 0.3);
    run(reference, 0.3);
    expect(state.particles).toEqual(reference.particles);
  });

  it("spins a settled three-planet component without projecting its positions", () => {
    const state = pair().getSnapshot();
    fireFrom(state, { x: 0, y: Math.sqrt(48) }, { x: 5, y: 9 });
    run(state, 3.5);
    expect(motion(state).omega).toBeGreaterThan(0.048);
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++) {
        const a = state.particles[i],
          b = state.particles[j];
        expect(
          Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y),
        ).toBeCloseTo(8, 5);
      }
  });

  it("retains bounded contact recovery work with gameplay qualification enabled during a dense collapse", () => {
    const engine = new GravityEngine(1, level);
    const state = engine.getSnapshot();
    let seed = 1;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2,
        radius = 60 + random() * 30;
      fireFrom(
        state,
        { x: radius * Math.cos(angle), y: radius * Math.sin(angle) },
        { x: 5 - 20 * Math.cos(angle), y: 9 - 20 * Math.sin(angle) },
      );
    }
    const initial = motion(state);
    const recovery = vi.spyOn(surfaces, "recoverSurfaceOverlaps");
    const acceleration = vi.spyOn(physics, "planetAccelerations");
    try {
      run(state, 5);
      expect(recovery).toHaveBeenCalledTimes(600);
      // The assist adds at most one all-pair force evaluation per step,
      // shared by every component, in addition to the two physical kicks.
      expect(acceleration.mock.calls.length).toBeLessThanOrEqual(1800);
      expect(acceleration.mock.calls.length).toBeGreaterThan(1200);
    } finally {
      recovery.mockRestore();
      acceleration.mockRestore();
    }
    expect(state.particles).toHaveLength(20);
    expect(state.particles.every((p) => p.alive)).toBe(true);
    const after = motion(state);
    expect(after.vx).toBeCloseTo(initial.vx, 7);
    expect(after.vy).toBeCloseTo(initial.vy, 7);
    expect(after.x).toBeCloseTo(initial.x + 5 * initial.vx, 7);
    expect(after.y).toBeCloseTo(initial.y + 5 * initial.vy, 7);
    for (let i = 0; i < 20; i++)
      for (let j = i + 1; j < 20; j++) {
        const a = state.particles[i],
          b = state.particles[j];
        if (
          !state.passingContacts?.[
            `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`
          ]
        )
          expect(
            Math.hypot(
              a.position.x - b.position.x,
              a.position.y - b.position.y,
            ),
          ).toBeGreaterThanOrEqual(8 - 1e-6);
      }
  });

  it("revokes settled qualification immediately when internal shearing begins", () => {
    const state = pair().getSnapshot();
    fireFrom(state, { x: 0, y: Math.sqrt(48) }, { x: 5, y: 9 });
    run(state, 0.6);
    expect(motion(state).omega).toBeGreaterThan(0.002);
    for (const p of state.particles) p.velocity = { x: 10 * p.id, y: 0 };
    const velocities = state.particles.map((p) => ({ ...p.velocity }));
    assistGroupSpin(state, state.particles, 1 / 120);
    expect(state.particles.map((p) => p.velocity)).toEqual(velocities);
    expect(state.groupSpin?.groups).toEqual({});
  });

  it("refuses a fully bound pair whose gravity cannot support the requested floor", () => {
    // At contact r=8, softened pair gravity G=0.02 gives inward a~0.00045.
    // The floor needs omega²*r=0.1152, despite negative energy at zero speed.
    const state = pair(0, {
      ...level,
      physics: { planetRadius: 4, planetGravityStrength: 0.02 },
    }).getSnapshot();
    run(state, 4);
    expect(motion(state).omega).toBeCloseTo(0, 10);
  });

  it.each([16, 32])(
    "assists a naturally captured radius-%s pair despite bounded contact half-kick chatter",
    (radius) => {
      const engine = new GravityEngine(1, {
        ...level,
        physics: { planetRadius: radius, planetMass: 4 },
      });
      engine.setTimeScale(1);
      // The separated encounter brings angular momentum corresponding to
      // 0.015 rad/s once it reaches contact, below the gentle floor.
      engine.launchFrom({ x: 0, y: 0 }, { x: 5, y: 9 });
      engine.launchFrom(
        { x: 80, y: 0 },
        { x: 5, y: 9 + (0.015 * (2 * radius) ** 2) / 80 },
      );
      let contactTime: number | undefined;
      for (let n = 0; n < 1200; n++) {
        engine.update(1 / 120);
        const state = engine.getSnapshot();
        if (distance(state) <= 2 * radius + 1e-6 && contactTime === undefined)
          contactTime = state.elapsed;
        if (contactTime !== undefined && state.elapsed - contactTime < 0.34) {
          // An energetic transit can briefly overlap before it settles. Its
          // natural spin varies with separation, while angular momentum must
          // remain unchanged until the optional torque starts.
          expect(motion(state).omega * distance(state) ** 2).toBeCloseTo(
            0.015 * (2 * radius) ** 2,
            4,
          );
        }
      }
      const state = engine.getSnapshot();
      expect(contactTime).toBeDefined();
      expect(state.particles.every((p) => p.alive)).toBe(true);
      // At the faster floor, the radius-32 tangent chord can leave a
      // 3.2e-5 numerical gap without changing physical contact geometry.
      expect(distance(state)).toBeGreaterThanOrEqual(2 * radius - 1e-6);
      expect(distance(state)).toBeLessThan(2 * radius + 4e-5);
      expect(motion(state).omega).toBeCloseTo(0.12, 5);
    },
  );

  it("retains large capture prediction parity while the gradual assist is active", () => {
    const engine = new GravityEngine(1, {
      ...level,
      physics: { planetRadius: 16, planetMass: 4 },
    });
    engine.setTimeScale(1);
    engine.launchFrom({ x: 0, y: 0 }, { x: 5, y: 9 });
    engine.launchFrom({ x: 80, y: 0 }, { x: 5, y: 9.192 });
    let before = engine.getSnapshot();
    for (let n = 0; n < 1200 && motion(before).omega < 0.018; n++) {
      engine.update(1 / 120);
      before = engine.getSnapshot();
    }
    expect(motion(before).omega).toBeGreaterThan(0.017);
    expect(motion(before).omega).toBeLessThan(0.024);
    const position = { x: 1000, y: 1000 },
      velocity = { x: 5, y: 9 };
    const expected = engine.predictFrom(position, velocity, 0.5);
    const job = createGravityPrediction(before, position, velocity, 0.5);
    while (!job.done) job.advance(8);
    expect(job.path).toEqual(expected);
    expect(engine.getSnapshot()).toEqual(before);
    engine.launchFrom(position, velocity);
    advance(engine, 0.5);
    expect(engine.getSnapshot().particles[2].position).toEqual(expected.at(-1));
  });

  it("never treats outward separation or extra compression as half-kick chatter", () => {
    for (const relativeNormal of [3, -3]) {
      const state = pair(0, {
        ...level,
        physics: { planetRadius: 16, planetMass: 4 },
      }).getSnapshot();
      state.particles[0].position = { x: -16, y: 0 };
      state.particles[1].position = { x: 16, y: 0 };
      run(state, 0.6);
      expect(motion(state).omega).toBeGreaterThan(0.002);
      state.particles[0].position = { x: -16, y: 0 };
      state.particles[1].position = { x: 16, y: 0 };
      state.particles[0].velocity = { x: -relativeNormal / 2, y: 0 };
      state.particles[1].velocity = { x: relativeNormal / 2, y: 0 };
      const before = state.particles.map((p) => ({ ...p.velocity }));
      assistGroupSpin(state, state.particles, 1 / 120);
      expect(state.particles.map((p) => p.velocity)).toEqual(before);
      expect(state.groupSpin?.groups).toEqual({});
    }
  });

  it("does not qualify a visible gap as numerical contact chatter", () => {
    const state = pair().getSnapshot();
    run(state, 0.6);
    expect(motion(state).omega).toBeGreaterThan(0.002);
    state.particles[0].position = { x: -4, y: 0 };
    state.particles[1].position = { x: 4.001, y: 0 };
    state.particles[0].velocity = { x: 0, y: -0.02 };
    state.particles[1].velocity = { x: 0, y: 0.02 };
    const velocities = state.particles.map((p) => ({ ...p.velocity }));
    assistGroupSpin(state, state.particles, 1 / 120);
    expect(state.particles.map((p) => p.velocity)).toEqual(velocities);
    expect(state.groupSpin?.groups).toEqual({});
  });
});
