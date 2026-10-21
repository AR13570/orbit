import { expect, it } from "vitest";
import {
  createState,
  fireFrom,
  goalProgress,
} from "../../src/gravity/simulation";
import { updateOrbits } from "../../src/gravity/orbits";
import type { GravityLevel, GravityParticle } from "../../src/gravity/types";
const level: GravityLevel = {
  seed: 1,
  index: 0,
  family: "tour",
  bounds: { x: 0, y: 0, width: 900, height: 900 },
  launch: { x: 200, y: 450 },
  bodies: [200, 600].map((x, i) => ({
    id: `well-${i + 1}`,
    kind: "attractor",
    position: { x, y: 450 },
    radius: 18,
    strength: 2800000,
  })),
  objective: { kind: "tour", count: 1, turns: 1, hold: 0 },
  witness: [],
  journey: {
    legs: [
      { bodyId: "well-1", radius: 110, sweep: Math.PI / 3 },
      { bodyId: "well-2", radius: 110, sweep: Math.PI / 3 },
    ],
  },
};
function arc(p: GravityParticle, body: number, radius = 80) {
  for (let i = 0; i <= 16; i++) {
    const a = (i * Math.PI) / 32;
    p.position = {
      x: body + Math.cos(a) * radius,
      y: 450 + Math.sin(a) * radius,
    };
    updateOrbits(level, p);
  }
}
it("requires the same living planet to curve around the ordered cores, without pooling separate planets", () => {
  const state = createState(level);
  fireFrom(state, { x: 280, y: 450 }, { x: 0, y: 50 });
  fireFrom(state, { x: 680, y: 450 }, { x: 0, y: 50 });
  arc(state.particles[0], 200);
  arc(state.particles[1], 600);
  expect(goalProgress(state).complete).toBe(false);
  arc(state.particles[0], 600);
  expect(goalProgress(state)).toMatchObject({
    current: 1,
    target: 1,
    complete: true,
  });
  state.particles[0].alive = false;
  expect(goalProgress(state).complete).toBe(false);
});
it("does not credit a stationary touch, out-of-order core, or distant arc", () => {
  const state = createState(level);
  fireFrom(state, { x: 280, y: 450 }, { x: 0, y: 50 });
  const p = state.particles[0];
  arc(p, 600);
  arc(p, 200, 150);
  expect(p.journey?.leg ?? 0).toBe(0);
  p.position = { x: 280, y: 450 };
  for (let n = 0; n < 200; n++) updateOrbits(level, p);
  expect(p.journey?.leg ?? 0).toBe(0);
});
it("shared orbits require one planet to circle every named core, not just their midpoint", () => {
  const state = createState({
    ...level,
    journey: undefined,
    sharedOrbit: ["well-1", "well-2"],
  });
  fireFrom(state, { x: 450, y: 250 }, { x: 30, y: 0 });
  fireFrom(state, { x: 450, y: 650 }, { x: -30, y: 0 });
  state.particles[0].orbits["well-1"].winding = 2.4 * Math.PI;
  state.particles[1].orbits["well-2"].winding = 2.4 * Math.PI;
  expect(goalProgress(state).complete).toBe(false);
  state.particles[0].orbits["well-2"].winding = 2.4 * Math.PI;
  expect(goalProgress(state).complete).toBe(true);
});

it("requires two different planets moving in opposite directions for an opposing shared goal", () => {
  const state = createState({
    ...level,
    journey: undefined,
    sharedOrbit: ["well-1", "well-2"],
    sharedCounter: true,
    objective: { ...level.objective, count: 2 },
  });
  for (let i = 0; i < 2; i++)
    fireFrom(state, { x: 450, y: 250 }, { x: 30, y: 0 });
  for (const p of state.particles)
    for (const id of ["well-1", "well-2"]) p.orbits[id].winding = 2.4 * Math.PI;
  expect(goalProgress(state)).toMatchObject({
    current: 1,
    target: 2,
    complete: false,
  });
  for (const id of ["well-1", "well-2"])
    state.particles[1].orbits[id].winding = -2.4 * Math.PI;
  expect(goalProgress(state)).toMatchObject({
    current: 2,
    target: 2,
    complete: true,
  });
});
