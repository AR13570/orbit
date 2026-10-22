import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { buildGravityLayout, GRAVITY_LAYOUTS } from "../../src/gravity/layouts";
import { assistGroupSpin } from "../../src/gravity/group-spin";
import { planetAccelerations } from "../../src/gravity/physics";
import { createGravityPrediction } from "../../src/gravity/prediction";
import { step } from "../../src/gravity/simulation";
import type { GravityState } from "../../src/gravity/types";

function motion(s: GravityState) {
  const [a, b] = s.particles;
  const dx = b.position.x - a.position.x,
    dy = b.position.y - a.position.y;
  const vx = b.velocity.x - a.velocity.x,
    vy = b.velocity.y - a.velocity.y;
  const distance = Math.hypot(dx, dy),
    mass = a.mass + b.mass;
  return {
    omega: (dx * vy - dy * vx) / (distance * distance),
    angle: Math.atan2(dy, dx),
    gap: distance - a.radius - b.radius,
    px: a.mass * a.velocity.x + b.mass * b.velocity.x,
    py: a.mass * a.velocity.y + b.mass * b.velocity.y,
    cx: (a.mass * a.position.x + b.mass * b.position.x) / mass,
    cy: (a.mass * a.position.y + b.mass * b.position.y) / mass,
  };
}
function setSpin(s: GravityState, omega: number) {
  const m = motion(s),
    [a, b] = s.particles,
    mass = a.mass + b.mass;
  for (const p of s.particles)
    p.velocity = {
      x: m.px / mass - omega * (p.position.y - m.cy),
      y: m.py / mass + omega * (p.position.x - m.cx),
    };
}
function pair() {
  const engine = new GravityEngine(1, {
    index: 0,
    seed: 1,
    family: "none",
    bodies: [],
    bounds: { x: -2000, y: -2000, width: 4000, height: 4000 },
    launch: { x: 0, y: 0 },
    physics: { planetRadius: 6 },
    objective: { kind: "none", count: 0, turns: 1, hold: 0 },
    witness: [],
  });
  engine.launchFrom({ x: -6, y: 0 }, { x: 5, y: 9 });
  engine.launchFrom({ x: 6, y: 0 }, { x: 5, y: 9 });
  const s = engine.getSnapshot();
  for (let n = 0; n < 72; n++) step(s, 1 / 120);
  return s;
}
function capturedWorld(
  orbit: number,
  heading: number,
  sizes: [number, number],
  scale: number,
) {
  const engine = new GravityEngine(42, undefined, (seed, index) =>
    buildGravityLayout(
      GRAVITY_LAYOUTS.find((layout) => layout.id === "single-well")!,
      { index, seed, title: "Tidal physics fixture", source: "campaign" },
    ),
  );
  engine.goTo(3);
  engine.setTimeScale(1);
  engine.setDefaultViewScale(scale);
  engine.setProjectileSize(sizes[0]);
  const core = engine.getSnapshot().level.bodies[0];
  const speed = Math.sqrt((core.strength * orbit) / (orbit * orbit + 40 * 40));
  engine.launchFrom(
    { x: core.position.x + orbit, y: core.position.y },
    { x: 0, y: speed },
  );
  for (let n = 0; n < 36; n++) engine.update(1 / 120);
  const first = engine.getSnapshot().particles[0];
  engine.setProjectileSize(sizes[1]);
  const separation =
    first.radius + engine.getSnapshot().physics.planetRadius + 20;
  const angle =
    Math.atan2(
      first.position.y - core.position.y,
      first.position.x - core.position.x,
    ) + heading;
  engine.launchFrom(
    {
      x: first.position.x + separation * Math.cos(angle),
      y: first.position.y + separation * Math.sin(angle),
    },
    { ...first.velocity },
  );
  return engine;
}

