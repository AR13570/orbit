import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { gravityForceAt, gravityLaunchPower } from "../../src/gravity/physics";
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
        radius: 96,
        strength: 12000000,
        softening: 180,
      },
    ],
    objective: { kind: "loop", count: 1, turns: 2, hold: 0 },
    witness: [],
  };
  const engine = new GravityEngine(1, level);
  engine.setAim(
    0,
    gravityLaunchPower(
      Math.sqrt(-gravityForceAt(level.launch, level.bodies).y * 200),
    ),
  );
  engine.launch();
  return engine;
}

function advanceFrames(engine: GravityEngine, frames: number) {
  for (let n = 0; n < frames; n++) engine.update(1 / 60);
}

describe("Gravity playback pace", () => {
  it("advances at 1.4x instead of the previous 1.2x over equal wall time", () => {
    const current = orbitEngine();
    const previous = orbitEngine();
    previous.setTimeScale(1.2);
    advanceFrames(current, 120);
    advanceFrames(previous, 120);
    const faster = current.getSnapshot();
    const slower = previous.getSnapshot();
    expect(slower.elapsed).toBeCloseTo(2.4, 10);
    expect(faster.elapsed).toBeCloseTo(2.8, 10);
    expect(slower.elapsed).toBeLessThan(faster.elapsed);
    expect(slower.particles[0].position).not.toEqual(
      faster.particles[0].position,
    );
    expect(Math.abs(slower.particles[0].orbits.well.winding)).toBeLessThan(
      Math.abs(faster.particles[0].orbits.well.winding),
    );
  });

  it("preserves the full orbit and trajectory at matched physical time", () => {
    const current = orbitEngine();
    const previous = orbitEngine();
    previous.setTimeScale(1.2);
    // 15 seconds at 1.4 and 17.5 seconds at 1.2 both simulate 21 seconds.
    advanceFrames(current, 900);
    advanceFrames(previous, 1050);
    const currentState = current.getSnapshot();
    const previousState = previous.getSnapshot();
    expect(currentState.elapsed).toBeCloseTo(21, 10);
    expect(currentState.elapsed).toBe(previousState.elapsed);
    expect(currentState.particles[0].alive).toBe(true);
    expect(
      Math.abs(currentState.particles[0].orbits.well.winding),
    ).toBeGreaterThan(4 * Math.PI);
    expect(currentState.particles).toEqual(previousState.particles);
    expect(currentState.physics).toEqual(previousState.physics);
    expect(currentState.progress).toEqual(previousState.progress);
    expect(currentState.complete).toBe(true);
    expect(currentState.complete).toBe(previousState.complete);
  });
});

function solve(engine: GravityEngine) {
  engine.setTimeScale(1);
  const level = engine.getSnapshot().level;
  expect(level.witness.length).toBeGreaterThan(0);
  expect(level.objective.turns).toBeGreaterThanOrEqual(2);
  const horizon = Math.max(90, (level.witness.at(-1)?.time ?? 0) + 60);
  let shot = 0;
  for (
    let n = 0;
    n < 120 * horizon && !engine.getRenderSnapshot().complete;
    n++
  ) {
    while (
      shot < level.witness.length &&
      level.witness[shot].time <= engine.getRenderSnapshot().elapsed + 1e-8
    ) {
      const witness = level.witness[shot++];
      if (witness.position && witness.velocity)
        expect(engine.launchFrom(witness.position, witness.velocity)).toBe(
          true,
        );
      else {
        engine.setAim(witness.angle, witness.power);
        expect(engine.launch()).toBe(true);
      }
    }
    engine.update(1 / 120);
  }
  expect(shot).toBe(level.witness.length);
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
      (engine.getSnapshot().level.physics?.planetRadius ?? 8) * 2,
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
