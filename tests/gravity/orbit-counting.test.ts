import { describe, expect, it } from "vitest";
import { createState, fireFrom } from "../../src/gravity/simulation";
import {
  goalProgress,
  orbitFraction,
  orbitingCount,
  TAU,
  updateOrbits,
} from "../../src/gravity/orbits";
import type { GravityLevel } from "../../src/gravity/types";

function fixture(local: boolean, direction = 1) {
  const level: GravityLevel = {
    seed: 42,
    index: 0,
    family: "loop",
    bounds: { x: 0, y: 0, width: 1200, height: 1200 },
    launch: { x: 800, y: 600 },
    bodies: [
      {
        id: "core",
        kind: "attractor",
        position: { x: 600, y: 600 },
        radius: 96,
        strength: 12000000,
        softening: 180,
      },
    ],
    objective: { kind: "loop", count: 1, turns: 2, hold: 0 },
    ...(local
      ? { requirements: [{ bodyId: "core", count: 1, turns: 2 }] }
      : {}),
    witness: [],
  };
  const state = createState(level);
  fireFrom(state, level.launch, { x: 0, y: 100 * direction });
  let previous = 0;
  return {
    state,
    turnTo(turns: number) {
      // Small angular steps exercise the real angle unwrapping and lap tracker.
      while (previous < turns - 1e-10) {
        previous = Math.min(turns, previous + 0.001);
        const angle = previous * TAU * direction;
        state.particles[0].position = {
          x: 600 + 200 * Math.cos(angle),
          y: 600 + 200 * Math.sin(angle),
        };
        updateOrbits(state.level, state.particles[0]);
      }
    },
  };
}

describe("Gravity lap recognition", () => {
  it.each([1, -1])(
    "credits local laps at 1.2, 2.2 and 3.2 turns in direction %s",
    (direction) => {
      const { state, turnTo } = fixture(true, direction);
      const track = state.particles[0].orbits.core;
      for (let lap = 1; lap <= 3; lap++) {
        turnTo(lap + 0.2 - 0.001);
        expect(track.localWinding / TAU).toBeCloseTo((lap - 1) * direction, 8);
        turnTo(lap + 0.2);
        expect(track.localWinding / TAU).toBeCloseTo(lap * direction, 8);
      }
    },
  );

  it.each([true, false])(
    "shows a recognized orbiter before its second required lap (local: %s)",
    (local) => {
      const { state, turnTo } = fixture(local);
      turnTo(1.199);
      expect(orbitingCount(state, "core")).toBe(0);
      turnTo(1.2);
      expect(orbitingCount(state, "core")).toBe(1);
      expect(goalProgress(state).complete).toBe(false);
      expect(orbitFraction(state, state.particles[0], "core")).toBeCloseTo(
        0.5,
        6,
      );
      turnTo(2.199);
      expect(goalProgress(state).complete).toBe(false);
      expect(orbitFraction(state, state.particles[0], "core")).toBeLessThan(1);
      turnTo(2.2);
      expect(goalProgress(state).complete).toBe(true);
      expect(orbitFraction(state, state.particles[0], "core")).toBe(1);
      expect(orbitingCount(state, "core")).toBe(1); // Counts particles, not their laps.
      state.particles[0].alive = false;
      expect(orbitingCount(state, "core")).toBe(0);
    },
  );

  it("does not recognize an unbound flyby or an orbit in the wrong direction", () => {
    const { state, turnTo } = fixture(true);
    state.level.requirements![0].direction = "counterclockwise";
    turnTo(2.2);
    expect(orbitingCount(state, "core")).toBe(0);
    expect(goalProgress(state).complete).toBe(false);
    state.level.requirements![0].direction = "clockwise";
    expect(orbitingCount(state, "core")).toBe(1);
    state.particles[0].velocity = { x: 10000, y: 0 };
    expect(orbitingCount(state, "core")).toBe(0);
  });
});

it("applies the same first-lap allowance to shared orbits without awarding local core goals", () => {
  const { state, turnTo } = fixture(true);
  state.level.bodies.push({
    ...state.level.bodies[0],
    id: "other",
    position: { x: 620, y: 600 },
  });
  state.particles[0].orbits.other = {
    ...state.particles[0].orbits.core,
    lapBaseline: {},
  };
  state.level.sharedOrbit = ["core", "other"];
  turnTo(1.199);
  expect(orbitingCount(state, "core")).toBe(0);
  turnTo(1.25);
  expect(orbitingCount(state, "core")).toBe(1);
  expect(orbitingCount(state, "other")).toBe(1);
  expect(state.particles[0].orbits.core.localWinding).toBe(0);
  expect(goalProgress(state).complete).toBe(false);
  turnTo(2.199);
  expect(goalProgress(state).complete).toBe(false);
  turnTo(2.25);
  expect(goalProgress(state).complete).toBe(true);
  delete state.level.sharedOrbit;
  expect(goalProgress(state).complete).toBe(false);
});
