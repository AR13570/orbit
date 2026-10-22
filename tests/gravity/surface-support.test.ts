import { describe, expect, it } from "vitest";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import { planetAccelerations } from "../../src/gravity/physics";
import type { GravityLevel, GravityState } from "../../src/gravity/types";

const empty: GravityLevel = {
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
function pair(vx = 0, vy = 0) {
  const state = createState(empty);
  fireFrom(state, { x: 0, y: 0 }, { x: 0, y: 0 });
  fireFrom(state, { x: 12, y: 0 }, { x: vx, y: vy });
  state.particles[0].mass = 4;
  state.particles[0].radius = 8;
  return state;
}
function run(state: GravityState, seconds: number, dt = 1 / 120) {
  for (let i = 0; i < Math.round(seconds / dt); i++) step(state, dt);
}
function distance(state: GravityState, i = 0, j = 1) {
  const a = state.particles[i],
    b = state.particles[j];
  return Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
}
function conserved(state: GravityState) {
  return state.particles.reduce(
    (sum, p) => ({
      x: sum.x + p.mass * p.velocity.x,
      y: sum.y + p.mass * p.velocity.y,
      angular:
        sum.angular +
        p.mass * (p.position.x * p.velocity.y - p.position.y * p.velocity.x),
    }),
    { x: 0, y: 0, angular: 0 },
  );
}

describe("gravitational surface support", () => {
  it("absorbs an initially overlapping group inside a core before recovering planet overlaps", () => {
    const state = createState({
      ...empty,
      bodies: [
        {
          id: "core",
          kind: "attractor",
          position: { x: 0, y: 0 },
          radius: 10,
          strength: 0,
        },
      ],
    });
    for (let i = 0; i < 12; i++)
      fireFrom(state, { x: 0, y: 0 }, { x: 0, y: 0 });
    step(state, 1 / 120);
    expect(state.particles.every((p) => !p.alive)).toBe(true);
  });
  it.each([1 / 120, 1 / 240, 1 / 480])(
    "supports stationary touching surfaces without repeated gravity bounces at dt=%s",
    (dt) => {
      const state = pair();
      run(state, 2, dt);
      expect(distance(state)).toBeCloseTo(12, 7);
      for (const p of state.particles)
        expect(Math.hypot(p.velocity.x, p.velocity.y)).toBeLessThan(1e-7);
    },
  );

  it("transfers a bound radial impact into shared motion without rebound", () => {
    const state = pair(-50);
    run(state, 5);
    expect(distance(state)).toBeCloseTo(12, 7);
    expect(state.particles[0].velocity.x).toBeCloseTo(-10, 8);
    expect(state.particles[1].velocity.x).toBeCloseTo(-10, 8);
    expect(conserved(state).x).toBeCloseTo(-50, 8);
    expect(conserved(state).angular).toBeCloseTo(0, 8);
  });

  it("preserves enough sideways momentum for a fast grazing collision to escape", () => {
    const state = pair(-400, 460);
    run(state, 5);
    expect(distance(state)).toBeGreaterThan(600);
    expect(conserved(state).x).toBeCloseTo(-400, 8);
    expect(conserved(state).y).toBeCloseTo(460, 8);
    expect(conserved(state).angular).toBeCloseTo(5520, 7);
  });

  it("settles slow radial impacts without inventing rotation or losing center of mass motion", () => {
    const state = pair(-2);
    run(state, 4);
    expect(distance(state)).toBeCloseTo(12, 5);
    expect(state.particles[0].velocity.x).toBeCloseTo(-0.4, 5);
    expect(state.particles[1].velocity.x).toBeCloseTo(-0.4, 5);
    expect(conserved(state).angular).toBe(0);
    expect(
      state.particles.every((p) => p.position.y === 0 && p.velocity.y === 0),
    ).toBe(true);
  });

  it("preserves sideways momentum while supported surfaces move around their shared center", () => {
    const state = pair(0, 10);
    const initial = conserved(state);
    run(state, 2);
    expect(distance(state)).toBeGreaterThanOrEqual(12 - 1e-6);
    expect(distance(state)).toBeLessThan(12.02);
    expect(conserved(state).x).toBeCloseTo(initial.x, 8);
    expect(conserved(state).y).toBeCloseTo(initial.y, 8);
    expect(conserved(state).angular).toBeCloseTo(initial.angular, 6);
    expect(
      Math.abs(state.particles[1].position.y - state.particles[0].position.y),
    ).toBeGreaterThan(1);
  });

  it("releases touching surfaces when sideways momentum exceeds the gravity needed for a circular path", () => {
    const state = pair();
    const forces = planetAccelerations(state.particles, [], state.physics);
    const circularSpeed = Math.sqrt((forces[0].x - forces[1].x) * 12);
    state.particles[1].velocity.y = circularSpeed * 2;
    const angular = conserved(state).angular;
    run(state, 0.5);
    expect(distance(state)).toBeGreaterThan(20);
    expect(conserved(state).angular).toBeCloseTo(angular, 7);
  });

  it("allows an already separating surface contact to leave without a pull from contact support", () => {
    const state = pair(450);
    run(state, 1);
    expect(distance(state)).toBeGreaterThan(80);
    expect(conserved(state).x).toBeCloseTo(450, 8);
  });

  it("supports a translating seven planet packing without penetration or freezing its center of mass", () => {
    const state = createState(empty);
    fireFrom(state, { x: 0, y: 0 }, { x: 5, y: 9 });
    for (let i = 0; i < 6; i++)
      fireFrom(
        state,
        {
          x: 8 * Math.cos((i * Math.PI) / 3),
          y: 8 * Math.sin((i * Math.PI) / 3),
        },
        { x: 5, y: 9 },
      );
    run(state, 2);
    for (let i = 0; i < 7; i++)
      for (let j = i + 1; j < 7; j++)
        expect(distance(state, i, j)).toBeGreaterThanOrEqual(8 - 1e-6);
    expect(
      state.particles.reduce((s, p) => s + p.position.x, 0) / 7,
    ).toBeCloseTo(10, 5);
    expect(
      state.particles.reduce((s, p) => s + p.position.y, 0) / 7,
    ).toBeCloseTo(18, 5);
    expect(conserved(state).x).toBeCloseTo(35, 7);
    expect(conserved(state).y).toBeCloseTo(63, 7);
  });

  it.each(["touching line", "initial overlap"])(
    "advances a dense twelve planet %s without exhausting contact time",
    (shape) => {
      const state = createState(empty);
      for (let i = 0; i < 12; i++)
        fireFrom(
          state,
          { x: shape === "touching line" ? i * 8 : 0, y: 0 },
          { x: 5, y: 9 },
        );
      const initialX =
        state.particles.reduce((s, p) => s + p.position.x, 0) / 12;
      run(state, 1);
      for (let i = 0; i < 12; i++)
        for (let j = i + 1; j < 12; j++)
          expect(distance(state, i, j)).toBeGreaterThanOrEqual(8 - 1e-6);
      expect(
        state.particles.reduce((s, p) => s + p.position.x, 0) / 12,
      ).toBeCloseTo(initialX + 5, 5);
      expect(
        state.particles.reduce((s, p) => s + p.position.y, 0) / 12,
      ).toBeCloseTo(9, 5);
    },
  );

  it("propagates a third planet's oblique impact through a supported pair without losing angular momentum", () => {
    const state = createState(empty);
    fireFrom(state, { x: -4, y: 0 }, { x: 0, y: -10 });
    fireFrom(state, { x: 4, y: 0 }, { x: 0, y: 10 });
    fireFrom(state, { x: -16, y: -2 }, { x: 1000, y: 100 });
    run(state, 0.1);
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++)
        expect(distance(state, i, j)).toBeGreaterThanOrEqual(8 - 1e-7);
    expect(conserved(state).x).toBeCloseTo(1000, 8);
    expect(conserved(state).y).toBeCloseTo(100, 8);
    expect(conserved(state).angular).toBeCloseTo(480, 7);
  });
});

