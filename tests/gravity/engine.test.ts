import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import type { GravityLevel } from "../../src/gravity/types";

function orbitEngine() {
  const level: GravityLevel = {
    index: 0,
    seed: 1,
    family: "loop",
    bounds: { x: 0, y: 0, width: 900, height: 900 },
    launch: { x: 450, y: 650 },
    bodies: [
      {
        id: "well",
        kind: "attractor",
        position: { x: 450, y: 450 },
        radius: 40,
        strength: 1440000,
      },
    ],
    objective: { kind: "loop", count: 1, turns: 1, hold: 0 },
    witness: [],
  };
  const engine = new GravityEngine(1, level);
  engine.setAim(
    0,
    Math.sqrt((1440000 * 200) / (200 * 200 + 40 * 40)) / 420,
  );
  engine.launch();
  return engine;
}

function advanceFrames(engine: GravityEngine, frames: number) {
  for (let n = 0; n < frames; n++) engine.update(1 / 60);
}

describe("Gravity playback pace", () => {
  it("advances fewer physical steps at 1.4 than the previous pace over equal wall time", () => {
    const current = orbitEngine();
    const previous = orbitEngine();
    previous.setTimeScale(1.45);
    advanceFrames(current, 120);
    advanceFrames(previous, 120);
    const slower = current.getSnapshot();
    const faster = previous.getSnapshot();
    expect(slower.elapsed).toBeCloseTo(2.8, 10);
    expect(faster.elapsed).toBeCloseTo(2.9, 10);
    expect(slower.elapsed).toBeLessThan(faster.elapsed);
    expect(slower.particles[0].position).not.toEqual(faster.particles[0].position);
    expect(Math.abs(slower.particles[0].orbits.well.winding)).toBeLessThan(
      Math.abs(faster.particles[0].orbits.well.winding),
    );
  });

  it("preserves the full orbit and trajectory at matched physical time", () => {
    const current = orbitEngine();
    const previous = orbitEngine();
    previous.setTimeScale(1.45);
    // 14.5 seconds at 1.4 and 14 seconds at 1.45 both simulate 20.3 seconds.
    advanceFrames(current, 870);
    advanceFrames(previous, 840);
    const slower = current.getSnapshot();
    const faster = previous.getSnapshot();
    expect(slower.elapsed).toBeCloseTo(20.3, 10);
    expect(slower.elapsed).toBe(faster.elapsed);
    expect(slower.particles[0].alive).toBe(true);
    expect(Math.abs(slower.particles[0].orbits.well.winding)).toBeGreaterThan(
      2 * Math.PI,
    );
    expect(slower.particles).toEqual(faster.particles);
    expect(slower.physics).toEqual(faster.physics);
    expect(slower.progress).toEqual(faster.progress);
    expect(slower.complete).toBe(true);
    expect(slower.complete).toBe(faster.complete);
  });
});

function solve(engine: GravityEngine) {
  engine.setTimeScale(1);
  const level = engine.getSnapshot().level;
  let shot = 0;
  for (let n = 0; n < 120 * 85 && !engine.getSnapshot().complete; n++) {
    while (
      shot < level.witness.length &&
      level.witness[shot].time <= n / 120 + 1e-8
    ) {
      const witness = level.witness[shot];
      if (witness.position && witness.velocity)
        engine.launchFrom(witness.position, witness.velocity);
      else {
        engine.setAim(witness.angle, witness.power);
        engine.launch();
      }
      shot++;
    }
    engine.update(1 / 120);
  }
}
describe("Gravity engine lifecycle", () => {
  it("keeps the puzzle on retry and advances a completion exactly once", () => {
    const engine = new GravityEngine(42);
    const first = engine.getSnapshot().level;
    engine.launch();
    engine.update(1);
    engine.retry();
    expect(engine.getSnapshot().particles).toHaveLength(0);
    expect(engine.getSnapshot().level).toEqual(first);
    solve(engine);
    expect(engine.getSnapshot().complete).toBe(true);
    engine.setProjectileSize(2);
    engine.advance();
    engine.advance();
    expect(engine.getSnapshot().level.index).toBe(1);
    expect(engine.getSnapshot().completedCount).toBe(1);
    expect(engine.getProjectileSize()).toBe(2);
    expect(engine.getSnapshot().physics.planetRadius).toBe(
      (engine.getSnapshot().level.physics?.planetRadius ?? 4) * 2,
    );
  });
  it("skips without counting a completion and retries the new layout", () => {
    const engine = new GravityEngine(3);
    engine.skip();
    expect(engine.getSnapshot().level.index).toBe(1);
    expect(engine.getSnapshot().completedCount).toBe(0);
    engine.launch();
    engine.retry();
    expect(engine.getSnapshot().particles).toHaveLength(0);
    expect(engine.getSnapshot().level.index).toBe(1);
  });
  it("predicts without mutating live flight and returns independent snapshots", () => {
    const engine = new GravityEngine(42);
    engine.launch();
    engine.update(1);
    const before = engine.getSnapshot();
    expect(engine.predict().length).toBeGreaterThan(2);
    expect(engine.getSnapshot()).toEqual(before);
    before.level.bodies[0].position.x = -1;
    before.particles[0].position.x = -1;
    expect(engine.getSnapshot().level.bodies[0].position.x).not.toBe(-1);
    expect(engine.getSnapshot().particles[0].position.x).not.toBe(-1);
  });
});
