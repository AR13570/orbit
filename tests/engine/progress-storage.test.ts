import { afterEach, describe, expect, it, vi } from "vitest";
import { OrbitEngine } from "../../src/game/engine";
import {
  loadZenCheckpoint,
  rememberZenSeed,
  resolveZenSeed,
  saveZenCheckpoint,
} from "../../src/game/progress";
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
const key = "orbit.zen.progress.v1:42";
describe("Zen browser progress storage", () => {
  it("keeps courses independent per seed and returns detached saved data", () => {
    const engine = new OrbitEngine(42, 5),
      saved = engine.getCheckpoint();
    saveZenCheckpoint(saved);
    saved.sector.bodies.length = 0;
    expect(loadZenCheckpoint(42)?.checkpointCount).toBe(4);
    expect(loadZenCheckpoint(7)).toBeNull();
    expect(engine.getSnapshot().sector.bodies.length).toBeGreaterThan(0);
  });
  it.each(["broken", "null", "{}", '{"version":2}', "x".repeat(1_000_001)])(
    "ignores malformed or unsupported storage (%#)",
    (raw) => {
      localStorage.setItem(key, raw);
      expect(loadZenCheckpoint(42)).toBeNull();
    },
  );
  it("rejects inconsistent, oversized, and nonfinite static fields", () => {
    const saved = new OrbitEngine(42).getCheckpoint();
    for (const mutate of [
      (p: typeof saved) => {
        p.seed = 7;
      },
      (p: typeof saved) => {
        p.checkpointCount = 2;
      },
      (p: typeof saved) => {
        p.sector.bodies[0].position.x = Infinity;
      },
      (p: typeof saved) => {
        p.recentLayouts = Array(7).fill(p.recentLayouts[0]);
      },
      (p: typeof saved) => {
        p.sector.solution.path = Array(4097).fill({ x: 1, y: 2 });
      },
      (p: typeof saved) => {
        p.sector.index = Number.MAX_SAFE_INTEGER;
        p.checkpointCount = p.sector.index;
      },
    ]) {
      const bad = structuredClone(saved);
      mutate(bad);
      localStorage.setItem(key, JSON.stringify(bad));
      expect(loadZenCheckpoint(42)).toBeNull();
    }
  });
  it("restores large saved indices directly without replaying the preceding journey", () => {
    const saved = new OrbitEngine(42).getCheckpoint();
    saved.sector.index = 1_000_000_000;
    saved.checkpointCount = 1_000_000_000;
    saveZenCheckpoint(saved);
    const engine = new OrbitEngine(42);
    engine.restoreCheckpoint(loadZenCheckpoint(42)!);
    expect(engine.getSnapshot()).toMatchObject({
      status: "aiming",
      checkpointCount: 1_000_000_000,
    });
    engine.launch();
    engine.update(0.05);
    expect(engine.getSnapshot().status).toBe("flying");
  });
  it("tolerates storage access failures", () => {
    const checkpoint = new OrbitEngine(42).getCheckpoint();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    expect(loadZenCheckpoint(42)).toBeNull();
    expect(() => saveZenCheckpoint(checkpoint)).not.toThrow();
    expect(resolveZenSeed("")).toBe(resolveZenSeed(""));
  });
  it("keeps a stable default universe and explicit seeds leave its pointer alone", () => {
    const seed = resolveZenSeed("");
    expect(resolveZenSeed("")).toBe(seed);
    expect(resolveZenSeed("?seed=42")).toBe(42);
    expect(resolveZenSeed("")).toBe(seed);
    rememberZenSeed(7);
    expect(resolveZenSeed("")).toBe(7);
  });
});
