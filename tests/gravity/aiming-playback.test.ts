import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";

function engine() {
  const draft = newDraft();
  draft.bodies = [];
  const level = toGravityLevel(draft);
  const game = new GravityEngine(42, undefined, (_seed, index) => ({
    ...level,
    index,
  }));
  game.setTimeScale(1);
  game.launchFrom({ x: 200, y: 400 }, { x: 40, y: 10 });
  return game;
}
function frames(game: GravityEngine, count: number) {
  for (let i = 0; i < count; i++) game.update(1 / 60);
}

describe("temporary aiming playback", () => {
  it("slows wall playback without changing a single matched-time physical step", () => {
    const aiming = engine(),
      normal = engine();
    const before = aiming.getSnapshot().particles[0].velocity;
    aiming.setAiming(true);
    expect(aiming.getSnapshot().particles[0].velocity).toEqual(before);
    frames(aiming, 120);
    frames(normal, 78);
    expect(aiming.getSnapshot().elapsed).toBeCloseTo(1.3, 10);
    expect(aiming.getSnapshot().particles).toEqual(
      normal.getSnapshot().particles,
    );
    aiming.setAiming(false);
    frames(aiming, 60);
    expect(aiming.getSnapshot().elapsed).toBeCloseTo(2.3, 10);
  });
  it("restores the selected pace on pause, launch, retry and level navigation", () => {
    for (const reset of ["pause", "launch", "retry", "level"] as const) {
      const game = engine();
      game.setTimeScale(1.5);
      game.setAiming(true);
      if (reset === "pause") {
        game.setPaused(true);
        game.setPaused(false);
      }
      if (reset === "launch")
        game.launchFrom({ x: 100, y: 400 }, { x: 10, y: 0 });
      if (reset === "retry") game.retry();
      if (reset === "level") game.goTo(1);
      const before = game.getSnapshot().elapsed;
      frames(game, 60);
      expect(game.getSnapshot().elapsed - before).toBeCloseTo(1.5, 10);
    }
  });
});
