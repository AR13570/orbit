import { afterEach, describe, expect, it, vi } from "vitest";
import { OrbitEngine } from "../../src/game/engine";

function complete(engine: OrbitEngine) {
  const { angle, power } = engine.getSnapshot().sector.solution;
  engine.setAim(angle, power);
  engine.launch();
  for (let i = 0; i < 2000 && engine.getSnapshot().status === "flying"; i++)
    engine.update(1 / 60);
  expect(engine.getSnapshot().status).toBe("docked");
}
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("Odessey checkpoint resume", () => {
  it("restores the exact current course in ready state and preserves subsequent composition", () => {
    const engine = new OrbitEngine(42, 25);
    const before = engine.getSnapshot().sector;
    engine.launch();
    engine.update(0.1);
    const saved = engine.getCheckpoint();
    expect(JSON.stringify(saved)).not.toMatch(
      /particles|trailElapsed|velocity/,
    );
    const restored = new OrbitEngine(42);
    restored.restoreCheckpoint(saved);
    expect(restored.getSnapshot()).toMatchObject({
      status: "aiming",
      checkpointCount: 24,
      particles: [],
    });
    expect(restored.getSnapshot().sector).toEqual(before);
    engine.retry();
    complete(engine);
    complete(restored);
    engine.advance();
    restored.advance();
    expect(restored.getSnapshot().sector).toEqual(engine.getSnapshot().sector);
  });
  it("resumes a freshly docked checkpoint exactly once before the visual advance", () => {
    const engine = new OrbitEngine(42);
    complete(engine);
    const saved = engine.getCheckpoint();
    expect(saved.pendingAdvance).toBe(true);
    const restored = new OrbitEngine(42);
    restored.restoreCheckpoint(saved);
    expect(restored.getSnapshot()).toMatchObject({
      status: "aiming",
      checkpointCount: 1,
      sector: { index: 1 },
    });
    engine.advance();
    expect(restored.getSnapshot().sector).toEqual(engine.getSnapshot().sector);
    restored.advance();
    expect(restored.getSnapshot().checkpointCount).toBe(1);
  });
});
