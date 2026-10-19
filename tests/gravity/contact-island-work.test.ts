import { expect, it, vi } from "vitest";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import * as surfaces from "../../src/gravity/surface-support";

it("keeps a moving twenty-planet collapse accurate without repeating whole-world overlap recovery inside CCD", () => {
  const state = createState({
    index: 0,
    seed: 1,
    family: "none",
    bounds: { x: -2000, y: -2000, width: 4000, height: 4000 },
    launch: { x: 0, y: 0 },
    bodies: [],
    physics: { planetRadius: 4 },
    objective: { kind: "none", count: 0, turns: 1, hold: 0 },
    witness: [],
  });
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
  const totals = () =>
    state.particles.reduce(
      (s, p) => ({
        x: s.x + p.position.x,
        y: s.y + p.position.y,
        px: s.px + p.velocity.x,
        py: s.py + p.velocity.y,
        angular:
          s.angular + p.position.x * p.velocity.y - p.position.y * p.velocity.x,
      }),
      { x: 0, y: 0, px: 0, py: 0, angular: 0 },
    );
  const before = totals();
  let minimumGap = Infinity,
    maximumCenterError = 0,
    lastPassageTime = 0;
  const recovery = vi.spyOn(surfaces, "recoverSurfaceOverlaps");
  try {
    for (let frame = 0; frame < 1800; frame++) {
      step(state, 1 / 120);
      if (state.passingContacts) lastPassageTime = state.elapsed;
      const now = totals(),
        time = (frame + 1) / 120;
      maximumCenterError = Math.max(
        maximumCenterError,
        Math.hypot(
          now.x - before.x - before.px * time,
          now.y - before.y - before.py * time,
        ) / 20,
      );
      for (let i = 0; i < 20; i++)
        for (let j = i + 1; j < 20; j++) {
          const a = state.particles[i],
            b = state.particles[j];
          if (
            !state.passingContacts?.[
              `${Math.min(a.id, b.id)}:${Math.max(a.id, b.id)}`
            ]
          )
            minimumGap = Math.min(
              minimumGap,
              Math.hypot(
                a.position.x - b.position.x,
                a.position.y - b.position.y,
              ) -
                a.radius -
                b.radius,
            );
        }
    }
    // Operation-count guard, not a machine-dependent wall-clock assertion.
    // Initial overlap recovery is allowed once per step; CCD reuses supported
    // chords instead of repeatedly repairing the entire world after impacts.
    expect(recovery).toHaveBeenCalledTimes(1800);
  } finally {
    recovery.mockRestore();
  }
  expect(state.particles.every((p) => p.alive)).toBe(true);
  expect(minimumGap).toBeGreaterThanOrEqual(-1e-6);
  expect(maximumCenterError).toBeLessThan(1e-7);
  const after = totals();
  expect(after.px).toBeCloseTo(before.px, 7);
  expect(after.py).toBeCloseTo(before.py, 7);
  expect(after.angular).toBeCloseTo(before.angular, 6);
  expect(state.passingContacts).toBeUndefined();
  expect(lastPassageTime).toBeLessThan(10);
  for (let i = 0; i < 20; i++)
    for (let j = i + 1; j < 20; j++) {
      const a = state.particles[i],
        b = state.particles[j];
      expect(
        Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y),
      ).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-6);
    }
});
