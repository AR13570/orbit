import { describe, expect, it, vi } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { createGravityRenderer } from "../../src/gravity/renderer";
import { createState, fireFrom, step } from "../../src/gravity/simulation";
import { createGravityPrediction } from "../../src/gravity/prediction";
import { GRAVITY_FIXED_STEP } from "../../src/gravity/physics";
import type { GravityLevel, WorldBounds } from "../../src/gravity/types";

const bounds = { x: -100, y: -100, width: 200, height: 200 };
function level(index = 0): GravityLevel {
  return {
    index,
    seed: 42,
    family: "none",
    bounds: { x: 0, y: 0, width: 900, height: 900 },
    launch: { x: 450, y: 650 },
    bodies: [],
    objective: { kind: "none", count: 0, turns: 0, hold: 0 },
    physics: { planetGravity: false, planetRadius: 6 },
    witness: [],
  };
}
function rendererFixture() {
  const canvas = document.createElement("canvas");
  const context = new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) => target[key] ?? (target[key] = vi.fn()),
  });
  vi.spyOn(canvas, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 17,
    top: 29,
  } as DOMRect);
  return createGravityRenderer(canvas);
}

describe("Gravity outermost camera lifetime", () => {
  it.each([
    ["right", { x: 107, y: 0 }],
    ["left", { x: -107, y: 0 }],
    ["bottom", { x: 0, y: 107 }],
    ["top", { x: 0, y: -107 }],
  ])(
    "removes a whole disc outside the %s edge even while bound and moving inward",
    (_edge, position) => {
      const fixture = level();
      fixture.bodies = [
        {
          id: "core",
          kind: "attractor",
          position: { x: 0, y: 0 },
          radius: 2,
          strength: 10000,
        },
      ];
      const engine = new GravityEngine(42, fixture);
      engine.setFlightBounds?.(bounds);
      engine.launchFrom(position, {
        x: -position.x / 107,
        y: -position.y / 107,
      });
      engine.update(1 / 120);
      expect(engine.getSnapshot().particles[0].alive).toBe(false);
    },
  );

  it.each([
    { x: 105.9, y: 0 },
    { x: -105.9, y: 0 },
    { x: 0, y: 105.9 },
    { x: 0, y: -105.9 },
    { x: 106, y: 0 },
    { x: -106, y: 0 },
    { x: 0, y: 106 },
    { x: 0, y: -106 },
  ])("keeps discs intersecting the outer view at $x,$y", (position) => {
    const engine = new GravityEngine(42, level());
    engine.setFlightBounds?.(bounds);
    engine.launchFrom(position, { x: 0, y: 0 });
    engine.update(1 / 120);
    expect(engine.getSnapshot().particles[0].alive).toBe(true);
  });

  it("keeps a distant bound projectile in a standalone authored simulation", () => {
    const fixture = level();
    fixture.bodies = [
      {
        id: "core",
        kind: "attractor",
        position: { x: 0, y: 0 },
        radius: 2,
        strength: 10000,
      },
    ];
    const state = createState(fixture);
    fireFrom(state, { x: 5000, y: 0 }, { x: 0, y: 0 });
    step(state, GRAVITY_FIXED_STEP);
    expect(state.particles[0].alive).toBe(true);
  });

  it("copies the outer boundary through retry, navigation, and both prediction paths", () => {
    const engine = new GravityEngine(42, undefined, (_seed, index) =>
      level(index),
    );
    const supplied = { ...bounds };
    engine.setFlightBounds?.(supplied);
    supplied.width = 9999;
    engine.retry();
    engine.skip();
    expect(engine.getSnapshot().flightBounds).toEqual(bounds);
    const before = engine.getSnapshot();
    const path = engine.predictFrom({ x: 95, y: 0 }, { x: 100, y: 0 }, 1);
    expect(path.at(-1)!.x).toBeLessThan(107);
    expect(path.at(-1)!.x).toBeGreaterThan(106);
    engine.setLaunch({ x: 95, y: 0 }, { angle: 0, power: 100 / 420 });
    const job = engine.beginPrediction(1)!;
    engine.setFlightBounds({ ...bounds, width: 9999 });
    while (!job.done) job.advance(8);
    expect(job.path).toEqual(path);
    const standalone = createGravityPrediction(
      { ...before, flightBounds: { ...bounds } },
      { x: 95, y: 0 },
      { x: 100, y: 0 },
      1,
    );
    while (!standalone.done) standalone.advance(8);
    expect(standalone.path).toEqual(path);
    expect(engine.getSnapshot().particles).toEqual(before.particles);
  });

  it.each([
    [1280, 800],
    [390, 844],
    [844, 390],
  ])(
    "uses the full %sx%s canvas at minimum zoom and ignores the current lens",
    (width, height) => {
      const renderer = rendererFixture();
      renderer.resize(width, height);
      renderer.prepareFrame?.(level());
      renderer.setZoom(0.01);
      expect(renderer.getZoom()).toBe(0.5);
      const flight: WorldBounds | undefined = renderer.getFlightBounds?.();
      expect(flight).toBeDefined();
      const topLeft = renderer.screenToWorld(17, 29);
      const bottomRight = renderer.screenToWorld(17 + width, 29 + height);
      expect(flight!.x).toBeCloseTo(topLeft.x, 8);
      expect(flight!.y).toBeCloseTo(topLeft.y, 8);
      expect(flight!.width).toBeCloseTo(bottomRight.x - topLeft.x, 8);
      expect(flight!.height).toBeCloseTo(bottomRight.y - topLeft.y, 8);
      renderer.setZoom(4);
      renderer.setWalkthroughFocus({
        position: { x: 0, y: 0 },
        radius: 10,
        area: { left: 1, top: 2, width: 100, height: 100 },
      });
      expect(renderer.getFlightBounds?.()).toEqual(flight);
      renderer.destroy();
    },
  );
});
