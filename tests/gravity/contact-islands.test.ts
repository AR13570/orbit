import { expect, it } from "vitest";
import { buildEndlessGravityLevel } from "../../src/gravity/endless";
import { planetAccelerations } from "../../src/gravity/physics";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
// Freeze the actual eight-shot ENDLESS mass3 regression independently of future authored solutions.
const shots = [
  [
    0, 385.08944504245073, 487.6479132041019, -103.49488409333709,
    -151.39336001913074,
  ],
  [
    0.3, 400.5260962288099, 363.0963019929015, 141.679555983317,
    -78.32093974156574,
  ],
  [
    0.6, 520.0152298145476, 374.5384027331153, 113.73059640510108,
    115.05027409182989,
  ],
  [
    0.8999999999999999, 543.4611885831796, 492.78911695163566,
    -75.07721135778455, 144.751399402219,
  ],
  [
    1.2, 438.1638610314775, 551.2593390993512, -162.22150244846821,
    -26.297799040287405,
  ],
  [
    1.5, 350.74880003648786, 469.0216455333591, -25.66076288039978,
    -162.9997169993303,
  ],
  [
    1.7999999999999998, 402.8335538772654, 361.4039674160338, 146.6174510305264,
    -74.71559761490236,
  ],
  [
    2.1, 520.7106781186548, 379.28932188134524, 114.35626872331768,
    114.35626872331763,
  ],
];
it.each([1 / 120, 1 / 240])(
  "advances a dense real-core swarm without losing drift time at dt=%s",
  (dt) => {
    const level = buildEndlessGravityLevel(42, 90, "merging-swarm", 0),
      state = createState(level);
    let shot = 0,
      frozen = 0,
      maxSpeed = 0,
      minGap = Infinity,
      maxCenterError = 0;
    for (let n = 0; n < 30 / dt; n++) {
      while (shot < shots.length && shots[shot][0] <= state.elapsed + 1e-8) {
        const [, x, y, vx, vy] = shots[shot++];
        fireFrom(state, { x, y }, { x: vx, y: vy });
      }
      const before = state.particles
        .filter((p) => p.alive)
        .map((p) => ({ id: p.id, x: p.position.x, y: p.position.y }));
      const starting = state.particles.filter((p) => p.alive),
        forces = planetAccelerations(
          starting,
          state.level.bodies,
          state.physics,
        );
      const totalMass = starting.reduce((s, p) => s + p.mass, 0);
      const expected = starting.reduce(
        (s, p, i) => ({
          x:
            s.x +
            p.mass *
              (p.position.x + (p.velocity.x + forces[i].x * dt * 0.5) * dt),
          y:
            s.y +
            p.mass *
              (p.position.y + (p.velocity.y + forces[i].y * dt * 0.5) * dt),
        }),
        { x: 0, y: 0 },
      );
      step(state, dt);
      const live = state.particles.filter((p) => p.alive);
      if (live.length && live.length === before.length) {
        const center = live.reduce(
          (s, p) => ({
            x: s.x + p.mass * p.position.x,
            y: s.y + p.mass * p.position.y,
          }),
          { x: 0, y: 0 },
        );
        maxCenterError = Math.max(
          maxCenterError,
          Math.hypot(center.x - expected.x, center.y - expected.y) / totalMass,
        );
      }
      for (const p of live)
        for (const core of state.level.bodies)
          expect(
            Math.hypot(
              p.position.x - core.position.x,
              p.position.y - core.position.y,
            ),
          ).toBeGreaterThanOrEqual(p.radius + core.radius - 1e-6);
      if (
        live.length &&
        live.length === before.length &&
        live.every((p) => {
          const prev = before.find((q) => q.id === p.id)!;
          return (
            Math.hypot(p.position.x - prev.x, p.position.y - prev.y) < 1e-10
          );
        }) &&
        live.some((p) => Math.hypot(p.velocity.x, p.velocity.y) > 10)
      )
        frozen++;
      for (const p of live)
        maxSpeed = Math.max(maxSpeed, Math.hypot(p.velocity.x, p.velocity.y));
      for (let i = 0; i < live.length; i++)
        for (let j = i + 1; j < live.length; j++)
          minGap = Math.min(
            minGap,
            Math.hypot(
              live[i].position.x - live[j].position.x,
              live[i].position.y - live[j].position.y,
            ) -
              live[i].radius -
              live[j].radius,
          );
    }
    expect(frozen).toBe(0);
    expect(maxCenterError).toBeLessThan(1e-7);
    expect(maxSpeed).toBeLessThan(1000);
    expect(minGap).toBeGreaterThanOrEqual(-1e-6);
  },
);
