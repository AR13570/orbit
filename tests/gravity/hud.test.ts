import { expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { getGravityLevel } from "../../src/gravity/campaign";
import { gravityHudSnapshot } from "../../src/gravity/hud";

it("reuses the HUD when only physical positions, time and orbit tracks change", () => {
  const engine = new GravityEngine(42, getGravityLevel(42, 0));
  engine.launchFrom({ x: 750, y: 500 }, { x: 0, y: 20 });
  const state = engine.getSnapshot();
  const hud = gravityHudSnapshot(state);
  state.elapsed += 1;
  state.particles[0].position.x += 10;
  state.particles[0].velocity.y += 20;
  state.particles[0].trail.push({ x: 700, y: 500, time: 1 });
  expect(gravityHudSnapshot(state, hud)).toBe(hud);
  state.particles[0].alive = false;
  const dead = gravityHudSnapshot(state, hud);
  expect(dead).not.toBe(hud);
  expect(dead.alive).toBe(0);
  expect(hud.alive).toBe(1);
});
it("publishes changed settings, earned wins and visible progress", () => {
  const state = new GravityEngine(42, getGravityLevel(42, 0)).getSnapshot();
  let previous = gravityHudSnapshot(state);
  for (const change of [
    () => {
      state.physics.planetGravity = !state.physics.planetGravity;
    },
    () => {
      state.physics.planetCollisions = "soft";
    },
    () => {
      state.physics.planetRadius += 1;
    },
    () => {
      state.projectileSize = 2;
    },
    () => {
      state.progress.current += 1;
    },
    () => {
      state.complete = true;
    },
    () => {
      state.level.index += 1;
    },
  ]) {
    change();
    const next = gravityHudSnapshot(state, previous);
    expect(next).not.toBe(previous);
    previous = next;
  }
  expect(previous.complete).toBe(true);
});
it("captures changing spatial labels without retaining mutable body positions", () => {
  const engine = new GravityEngine(42, getGravityLevel(42, 0));
  const state = engine.getSnapshot();
  const first = state.level.bodies[0];
  first.position = { x: 100, y: 200 };
  state.level.bodies.push({
    ...first,
    id: "second",
    position: { x: 300, y: 200 },
  });
  state.level.journey = {
    legs: [
      { bodyId: first.id, radius: 200, sweep: Math.PI * 2 },
      { bodyId: "second", radius: 200, sweep: Math.PI * 2 },
    ],
  };
  state.level.requirements = [
    { bodyId: first.id, count: 1, direction: "clockwise" },
  ];
  const previous = gravityHudSnapshot(state);
  expect(previous.journeyLabels).toEqual([
    "the leftmost core",
    "the rightmost core",
  ]);
  first.position.x = 500;
  const next = gravityHudSnapshot(state, previous);
  expect(next).not.toBe(previous);
  expect(next.journeyLabels).toEqual([
    "the rightmost core",
    "the leftmost core",
  ]);
  expect(previous.journeyLabels).toEqual([
    "the leftmost core",
    "the rightmost core",
  ]);
  expect(next.objective).not.toBe(previous.objective);
  expect(next.directionText).not.toBe(previous.directionText);
});