describe("unattached orbital motion and aggregate gravity", () => {
  it("bends a fast flyby without capturing it", () => {
    const state = pair();
    state.particles[1].position = { x: -150, y: 30 };
    state.particles[1].velocity = { x: 300, y: 0 };
    run(state, 1);
    expect(state.particles[1].position.y).toBeLessThan(28);
    expect(distance(state)).toBeGreaterThan(140);
    expect(conserved(state).x).toBeCloseTo(300, 8);
  });

  it("keeps a bound near circular pair apart without attaching or damping its orbit", () => {
    const state = pair();
    state.particles[1].position.x = 60;
    const [a, b] = planetAccelerations(state.particles, [], state.physics);
    state.particles[1].velocity.y = Math.sqrt((a.x - b.x) * 60);
    const initialAngular = conserved(state).angular;
    let closest = Infinity,
      farthest = 0;
    for (let i = 0; i < 1200; i++) {
      step(state, 1 / 120);
      closest = Math.min(closest, distance(state));
      farthest = Math.max(farthest, distance(state));
    }
    expect(closest).toBeGreaterThan(58);
    expect(farthest).toBeLessThan(62);
    expect(conserved(state).angular).toBeCloseTo(initialAngular, 6);
  });

  it("combines incoming momentum and lets a third planet feel every member's gravity", () => {
    const state = pair(-2);
    run(state, 4);
    const centerVelocity = conserved(state).x / 5;
    expect(centerVelocity).toBeCloseTo(-0.4, 8);
    fireFrom(state, { x: 100, y: 100 }, { x: 0, y: 0 });
    const all = planetAccelerations(state.particles, [], state.physics)[2];
    const first = planetAccelerations(
      [state.particles[0], state.particles[2]],
      [],
      state.physics,
    )[1];
    const second = planetAccelerations(
      [state.particles[1], state.particles[2]],
      [],
      state.physics,
    )[1];
    expect(all.x).toBeCloseTo(first.x + second.x, 12);
    expect(all.y).toBeCloseTo(first.y + second.y, 12);
    expect(Math.hypot(all.x, all.y)).toBeGreaterThan(
      Math.hypot(first.x, first.y),
    );
  });

  it("does not multiply fixed core acceleration by the orbiting planet's mass", () => {
    const state = pair();
    const core = {
      id: "core",
      kind: "attractor" as const,
      position: { x: 200, y: 0 },
      radius: 20,
      strength: 1000000,
    };
    const body = state.particles[0];
    const light = planetAccelerations(
      [{ ...body, mass: 1 }],
      [core],
      state.physics,
    )[0];
    const heavy = planetAccelerations(
      [{ ...body, mass: 100 }],
      [core],
      state.physics,
    )[0];
    expect(heavy).toEqual(light);
    expect(light.x).toBeGreaterThan(0);
  });
});