function record(s: GravityState, seconds: number, hz = 120) {
  let last = motion(s).angle,
    angle = 0,
    low = 0,
    longestLow = 0;
  let window: number[] = [],
    minimumFiveSecondRange = Infinity;
  let sample = 0;
  for (let n = 0; n < seconds * hz; n++) {
    step(s, 1 / hz);
    expect(s.particles.every((p) => p.alive)).toBe(true);
    const m = motion(s);
    expect(m.gap).toBeGreaterThanOrEqual(-1e-6);
    angle += Math.atan2(Math.sin(m.angle - last), Math.cos(m.angle - last));
    last = m.angle;
    if (n < hz * 5) continue;
    if (Math.abs(m.omega) < 0.01) {
      low += 1 / hz;
      longestLow = Math.max(longestLow, low);
    } else low = 0;
    if (m.gap > 0.001) window = [];
    if (++sample === hz / 10) {
      sample = 0;
      window.push(angle);
      if (window.length > 51) window.shift();
      if (window.length === 51)
        minimumFiveSecondRange = Math.min(
          minimumFiveSecondRange,
          Math.max(...window) - Math.min(...window),
        );
    }
  }
  return { longestLow, minimumFiveSecondRange, omega: motion(s).omega, angle };
}

describe("settled group spin under core tides", () => {
  it("retains qualification during stable fast rotation without applying torque", () => {
    const s = pair();
    setSpin(s, 0.2);
    const age = s.groupSpin!.groups["0:1"];
    const before = structuredClone(s.particles);
    assistGroupSpin(s, s.particles, 1 / 120);
    expect(s.particles).toEqual(before);
    expect(s.groupSpin!.groups["0:1"]).toBeGreaterThan(age);
    setSpin(s, 0.04);
    assistGroupSpin(s, s.particles, 1 / 120);
    expect(motion(s).omega).toBeCloseTo(0.04 + 0.04 / 120, 9);
  });

  it.each([
    {
      name: "equal planets at orbit300",
      orbit: 300,
      heading: 0,
      sizes: [1, 1] as [number, number],
      scale: 1,
    },
    {
      name: "unequal planets at orbit140",
      orbit: 140,
      heading: Math.PI / 8,
      sizes: [1, 2] as [number, number],
      scale: 1.96,
    },
  ])("prevents recurring near-static orientation for $name", (fixture) => {
    const engine = capturedWorld(
      fixture.orbit,
      fixture.heading,
      fixture.sizes,
      fixture.scale,
    );
    const result = record(engine.getSnapshot(), 120);
    // Weaker near-field binding can briefly release a surface under tides.
    // Qualification deliberately waits 0.35s before applying settled torque.
    expect(result.longestLow).toBeLessThan(0.35);
    expect(result.minimumFiveSecondRange).toBeGreaterThan(0.15);
  });

  it("cancels only opposing external angular acceleration and preserves COM momentum", () => {
    const s = pair();
    s.level.bodies = [
      {
        id: "core",
        kind: "attractor",
        position: { x: -200, y: -200 },
        radius: 24,
        strength: 2800000,
      },
    ];
    // Choose the negative direction so the core's positive torque opposes it.
    setSpin(s, -0.02);
    const before = motion(s),
      [a, b] = s.particles;
    const acc = planetAccelerations(s.particles, s.level.bodies, s.physics);
    const x = b.position.x - a.position.x,
      y = b.position.y - a.position.y;
    const alpha =
      (x * (acc[1].y - acc[0].y) - y * (acc[1].x - acc[0].x)) / (x * x + y * y);
    expect(alpha).toBeGreaterThan(0.02);
    assistGroupSpin(s, s.particles, 1 / 120);
    const after = motion(s);
    expect(after.omega - before.omega).toBeCloseTo(-(0.04 + alpha) / 120, 9);
    expect(after.px).toBeCloseTo(before.px, 10);
    expect(after.py).toBeCloseTo(before.py, 10);
    expect(
      (b.velocity.x - a.velocity.x) * x + (b.velocity.y - a.velocity.y) * y,
    ).toBeCloseTo(0, 10);
    setSpin(s, 0.02);
    const positive = motion(s).omega;
    assistGroupSpin(s, s.particles, 1 / 120);
    expect(motion(s).omega - positive).toBeCloseTo(0.04 / 120, 9);
  });

  it("remembers a qualified direction only at nearzero and discards it on impact or membership loss", () => {
    const s = pair();
    setSpin(s, -0.02);
    assistGroupSpin(s, s.particles, 1 / 120);
    setSpin(s, 0);
    assistGroupSpin(s, s.particles, 1 / 120);
    expect(motion(s).omega).toBeLessThan(0);
    setSpin(s, 0.02);
    assistGroupSpin(s, s.particles, 1 / 120);
    expect(motion(s).omega).toBeGreaterThan(0.02);
    s.particles[0].velocity.x = 100;
    s.particles[1].velocity.x = -100;
    assistGroupSpin(s, s.particles, 1 / 120);
    expect(s.groupSpin?.groups).toEqual({});
    expect(s.groupSpin?.directions).toEqual({});
    setSpin(s, 0);
    s.particles[1].id = 2;
    assistGroupSpin(s, s.particles, 1 / 120);
    expect(motion(s).omega).toBeCloseTo(0, 10);
    expect(s.groupSpin?.directions).toEqual({});
  });

  it("clones active tidal compensation into both prediction paths", () => {
    const engine = capturedWorld(300, 0, [1, 1], 1);
    for (let n = 0; n < 1200; n++) engine.update(1 / 120);
    const before = engine.getSnapshot(),
      position = { x: 1400, y: 1400 },
      velocity = { x: 5, y: 9 };
    const expected = engine.predictFrom(position, velocity, 3);
    const job = createGravityPrediction(before, position, velocity, 3);
    while (!job.done) job.advance(8);
    expect(job.path).toEqual(expected);
    expect(engine.getSnapshot()).toEqual(before);
    engine.launchFrom(position, velocity);
    for (let n = 0; n < 360; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().particles[2].position).toEqual(expected.at(-1));
  });

  it("converges through real-core tidal compensation at120 and240 physical steps", () => {
    const coarse = capturedWorld(300, 0, [1, 1], 1).getSnapshot();
    const fine = structuredClone(coarse);
    const a = record(coarse, 30, 120),
      b = record(fine, 30, 240);
    expect(Math.abs(a.angle - b.angle)).toBeLessThan(0.1);
    expect(Math.abs(a.omega - b.omega)).toBeLessThan(0.02);
  });

  it("rejects the entire torque when the full tidal compensation would unbind the component", () => {
    const s = pair();
    s.physics.planetGravityStrength = 10;
    for (let n = 0; n < 72; n++) step(s, 1 / 120);
    setSpin(s, -0.02);
    s.level.bodies = [
      {
        id: "strong-core",
        kind: "attractor",
        position: { x: 50, y: 100 },
        radius: 24,
        strength: 100000000,
      },
    ];
    const before = structuredClone(s.particles);
    // The floor alone costs 0.09 energy; pair binding is about 0.745.
    // The extra opposing-tide compensation exceeds that complete budget.
    assistGroupSpin(s, s.particles, 1 / 120);
    expect(s.particles).toEqual(before);
    expect(s.groupSpin?.groups).toEqual({});
    expect(s.groupSpin?.directions).toEqual({});
  });

  it("discards remembered direction on engine OFF, policy change and retry", () => {
    const level = pair().level;
    const engine = new GravityEngine(1, level);
    engine.setTimeScale(1);
    engine.launchFrom({ x: -6, y: 0 }, { x: 0, y: 0.12 });
    engine.launchFrom({ x: 6, y: 0 }, { x: 0, y: -0.12 });
    for (let n = 0; n < 72; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().groupSpin?.directions?.["0:1"]).toBe(-1);
    engine.setParticleInteraction(false);
    expect(engine.getSnapshot().groupSpin?.directions).toBeUndefined();
    engine.setParticleInteraction(true);
    for (let n = 0; n < 72; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().groupSpin?.directions?.["0:1"]).toBe(-1);
    engine.setPhysics({ planetCollisions: "none" });
    expect(engine.getSnapshot().groupSpin?.directions).toBeUndefined();
    engine.setPhysics({ planetCollisions: "soft" });
    engine.retry();
    engine.launchFrom({ x: -6, y: 0 }, { x: 0, y: 0 });
    engine.launchFrom({ x: 6, y: 0 }, { x: 0, y: 0 });
    for (let n = 0; n < 72; n++) engine.update(1 / 120);
    expect(motion(engine.getSnapshot()).omega).toBeGreaterThan(0);
    expect(engine.getSnapshot().groupSpin?.directions?.["0:1"]).toBe(1);
  });
});
