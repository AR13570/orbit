import { expect, it } from "vitest";
import { ContactCandidates } from "../../src/gravity/contact-candidates";
import { createState, fireFrom } from "../../src/gravity/simulation";
it("rebuilds conservative candidates when an impact changes velocity or overlap repair moves a particle", () => {
  const state = createState({
    index: 0,
    seed: 1,
    family: "none",
    bounds: { x: 0, y: 0, width: 1000, height: 1000 },
    launch: { x: 0, y: 0 },
    bodies: [],
    objective: { kind: "none", count: 0, turns: 1, hold: 0 },
    witness: [],
  });
  fireFrom(state, { x: 100, y: 100 }, { x: 0, y: 0 });
  fireFrom(state, { x: 300, y: 100 }, { x: 0, y: 0 });
  const candidates = new ContactCandidates(state.particles);
  expect(candidates.get(1 / 120)).toHaveLength(0);
  state.particles[0].velocity.x = 30000;
  expect(candidates.get(1 / 120)).toEqual([
    [state.particles[0], state.particles[1]],
  ]);
  const second = new ContactCandidates(state.particles);
  state.particles[0].velocity.x = 0;
  expect(second.get(0)).toHaveLength(0);
  state.particles[0].position.x = 295;
  expect(second.get(0)).toHaveLength(1);
});

it("never removes a possible swept-circle collision from a crowded candidate list", async () => {
  const { segmentCircleIntersection } = await import("../../src/game/physics");
  const state = createState({
    index: 0,
    seed: 1,
    family: "none",
    bounds: { x: -1000, y: -1000, width: 2000, height: 2000 },
    launch: { x: 0, y: 0 },
    bodies: [],
    objective: { kind: "none", count: 0, turns: 1, hold: 0 },
    witness: [],
  });
  let seed = 42;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  for (let i = 0; i < 64; i++) {
    fireFrom(
      state,
      { x: random() * 400 - 200, y: random() * 400 - 200 },
      { x: (random() - 0.5) * 10000, y: (random() - 0.5) * 10000 },
    );
    state.particles[i].radius = 2 + random() * 14;
  }
  const candidates = new ContactCandidates(state.particles);
  for (const dt of [0, 1 / 120, 0.25]) {
    state.particles[0].velocity.x = 1e9;
    state.particles[1].position = { ...state.particles[2].position };
    const pairs = candidates.get(dt);
    const keys = pairs.map(([a, b]) => a.id * 64 + b.id);
    expect(keys).toEqual([...new Set(keys)].sort((a, b) => a - b));
    const included = new Set(keys);
    for (let i = 0; i < 64; i++)
      for (let j = i + 1; j < 64; j++) {
        const a = state.particles[i],
          b = state.particles[j];
        const dx = b.position.x - a.position.x,
          dy = b.position.y - a.position.y,
          r = a.radius + b.radius;
        if (
          Math.hypot(dx, dy) <= r ||
          segmentCircleIntersection(
            { x: dx, y: dy },
            {
              x: dx + (b.velocity.x - a.velocity.x) * dt,
              y: dy + (b.velocity.y - a.velocity.y) * dt,
            },
            { x: 0, y: 0 },
            r,
          ) !== null
        )
          expect(included.has(i * 64 + j), `${dt}/${i}/${j}`).toBe(true);
      }
  }
});

it("includes numerical surface contacts when particles reach the edges of their cached boxes", () => {
  const state = createState({
    index: 0,
    seed: 1,
    family: "none",
    bounds: { x: 0, y: 0, width: 1000, height: 1000 },
    launch: { x: 0, y: 0 },
    bodies: [],
    objective: { kind: "none", count: 0, turns: 1, hold: 0 },
    witness: [],
  });
  fireFrom(state, { x: 100, y: 100 }, { x: 0, y: 0 });
  fireFrom(state, { x: 132 + 2e-6 + 2 ** -25, y: 100 }, { x: 0, y: 0 });
  const candidates = new ContactCandidates(state.particles);
  expect(candidates.get(0)).toHaveLength(0);
  state.particles[0].position.x = 100 + (16 + 1e-6) - 8;
  state.particles[1].position.x =
    state.particles[1].position.x - (16 + 1e-6) + 8;
  // A gap smaller than numerical surface tolerance, with both exact swept
  // surfaces still contained in their original disjoint cached boxes.
  expect(candidates.get(0)).toHaveLength(1);
});
