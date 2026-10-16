import { afterEach, describe, expect, it, vi } from "vitest";
import { OrbitEngine } from "../../src/game/engine";
import {
  loadOdesseyCheckpoint,
  rememberOdesseySeed,
  resolveOdesseySeed,
  saveOdesseyCheckpoint,
} from "../../src/game/progress";
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});
const key = "orbit.odessey.progress.v1:42";
describe("Odessey browser progress storage", () => {
  it("migrates an existing Zen checkpoint without losing its course", () => {
    const saved = JSON.parse(
      JSON.stringify(new OrbitEngine(42, 5).getCheckpoint()),
    );
    localStorage.setItem("orbit.zen.progress.v1:42", JSON.stringify(saved));
    expect(loadOdesseyCheckpoint(42)).toEqual(saved);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
  });
  it("prefers newer Odessey progress over a legacy checkpoint", () => {
    localStorage.setItem(
      "orbit.zen.progress.v1:42",
      JSON.stringify(new OrbitEngine(42, 3).getCheckpoint()),
    );
    saveOdesseyCheckpoint(new OrbitEngine(42, 6).getCheckpoint());
    expect(loadOdesseyCheckpoint(42)?.checkpointCount).toBe(5);
  });
  it("loads old progress even when migration cannot be written", () => {
    localStorage.setItem(
      "orbit.zen.progress.v1:42",
      JSON.stringify(new OrbitEngine(42, 5).getCheckpoint()),
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(loadOdesseyCheckpoint(42)?.checkpointCount).toBe(4);
  });
  it("migrates the existing default seed", () => {
    localStorage.setItem("orbit.zen.default-seed.v1", "17");
    expect(resolveOdesseySeed("")).toBe(17);
    expect(localStorage.getItem("orbit.odessey.default-seed.v1")).toBe("17");
  });
  it("keeps courses independent per seed and returns detached saved data", () => {
    const engine = new OrbitEngine(42, 5),
      saved = engine.getCheckpoint();
    saveOdesseyCheckpoint(saved);
    saved.sector.bodies.length = 0;
    expect(loadOdesseyCheckpoint(42)?.checkpointCount).toBe(4);
    expect(loadOdesseyCheckpoint(7)).toBeNull();
    expect(engine.getSnapshot().sector.bodies.length).toBeGreaterThan(0);
  });
  it.each(["broken", "null", "{}", '{"version":2}', "x".repeat(1_000_001)])(
    "ignores malformed or unsupported storage (%#)",
    (raw) => {
      localStorage.setItem(key, raw);
      expect(loadOdesseyCheckpoint(42)).toBeNull();
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
      expect(loadOdesseyCheckpoint(42)).toBeNull();
    }
  });
  it("restores large saved indices directly without replaying the preceding journey", () => {
    const saved = new OrbitEngine(42).getCheckpoint();
    saved.sector.index = 1_000_000_000;
    saved.checkpointCount = 1_000_000_000;
    saveOdesseyCheckpoint(saved);
    const engine = new OrbitEngine(42);
    engine.restoreCheckpoint(loadOdesseyCheckpoint(42)!);
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
    expect(loadOdesseyCheckpoint(42)).toBeNull();
    expect(() => saveOdesseyCheckpoint(checkpoint)).not.toThrow();
    expect(resolveOdesseySeed("")).toBe(resolveOdesseySeed(""));
  });
  it("keeps a stable default universe and explicit seeds leave its pointer alone", () => {
    const seed = resolveOdesseySeed("");
    expect(resolveOdesseySeed("")).toBe(seed);
    expect(resolveOdesseySeed("?seed=42")).toBe(42);
    expect(resolveOdesseySeed("")).toBe(seed);
    rememberOdesseySeed(7);
    expect(resolveOdesseySeed("")).toBe(7);
  });
});
