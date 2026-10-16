import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import type { GravityLevel } from "../../src/gravity/types";

const outer = { x: -200, y: -200, width: 400, height: 400 };
function level(index = 0): GravityLevel {
  return {
    index,
    seed: 42,
    family: "none",
    bounds: outer,
    launch: { x: 0, y: 80 },
    bodies: [
      {
        id: "core",
        kind: "attractor",
        position: { x: 0, y: 0 },
        radius: 2,
        strength: 10000,
      },
    ],
    objective: { kind: "none", count: 0, turns: 1, hold: 0 },
    physics: { planetGravity: false, planetRadius: 6 },
    witness: [],
  };
}
function world(custom = level()) {
  const engine = new GravityEngine(42, custom);
  engine.setTimeScale(1);
  engine.setFlightBounds(outer);
  return engine;
}

describe("outer boundary is the only offscreen removal rule", () => {
  it("still destroys a projectile on a fixed core collision", () => {
    const engine = world();
    engine.launchFrom({ x: 30, y: 0 }, { x: -100, y: 0 });
    for (let n = 0; n < 60; n++) engine.update(1 / 120);
    expect(engine.getSnapshot().particles[0].alive).toBe(false);
  });
  it("does not invent an escape cutoff when no camera boundary is supplied", () => {
    const engine = new GravityEngine(42, level());
    engine.launchFrom({ x: 1000000, y: 0 }, { x: 100, y: 0 });
    engine.update(1 / 120);
    expect(engine.getSnapshot().particles[0].alive).toBe(true);
  });
  it.each([
    [108, 100],
    [-108, -100],
  ])(
    "keeps an unbound outward shot inside the outer boundary at %s",
    (x, vx) => {
      const engine = world();
      engine.launchFrom({ x, y: 0 }, { x: vx, y: 0 });
      engine.update(1 / 120);
      expect(engine.getSnapshot().particles[0].alive).toBe(true);
    },
  );
  it.each([
    { x: 108, vx: -100, name: "returning" },
    { x: 108, vx: 1, name: "gravitationally bound" },
    { x: 105, vx: 100, name: "still visible" },
  ])("preserves a $name shot", ({ x, vx }) => {
    const engine = world();
    engine.launchFrom({ x, y: 0 }, { x: vx, y: 0 });
    engine.update(1 / 120);
    expect(engine.getSnapshot().particles[0].alive).toBe(true);
  });
  it("keeps a shot approaching another attractive source", () => {
    const custom = level();
    custom.bodies.push({
      id: "other",
      kind: "attractor",
      position: { x: 170, y: 0 },
      radius: 2,
      strength: 10000,
    });
    const engine = world(custom);
    engine.launchFrom({ x: 108, y: 0 }, { x: 100, y: 0 });
    engine.update(1 / 120);
    expect(engine.getSnapshot().particles[0].alive).toBe(true);
  });
  it("keeps shots around moving cores because future energy can change", () => {
    const custom = level();
    custom.motions = [
      {
        bodyId: "core",
        kind: "circle",
        center: { x: 0, y: 0 },
        radius: 5,
        period: 10,
      },
    ];
    const engine = world(custom);
    engine.launchFrom({ x: 108, y: 0 }, { x: 100, y: 0 });
    engine.update(1 / 120);
    expect(engine.getSnapshot().particles[0].alive).toBe(true);
  });
  it("keeps an offscreen planet that is bound to a travelling companion", () => {
    const engine = world();
    engine.setParticleInteraction(true);
    engine.launchFrom({ x: 108, y: 0 }, { x: 100, y: 0 });
    engine.launchFrom({ x: 124, y: 0 }, { x: 100, y: 0 });
    engine.update(1 / 120);
    expect(engine.getSnapshot().particles.every((p) => p.alive)).toBe(true);
  });
  it("preserves the outer boundary through retries, navigation and predictions", () => {
    const engine = new GravityEngine(42, undefined, (_seed, index) =>
      level(index),
    );
    engine.setFlightBounds(outer);
    engine.retry();
    engine.skip();
    expect(engine.getSnapshot().flightBounds).toEqual(outer);
    const path = engine.predictFrom({ x: 95, y: 80 }, { x: 100, y: 0 }, 2);
    expect(path.at(-1)!.x).toBeGreaterThan(200);
    expect(path.at(-1)!.x).toBeLessThan(208);
    expect(engine.getSnapshot().particles).toEqual([]);
  });
});
