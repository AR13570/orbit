import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
function solve(engine: GravityEngine) {
  const level = engine.getSnapshot().level;
  let shot = 0;
  for (let n = 0; n < 120 * 85 && !engine.getSnapshot().complete; n++) {
    while (
      shot < level.witness.length &&
      level.witness[shot].time <= n / 120 + 1e-8
    ) {
      engine.setAim(level.witness[shot].angle, level.witness[shot].power);
      engine.launch();
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
    engine.advance();
    engine.advance();
    expect(engine.getSnapshot().level.index).toBe(1);
    expect(engine.getSnapshot().completedCount).toBe(1);
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
