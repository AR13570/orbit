import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { getGravityLevel } from "../../src/gravity/campaign";
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
  it("restores a roughly 2-second first orbit while keeping the enlarged cores", () => {
    const level = getGravityLevel(42, 0);
    const game = new GravityEngine(42, level);
    const shot = level.witness[0];
    game.launchFrom(shot.position!, shot.velocity!);
    let frames = 0;
    while (
      frames < 300 &&
      Math.abs(game.getRenderSnapshot().particles[0].orbits["well-1"].winding) <
        2 * Math.PI
    ) {
      game.update(1 / 60);
      frames++;
    }
    expect(frames / 60).toBeGreaterThan(1.9);
    expect(frames / 60).toBeLessThan(2.1);
    expect(game.getSnapshot().level.bodies).toEqual(level.bodies);
    expect(game.getSnapshot().level.bodies[0].radius).toBe(96);
  });
  it("retains a long frame's time and catches up over bounded fixed-step batches", () => {
    const delayed = orbitEngine();
    const regular = orbitEngine();
    delayed.setTimeScale(1);
    regular.setTimeScale(1);
    delayed.update(1);
    expect(delayed.getSnapshot().elapsed).toBeCloseTo(0.5, 10);
    for (let i = 0; i < 4; i++) delayed.update(1 / 120);
    for (let i = 0; i < 124; i++) regular.update(1 / 120);
    expect(delayed.getSnapshot().elapsed).toBe(regular.getSnapshot().elapsed);
    expect(delayed.getSnapshot().particles).toEqual(
      regular.getSnapshot().particles,
    );
  });

  it("discards pending catch-up when paused instead of jumping forward on resume", () => {
    const game = orbitEngine();
    game.setTimeScale(1);
    game.update(1);
    const beforePause = game.getSnapshot().elapsed;
    game.setPaused(true);
    game.update(60);
    game.setPaused(false);
    game.update(1 / 60);
    expect(game.getSnapshot().elapsed - beforePause).toBeCloseTo(1 / 60, 10);
  });

  it("bounds accumulated work after an extreme stall", () => {
    const game = orbitEngine();
    game.setTimeScale(1);
    game.update(1000000);
    expect(game.getSnapshot().elapsed).toBeCloseTo(0.5, 10);
    for (let i = 0; i < 4; i++) game.update(1 / 120);
    expect(game.getSnapshot().elapsed).toBeCloseTo(2 + 4 / 120, 10);
  });

  it("advances at the calibrated pace instead of the previous 1.7x over equal wall time", () => {
    const current = orbitEngine();
    const previous = orbitEngine();
    previous.setTimeScale(1.7);
    advanceFrames(current, 120);
    advanceFrames(previous, 120);
    const faster = current.getSnapshot();
    const slower = previous.getSnapshot();
    expect(slower.elapsed).toBeCloseTo(3.4, 10);
    expect(faster.elapsed).toBeCloseTo(6, 10);
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
    previous.setTimeScale(1.7);
    // 6.8 seconds at 3 and 12 seconds at 1.7 both simulate 20.4 seconds.
    advanceFrames(current, 408);
    advanceFrames(previous, 720);
    const currentState = current.getSnapshot();
    const previousState = previous.getSnapshot();
    expect(currentState.elapsed).toBeCloseTo(20.4, 10);
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
