import { describe, expect, it, vi } from "vitest";
import { generateSector } from "../../src/game/generator";
import { createRenderer } from "../../src/render/renderer";
import { sampleGravityWave } from "../../src/render/gravity-surface";
import type { GameSnapshot } from "../../src/game/types";
import { clientToWorld, worldToClient } from "../../src/render/coordinates";

function snapshot(index = 0): GameSnapshot {
  const x = 3400 + index * 1500;
  return {
    status: "aiming",
    sector: {
      index,
      seed: 42,
      bounds: { x, y: 0, width: 1800, height: 1000 },
      width: 1800,
      height: 1000,
      generation: { family: "slalom", fallback: false },
      launch: { x: x + 120, y: 500 },
      checkpoint: { position: { x: x + 1500, y: 500 }, radius: 45 },
      bodies: [],
      solution: {
        angle: 0,
        power: 0.5,
        speed: 240,
        flightSeconds: 6,
        path: [],
      },
    },
    aim: { angle: 0, power: 0.5 },
    shotCount: 1,
    canBranch: false,
    particles: [],
    checkpointCount: index,
    message: "",
    elapsed: 0,
    event: null,
  };
}
function fixture() {
  const canvas = document.createElement("canvas");
  const context = new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      return target[key] ?? (target[key] = vi.fn());
    },
  });
  vi.spyOn(canvas, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 17,
    top: 29,
    width: 1440,
    height: 900,
    right: 1457,
    bottom: 929,
    x: 17,
    y: 29,
    toJSON: () => ({}),
  });
  context.createLinearGradient = vi.fn(() => ({ addColorStop: vi.fn() }));
  const renderer = createRenderer(canvas);
  renderer.resize(1440, 900, 3);
  return { renderer, canvas, context };
}
interface SurfacePoint {
  x: number;
  y: number;
  width: number;
  height: number;
  alpha: number;
  color: unknown;
}
function surfaceFixture(
  kind: "attractor" | "repellent" | "goal" = "attractor",
  width = 1440,
  height = 900,
  radius = 60,
) {
  const { renderer, context } = fixture();
  renderer.resize(width, height);
  const board = snapshot();
  const center =
    kind === "goal" ? board.sector.checkpoint.position : { x: 3800, y: 300 };
  if (kind !== "goal")
    board.sector = {
      ...board.sector,
      bodies: [{ id: "surface", kind, position: center, radius, strength: 1 }],
    };
  const points: SurfacePoint[] = [];
  (context.rect as ReturnType<typeof vi.fn>).mockImplementation(
    (x, y, width, height) => {
      if (width < 10 && Math.hypot(x - center.x, y - center.y) < radius + 280)
        points.push({
          x,
          y,
          width,
          height,
          alpha: Number(context.globalAlpha),
          color: context.fillStyle,
        });
    },
  );
  function frame(time: number, options = {}) {
    points.length = 0;
    renderer.render(board, [], time, options);
    return points.map((point) => ({ ...point }));
  }
  return { renderer, context, board, center, frame };
}
describe("sampled gravity surface", () => {
  it.each([30, 125])(
    "keeps morphing crests bounded while their radii vary by angle for radius %i",
    (radius) => {
      const { frame, center } = surfaceFixture("attractor", 1440, 900, radius);
      const points = frame(1.05).map((p) => ({
        x: p.x + p.width / 2 - center.x,
        y: p.y + p.height / 2 - center.y,
      }));
      const axes = [
        points.filter((p) => Math.abs(p.y) < 0.001 && p.x > 0).map((p) => p.x),
        points.filter((p) => Math.abs(p.y) < 0.001 && p.x < 0).map((p) => -p.x),
        points.filter((p) => Math.abs(p.x) < 0.001 && p.y > 0).map((p) => p.y),
        points.filter((p) => Math.abs(p.x) < 0.001 && p.y < 0).map((p) => -p.y),
      ].map((axis) => axis.sort((a, b) => a - b));
      expect(axes[0].length).toBeGreaterThan(10);
      for (const axis of axes.slice(1)) {
        expect(axis).toHaveLength(axes[0].length);
        const deviations = axis.map((value, i) => Math.abs(value - axes[0][i]));
        expect(Math.max(...deviations)).toBeLessThan(12);
      }
      expect(
        axes
          .slice(1)
          .some((axis) =>
            axis.some((value, i) => Math.abs(value - axes[0][i]) > 0.01),
          ),
      ).toBe(true);
      for (const axis of axes) {
        expect(
          axis.every((value) => value > radius && value < radius + 230),
        ).toBe(true);
      }
    },
  );
  it.each(["attractor", "repellent", "goal"] as const)(
    "centers the complete %s surface on its physical object",
    (kind) => {
      const { frame, center } = surfaceFixture(kind);
      const points = frame(1);
      expect(
        points.reduce((sum, p) => sum + p.x + p.width / 2, 0) / points.length,
      ).toBeCloseTo(center.x, 3);
      expect(
        points.reduce((sum, p) => sum + p.y + p.height / 2, 0) / points.length,
      ).toBeCloseTo(center.y, 3);
    },
  );
  it("samples the gravity surface across aligned rows instead of stroked wave outlines", () => {
    const { frame } = surfaceFixture();
    const points = frame(1);
    expect(points.length).toBeGreaterThan(500);
    expect(new Set(points.map((p) => Math.round(p.x))).size).toBeGreaterThan(
      20,
    );
    expect(new Set(points.map((p) => Math.round(p.y))).size).toBeGreaterThan(
      20,
    );
    // Samples occupy valleys as well as crests throughout the annular patch.
    const bands = new Set(
      points.map((p) => Math.floor(Math.hypot(p.x - 3800, p.y - 300) / 5)),
    );
    expect(bands.size).toBeGreaterThan(24);
    expect(new Set(points.map((p) => p.width.toFixed(2))).size).toBeGreaterThan(
      20,
    );
  });
  it.each([
    [1440, 900, 5329],
    [390, 844, 2401],
  ])(
    "bounds the local point budget and projected footprint at %ix%i",
    (width, height, budget) => {
      const { renderer, context, center, frame } = surfaceFixture(
        "attractor",
        width,
        height,
      );
      for (let tick = 0; tick <= 36; tick++) {
        const points = frame(1 + tick * 0.05);
        // The fitted view changes the projected sample count; keep the budget invariant and avoid a vacuous empty frame.
        expect(points.length).toBeGreaterThan(0);
        expect(points.length).toBeLessThanOrEqual(budget);
        for (const p of points) {
          expect(
            Math.hypot(p.x - center.x, p.y - center.y) + p.width,
          ).toBeLessThan(315);
          expect(p.width * renderer.getViewport().scale).toBeLessThanOrEqual(
            2.9,
          );
          expect(p.alpha).toBeGreaterThan(0);
          expect(p.alpha).toBeLessThan(0.8);
        }
      }
      expect(context.createLinearGradient).not.toHaveBeenCalled();
      expect(context.createRadialGradient).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    "softens the sampled surface with radial distance, reduced motion %s",
    (reducedMotion) => {
      const { frame } = surfaceFixture();
      const points = frame(1, { reducedMotion });
      const near = points.filter(
        (p) => Math.hypot(p.x - 3800, p.y - 300) < 115,
      );
      const far = points.filter((p) => Math.hypot(p.x - 3800, p.y - 300) > 170);
      const mean = (ps: SurfacePoint[]) =>
        ps.reduce((sum, p) => sum + p.alpha, 0) / ps.length;
      expect(mean(far)).toBeLessThan(mean(near) * 0.45);
    },
  );
  it.each(["attractor", "repellent"] as const)(
    "moves %s crests in its local force direction",
    (kind) => {
      const sample = { crest: 0, slope: 0 };
      function peak(time: number) {
        let bestDistance = 0,
          bestHeight = -1;
        for (let distance = 20; distance < 80; distance += 0.1) {
          sampleGravityWave(distance, 60, time, kind === "repellent", sample);
          if (sample.crest > bestHeight) {
            bestHeight = sample.crest;
            bestDistance = distance;
          }
        }
        return bestDistance;
      }
      const initial = peak(0),
        next = peak(0.3);
      if (kind === "attractor") expect(next).toBeLessThan(initial - 4);
      else expect(next).toBeGreaterThan(initial + 4);
    },
  );
  it("uses tighter circular wave spacing for smaller objects", () => {
    const sample = { crest: 0, slope: 0 };
    const gaps = [25, 60, 130].map((radius) => {
      const peaks: number[] = [];
      let previousSlope = 0;
      for (let distance = 1; distance < 220; distance += 0.1) {
        sampleGravityWave(distance, radius, 0, false, sample);
        if (previousSlope > 0 && sample.slope <= 0) peaks.push(distance);
        previousSlope = sample.slope;
      }
      return peaks[1] - peaks[0];
    });
    expect(gaps[0]).toBeLessThan(gaps[1]);
    expect(gaps[1]).toBeLessThan(gaps[2]);
    expect(gaps[0]).toBeLessThan(50);
    expect(gaps[2]).toBeGreaterThan(70);
  });
  it("freezes during pause and resumes without suspended time or double-counted preparation", () => {
    const { renderer, board, frame } = surfaceFixture();
    frame(1);
    const active = frame(1.05);
    expect(frame(2, { paused: true })).toEqual(active);
    expect(frame(200, { paused: true })).toEqual(active);
    expect(frame(201)).toEqual(active);
    renderer.prepareFrame(board, 201.05);
    const resumed = frame(201.05);
    expect(resumed).not.toEqual(active);
    expect(frame(201.05)).toEqual(resumed);
    expect(frame(500)).toEqual(resumed);
    expect(frame(500.05)).not.toEqual(resumed);
  });
  it("keeps reduced-motion relief static across active and paused frames", () => {
    const { frame } = surfaceFixture();
    const first = frame(1, { reducedMotion: true });
    expect(first.length).toBeGreaterThan(500);
    expect(frame(1.05, { reducedMotion: true })).toEqual(first);
    expect(frame(200, { reducedMotion: true, paused: true })).toEqual(first);
    expect(frame(201, { reducedMotion: true })).toEqual(first);
  });
  it("keeps the morphing field occupancy stable through a complete wave cycle", () => {
    const { frame, center } = surfaceFixture("repellent");
    const initial = frame(1);
    // Paint order follows changing shade buckets; compare field geometry, not array order.
    const geometry = (points: SurfacePoint[]) =>
      points.reduce(
        (total, p) => {
          const x = p.x + p.width / 2 - center.x;
          const y = p.y + p.width * 0.36 - center.y;
          return {
            x: total.x + x / points.length,
            y: total.y + y / points.length,
            radius: total.radius + Math.hypot(x, y) / points.length,
          };
        },
        { x: 0, y: 0, radius: 0 },
      );
    let previous = geometry(initial);
    for (let tick = 1; tick <= 54; tick++) {
      const points = frame(1 + tick * 0.05);
      expect(points).toHaveLength(initial.length);
      const current = geometry(points);
      expect(
        Math.hypot(current.x - previous.x, current.y - previous.y),
      ).toBeLessThan(1);
      expect(Math.abs(current.radius - previous.radius)).toBeLessThan(1);
      previous = current;
    }
  });
});
describe("checkpoint sampled surface", () => {
  it("animates a blue surface beneath an unchanged goal identity", () => {
    const { renderer, context, board, frame } = surfaceFixture("goal");
    const first = frame(1);
    const arcs = context.arc as ReturnType<typeof vi.fn>;
    const identity = arcs.mock.calls.filter(
      ([x, y]) =>
        x === board.sector.checkpoint.position.x &&
        y === board.sector.checkpoint.position.y,
    );
    arcs.mockClear();
    const next = frame(1.05);
    expect(next).not.toEqual(first);
    expect(first.some((p) => p.color === "#168dff" && p.alpha > 0.1)).toBe(
      true,
    );
    expect(
      arcs.mock.calls.filter(
        ([x, y]) =>
          x === board.sector.checkpoint.position.x &&
          y === board.sector.checkpoint.position.y,
      ),
    ).toEqual(identity);
    expect(renderer.getViewport().scale).toBeGreaterThan(0);
  });
  it("freezes goal relief during pause, suspended gaps and reduced motion", () => {
    const { frame } = surfaceFixture("goal");
    frame(1);
    const active = frame(1.05);
    expect(frame(2, { paused: true })).toEqual(active);
    expect(frame(200, { paused: true })).toEqual(active);
    expect(frame(201)).toEqual(active);
    expect(frame(201.05)).not.toEqual(active);
    const reduced = frame(202, { reducedMotion: true });
    expect(frame(203, { reducedMotion: true })).toEqual(reduced);
    expect(frame(300, { reducedMotion: true, paused: true })).toEqual(reduced);
  });
});
describe("displayed camera contract", () => {
  it("highlights only the idle launcher with a defined yellow ring and keeps reduced motion static", () => {
    const { renderer, context } = fixture();
    const board = snapshot();
    const rings: { color: unknown; alpha: number; width: number }[] = [];
    let atLauncher = false;
    (context.arc as ReturnType<typeof vi.fn>).mockImplementation(
      (x, y, radius) => {
        atLauncher =
          x === board.sector.launch.x &&
          y === board.sector.launch.y &&
          Math.abs(radius * renderer.getViewport().scale - 22) < 0.001;
      },
    );
    (context.stroke as ReturnType<typeof vi.fn>).mockImplementation(() => {
      if (atLauncher)
        rings.push({
          color: context.strokeStyle,
          alpha: Number(context.globalAlpha),
          width: Number(context.lineWidth) * renderer.getViewport().scale,
        });
    });
    renderer.render(board, [], 1, { reducedMotion: true });
    const idle = rings[0];
    expect(idle.color).toBe("#c3a446");
    expect(idle.alpha).toBeGreaterThanOrEqual(0.6);
    expect(idle.alpha).toBeLessThan(0.8);
    expect(idle.width).toBeCloseTo(1.2);
    rings.length = 0;
    renderer.render(board, [], 5, { reducedMotion: true });
    expect(rings[0]).toEqual(idle);
    rings.length = 0;
    renderer.render(board, [], 5.05, {
      slingshot: {
        anchor: board.sector.launch,
        pull: { x: board.sector.launch.x - 80, y: 500 },
        power: 0.5,
      },
    });
    expect(rings[0].color).not.toBe(idle.color);
    expect(rings[0].width).toBeLessThan(idle.width);
    rings.length = 0;
    renderer.render({ ...board, status: "flying" }, [], 5.1);
    expect(rings[0].color).not.toBe(idle.color);
  });
  it.each([
    [320, 568],
    [390, 844],
    [1440, 900],
  ])(
    "keeps the complete long-span checkpoint visible after settling at %ix%i",
    (width, height) => {
      const { renderer, canvas } = fixture();
      vi.mocked(canvas.getBoundingClientRect).mockReturnValue({
        left: 17,
        top: 29,
        width,
        height,
        right: 17 + width,
        bottom: 29 + height,
        x: 17,
        y: 29,
        toJSON: () => ({}),
      });
      renderer.resize(width, height);
      renderer.render(snapshot(), [], 0);
      const board = snapshot(1);
      board.sector = {
        ...board.sector,
        bounds: { x: 8420, y: 50, width: 1250, height: 900 },
        width: 1250,
        height: 900,
        launch: { x: 8520, y: 500 },
        checkpoint: { position: { x: 9340, y: 700 }, radius: 45 },
      };
      for (let frame = 1; frame <= 20; frame++)
        renderer.render(board, [], frame * 0.05);
      expect(renderer.getViewport().transitioning).toBe(false);
      const launch = renderer.worldToScreen(board.sector.launch);
      const goal = renderer.worldToScreen(board.sector.checkpoint.position);
      const radius = 45 * renderer.getViewport().scale + 1.4;
      expect(launch.x - 22).toBeGreaterThanOrEqual(25);
      expect(goal.x + radius).toBeLessThanOrEqual(17 + width - 18);
      const aiming = renderer.getViewport();
      renderer.render(board, [], 1.05, { cameraLocked: true });
      expect(renderer.getViewport()).toEqual(aiming);
      renderer.render(
        {
          ...board,
          status: "flying",
          particles: [
            {
              id: 1,
              alive: true,
              position: { x: 8560, y: 500 },
              velocity: { x: 240, y: 0 },
              trail: [],
            },
          ],
        },
        [],
        1.1,
      );
      expect(renderer.getViewport().scale).toBe(aiming.scale);
    },
  );
  it.each([1440, 390])(
    "separates aim dots from wave crests while preserving physical occlusion at %ipx",
    (width) => {
      const { renderer, context } = fixture();
      renderer.resize(width, width === 390 ? 844 : 900);
      const board = snapshot();
      board.sector = {
        ...board.sector,
        bodies: [
          {
            id: "overlap",
            kind: "attractor",
            position: { x: 3800, y: 300 },
            radius: 60,
            strength: 1,
          },
        ],
      };
      const path = Array.from({ length: 49 }, (_, n) => ({
        x: 3670 + n * 5,
        y: 300,
      }));
      let shape: "surface" | number[] | null = null;
      const paint: Array<{
        kind: string;
        shape: "surface" | number[] | null;
        color: unknown;
        alpha: number;
        width: number;
      }> = [];
      (context.beginPath as ReturnType<typeof vi.fn>).mockImplementation(() => {
        shape = null;
      });
      (context.rect as ReturnType<typeof vi.fn>).mockImplementation(() => {
        shape = "surface";
      });
      (context.arc as ReturnType<typeof vi.fn>).mockImplementation(
        (...args: number[]) => {
          shape = args;
        },
      );
      for (const kind of ["fill", "stroke"])
        (context[kind] as ReturnType<typeof vi.fn>).mockImplementation(() => {
          paint.push({
            kind,
            shape,
            color: context[kind === "fill" ? "fillStyle" : "strokeStyle"],
            alpha: Number(context.globalAlpha),
            width: Number(context.lineWidth),
          });
        });
      renderer.render(board, [path], 1, {
        slingshot: {
          anchor: board.sector.launch,
          pull: { x: board.sector.launch.x - 80, y: 500 },
          power: 0.5,
        },
      });
      const atDot = (entry: (typeof paint)[number]) =>
        Array.isArray(entry.shape) &&
        entry.shape[0] === path[3].x &&
        entry.shape[1] === path[3].y;
      const core = paint.findIndex(
        (entry) => entry.kind === "fill" && atDot(entry),
      );
      const halo = paint.findIndex(
        (entry) => entry.kind === "stroke" && atDot(entry),
      );
      expect(halo).toBeGreaterThanOrEqual(0);
      expect(core).toBe(halo + 1);
      expect(paint[halo].color).not.toBe(paint[core].color);
      expect(
        paint[halo].width * renderer.getViewport().scale,
      ).toBeGreaterThanOrEqual(1);
      expect(
        paint[halo].width * renderer.getViewport().scale,
      ).toBeLessThanOrEqual(2);
      expect(paint[halo].alpha).toBe(paint[core].alpha);
      const dotShape = paint[core].shape as number[];
      expect(dotShape[2] * renderer.getViewport().scale).toBeGreaterThanOrEqual(
        2,
      );
      expect(dotShape[2] * renderer.getViewport().scale).toBeLessThanOrEqual(
        2.5,
      );
      const lastSurface = paint
        .map((entry) => entry.shape)
        .lastIndexOf("surface");
      const solid = paint.findIndex(
        (entry) =>
          entry.kind === "fill" &&
          Array.isArray(entry.shape) &&
          entry.shape[0] === 3800 &&
          entry.shape[1] === 300 &&
          entry.shape[2] === 60,
      );
      expect(halo).toBeGreaterThan(lastSurface);
      expect(core).toBeLessThan(solid);
    },
  );
  it.each([320, 390])(
    "keeps one projectile glyph in both modes and shows split-mode dots on %ipx phones",
    (width) => {
      const { renderer, context } = fixture();
      renderer.resize(width, 844);
      const board = snapshot();
      renderer.render(board, [], 1);
      const glyphs = context.closePath as ReturnType<typeof vi.fn>;
      expect(glyphs.mock.calls).toHaveLength(1);
      const arcs = context.arc as ReturnType<typeof vi.fn>;
      const singleDotCount = arcs.mock.calls.filter(
        ([, , radius]) =>
          Math.abs(radius * renderer.getViewport().scale - 1.25) < 0.001,
      ).length;
      glyphs.mockClear();
      arcs.mockClear();
      board.shotCount = 3;
      renderer.render(board, [], 1.05);
      expect(glyphs.mock.calls).toHaveLength(1);
      expect(
        arcs.mock.calls.filter(
          ([, , radius]) =>
            Math.abs(radius * renderer.getViewport().scale - 1.25) < 0.001,
        ).length,
      ).toBeGreaterThan(singleDotCount);
      glyphs.mockClear();
      const scale = renderer.getViewport().scale;
      renderer.render(board, [], 1.1, {
        slingshot: {
          anchor: board.sector.launch,
          pull: {
            x: board.sector.launch.x - 120 / scale,
            y: board.sector.launch.y,
          },
          power: 1,
        },
      });
      expect(glyphs.mock.calls).toHaveLength(1);
    },
  );
  it.each([1, 3] as const)(
    "shows only the initial curved trajectory in mode %i",
    (shotCount) => {
      const { renderer, context } = fixture();
      const board = snapshot();
      board.shotCount = shotCount;
      const paths = Array.from({ length: 3 }, (_, side) =>
        Array.from({ length: 49 }, (_, n) => ({
          x: 3600 + n * 5,
          y: 300 + side * 90 + n * n * 0.05,
        })),
      );
      const samples: Array<{
        x: number;
        y: number;
        alpha: number;
        color: unknown;
      }> = [];
      (context.arc as ReturnType<typeof vi.fn>).mockImplementation(
        (x: number, y: number) =>
          samples.push({
            x,
            y,
            alpha: context.globalAlpha as number,
            color: context.fillStyle,
          }),
      );
      renderer.render(board, paths, 1, {
        slingshot: {
          anchor: board.sector.launch,
          pull: { x: board.sector.launch.x - 80, y: 500 },
          power: 0.5,
        },
      });
      const path = paths[0];
      const first = samples.find(
        (sample) => sample.x === path[3].x && sample.y === path[3].y,
      )!;
      const end = samples.find(
        (sample) => sample.x === path[48].x && sample.y === path[48].y,
      )!;
      expect(first.alpha).toBeGreaterThan(0.8);
      expect(end.alpha).toBeLessThan(first.alpha * 0.02);
      for (const sidePath of paths.slice(1))
        expect(
          samples.some(
            (sample) =>
              sample.x === sidePath[3].x && sample.y === sidePath[3].y,
          ),
        ).toBe(false);
    },
  );
  it("renders actual flight pieces, one before branching and three afterward", () => {
    const { renderer, context } = fixture();
    const board = snapshot();
    board.status = "flying";
    board.shotCount = 3;
    board.particles = [
      {
        id: 1,
        position: { x: 3800, y: 500 },
        velocity: { x: 240, y: 0 },
        alive: true,
        trail: [],
      },
    ];
    renderer.render(board, [], 1);
    const glyphs = context.closePath as ReturnType<typeof vi.fn>;
    expect(glyphs.mock.calls).toHaveLength(1);
    glyphs.mockClear();
    board.particles = [0, -1, 1].map((side, index) => ({
      ...board.particles[0],
      id: index + 1,
      position: { x: 3900, y: 500 + side * 10 },
      velocity: { x: 240, y: side * 13 },
    }));
    renderer.render(board, [], 1.05);
    expect(glyphs.mock.calls).toHaveLength(3);
  });
  it("uses the engine checkpoint radius directly for the contact ring", () => {
    const { renderer, context } = fixture();
    const board = snapshot();
    board.sector = {
      ...board.sector,
      checkpoint: { ...board.sector.checkpoint, radius: 61 },
    };
    renderer.render(board, [], 1);
    expect(
      (context.arc as ReturnType<typeof vi.fn>).mock.calls.some(
        ([x, y, r]) =>
          x === board.sector.checkpoint.position.x &&
          y === board.sector.checkpoint.position.y &&
          r === 61,
      ),
    ).toBe(true);
  });
  it("draws one refined capture outline with a flag and no decorative inner rings", () => {
    const { renderer, context } = fixture();
    const board = snapshot();
    const center = board.sector.checkpoint.position;
    const rings: Array<{
      radius: number;
      start: number;
      end: number;
      color: unknown;
      width: number;
    }> = [];
    const surfaces: Array<{ radius: number; color: unknown; alpha: unknown }> =
      [];
    let current: {
      x: number;
      y: number;
      radius: number;
      start: number;
      end: number;
    };
    (context.arc as ReturnType<typeof vi.fn>).mockImplementation(
      (x, y, radius, start, end) => {
        current = { x, y, radius, start, end };
      },
    );
    (context.stroke as ReturnType<typeof vi.fn>).mockImplementation(() => {
      if (current?.x === center.x && current.y === center.y)
        rings.push({
          radius: current.radius,
          start: current.start,
          end: current.end,
          color: context.strokeStyle,
          width: Number(context.lineWidth),
        });
    });
    (context.fill as ReturnType<typeof vi.fn>).mockImplementation(() => {
      if (current?.x === center.x && current.y === center.y)
        surfaces.push({
          radius: current.radius,
          color: context.fillStyle,
          alpha: context.globalAlpha,
        });
    });
    renderer.render(board, [], 1, { reducedMotion: true });
    const contact = rings.find((ring) => ring.radius === 45)!;
    expect(contact.color).toBe("#168dff");
    expect(contact.width * renderer.getViewport().scale).toBeCloseTo(1.6);
    expect(rings.filter((ring) => ring.radius > 45)).toHaveLength(0);
    expect(
      rings.every((ring) => ring.start === 0 && ring.end === Math.PI * 2),
    ).toBe(true);
    expect(surfaces).toContainEqual({ radius: 45, color: "#e9ecef", alpha: 1 });
    expect([
      ...new Set(
        rings.filter((ring) => ring.radius < 45).map((ring) => ring.radius),
      ),
    ]).toEqual([]);
    expect(
      surfaces.some(
        (surface) => surface.radius < 45 && Number(surface.alpha) < 0.2,
      ),
    ).toBe(false);
    const moves = (context.moveTo as ReturnType<typeof vi.fn>).mock.calls;
    expect(
      moves.some(
        ([x, y]) =>
          Math.abs(x - center.x) > 18 &&
          Math.abs(x - center.x) < 30 &&
          Math.abs(y - center.y) < 9,
      ),
    ).toBe(false);
    const segments = (context.lineTo as ReturnType<typeof vi.fn>).mock.calls;
    const centerSegments = segments.filter(
      ([x, y]) => Math.abs(x - center.x) < 15 && Math.abs(y - center.y) < 15,
    );
    expect(centerSegments.length).toBeGreaterThanOrEqual(4);
    expect(surfaces.some((surface) => surface.color === "#303943")).toBe(false);
  });
  it("uses blue for offscreen checkpoint guidance and successful capture feedback", () => {
    const { renderer, context } = fixture();
    const board = snapshot();
    renderer.resize(320, 568);
    renderer.render(
      {
        ...board,
        sector: {
          ...board.sector,
          checkpoint: {
            position: { x: 3800, y: 500 },
            radius: 45,
          },
        },
      },
      [],
      0.95,
    );
    board.status = "flying";
    const edgeColors: unknown[] = [];
    const effectColors: unknown[] = [];
    (context.arc as ReturnType<typeof vi.fn>).mockImplementation(
      (x, y, radius) => {
        if (radius === 6) edgeColors.push(context.strokeStyle);
        if (radius < 5) effectColors.push(context.fillStyle);
      },
    );
    renderer.render(board, [], 1);
    expect(edgeColors).toContain("#168dff");
    effectColors.length = 0;
    board.status = "docked";
    board.event = { id: 1, kind: "dock" };
    renderer.render(board, [], 1.05);
    expect(
      effectColors.filter((color) => color === "#168dff").length,
    ).toBeGreaterThanOrEqual(14);
  });
  it.each([
    ["inside", false, "fully visible"],
    ["partial-right", false, "partly visible beyond the right edge"],
    ["partial-left", false, "partly visible beyond the left edge"],
    ["outside-right", true, "fully outside the right edge"],
    ["outside-left", true, "fully outside the left edge"],
  ] as const)(
    "does not cover a rendered phone goal during flight: %s, cue=%s (%s)",
    (placement, expectedCue, _description) => {
      const { renderer, context } = fixture();
      const board = snapshot();
      renderer.resize(320, 568);
      renderer.render(
        {
          ...board,
          sector: {
            ...board.sector,
            checkpoint: {
              position: { x: 3800, y: 500 },
              radius: 45,
            },
          },
        },
        [],
        0.95,
      );
      board.status = "flying";
      board.sector = {
        ...board.sector,
        checkpoint: { radius: 45, position: { x: 0, y: 409.4375 } },
      };
      const camera = renderer.getViewport();
      const radius = 45 * camera.scale + 1.4;
      const screenX =
        placement === "inside"
          ? 280
          : placement === "partial-right"
            ? 320 + radius / 2
            : placement === "partial-left"
              ? -radius / 2
              : placement === "outside-right"
                ? 320 + radius + 8
                : -radius - 8;
      board.sector = {
        ...board.sector,
        checkpoint: {
          radius: 45,
          position: clientToWorld(
            screenX,
            568 / 2,
            { left: 0, top: 0, width: 320, height: 568 },
            camera,
          ),
        },
      };
      (context.arc as ReturnType<typeof vi.fn>).mockClear();
      renderer.render(board, [], 1);
      const arcs = context.arc as ReturnType<typeof vi.fn>;
      const hasCueBacking = arcs.mock.calls.some(
        ([cx, , radius]) => radius === 10 && (cx === 20 || cx === 300),
      );
      expect(hasCueBacking).toBe(expectedCue);
    },
  );
  it.each([false, true])(
    "prepares authoritative viewport edges before physics without advancing again during render, reduced=%s",
    (reducedMotion) => {
      const { renderer, canvas } = fixture();
      vi.mocked(canvas.getBoundingClientRect).mockReturnValue({
        left: 17,
        top: 29,
        width: 390,
        height: 844,
        right: 407,
        bottom: 873,
        x: 17,
        y: 29,
        toJSON: () => ({}),
      });
      renderer.resize(390, 844);
      renderer.render(snapshot(), [], 1);
      const flying = {
        ...snapshot(),
        status: "flying" as const,
        particles: [
          {
            id: 1,
            position: { x: 4500, y: 500 },
            velocity: { x: 240, y: 0 },
            alive: true,
            trail: [],
          },
        ],
      };
      renderer.prepareFrame(flying, 1.05, { reducedMotion });
      const prepared = renderer.getViewport();
      const updated = {
        ...flying,
        particles: [{ ...flying.particles[0], position: { x: 4512, y: 500 } }],
      };
      renderer.render(updated, [], 1.05, { reducedMotion });
      expect(renderer.getViewport()).toEqual(prepared);
      expect(renderer.getVisibleBounds()).toEqual(prepared.bounds);
      const topLeft = renderer.screenToWorld(17, 29);
      expect(topLeft.x).toBeCloseTo(
        prepared.bounds.x + prepared.bounds.width,
        9,
      );
      expect(topLeft.y).toBeCloseTo(prepared.bounds.y, 9);
    },
  );
  it("locks transitions while pulling and projects from the displayed camera", () => {
    const { renderer } = fixture();
    renderer.render(snapshot(), [], 1);
    const start = renderer.getViewport();
    const next = snapshot(1);
    renderer.render(next, [], 1.05, {
      slingshot: {
        anchor: next.sector.launch,
        pull: { x: next.sector.launch.x - 20, y: 500 },
        power: 0.5,
      },
    });
    expect(renderer.getViewport().center).toEqual(start.center);
    expect(renderer.getViewport().transitioning).toBe(true);
    renderer.render(next, [], 1.1, { cameraLocked: true });
    expect(renderer.getViewport().center).toEqual(start.center);
    renderer.render(next, [], 1.15);
    const displayed = renderer.getViewport();
    expect(displayed.center.x).toBeGreaterThan(start.center.x);
    expect(displayed.center.x).toBeLessThan(next.sector.bounds.x + 900);
    const client = renderer.worldToScreen({ x: 4800, y: 237 });
    const world = renderer.screenToWorld(client.x, client.y);
    expect(world.x).toBeCloseTo(4800, 9);
    expect(world.y).toBeCloseTo(237, 9);
  });
  it("pauses camera motion and snaps for reduced motion and resize", () => {
    const { renderer } = fixture();
    renderer.render(snapshot(), [], 1);
    const start = renderer.getViewport().center;
    renderer.render(snapshot(1), [], 1.05, { paused: true });
    expect(renderer.getViewport().center).toEqual(start);
    renderer.render(snapshot(1), [], 1.1, { reducedMotion: true });
    expect(renderer.worldToScreen(snapshot(1).sector.launch).x).toBeCloseTo(
      201,
    );
    expect(renderer.getViewport().transitioning).toBe(false);
    renderer.render(snapshot(2), [], 1.15);
    renderer.resize(390, 844);
    const resized = renderer.getViewport();
    const goal = snapshot(2).sector.checkpoint;
    const goalPoint = worldToClient(
      goal.position,
      { left: 0, top: 0, width: 390, height: 844 },
      resized,
    );
    expect(goalPoint.y - goal.radius * resized.scale).toBeGreaterThanOrEqual(
      80,
    );
    expect(renderer.getViewport().transitioning).toBe(false);
  });
  it("follows the live ship in portrait, freezes while held or paused, and returns for retry", () => {
    const { renderer } = fixture();
    renderer.resize(390, 844);
    const board = snapshot();
    renderer.render(board, [], 1);
    const initial = renderer.getViewport().center.x;
    const flying = {
      ...board,
      status: "flying" as const,
      particles: [
        {
          id: 1,
          position: {
            x: board.sector.bounds.x + board.sector.bounds.width - 10,
            y: 500,
          },
          velocity: { x: 240, y: 0 },
          alive: true,
          trail: [],
        },
      ],
    };
    renderer.render(flying, [], 1.05);
    expect(renderer.getViewport().center.x).toBeGreaterThan(initial);
    const following = renderer.getViewport().center.x;
    renderer.render(flying, [], 1.1, { cameraLocked: true });
    renderer.render(flying, [], 1.15, { paused: true });
    expect(renderer.getViewport().center.x).toBe(following);
    renderer.render({ ...flying, status: "failed" }, [], 1.2);
    renderer.render(board, [], 1.25);
    expect(renderer.getViewport().transitioning).toBe(false);
    renderer.render(board, [], 1.3, { reducedMotion: true });
    expect(renderer.getViewport().center.x).toBe(initial);
  });
  it("constructs force cues after translating to the body center", () => {
    const { renderer, context } = fixture();
    const board = snapshot();
    board.sector = {
      ...board.sector,
      bodies: [
        {
          id: "body",
          kind: "attractor",
          position: { x: 3800, y: 250 },
          radius: 80,
          strength: 1,
        },
      ],
    };
    renderer.render(board, [], 1);
    const translations = context.translate as ReturnType<typeof vi.fn>;
    const centerIndex = translations.mock.calls.findIndex(
      ([x, y]) => x === 3800 && y === 250,
    );
    const paths = context.moveTo as ReturnType<typeof vi.fn>;
    expect(centerIndex).toBeGreaterThanOrEqual(0);
    expect(translations.mock.invocationCallOrder[centerIndex]).toBeLessThan(
      paths.mock.invocationCallOrder[0],
    );
  });
  it("caps density and allows repeated cleanup without any further drawing", () => {
    const { renderer, canvas, context } = fixture();
    expect(canvas.width).toBe(2880);
    renderer.render(snapshot(), [], 1);
    const fills = (context.fillRect as ReturnType<typeof vi.fn>).mock.calls
      .length;
    renderer.destroy();
    renderer.destroy();
    renderer.render(snapshot(1), [], 2);
    renderer.resize(320, 568);
    expect(
      (context.fillRect as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBe(fills);
    expect(canvas.width).toBe(2880);
  });
});

it("fades distinct colored projectile tails by age and hides expired segments", () => {
  const { renderer, context } = fixture();
  const board = snapshot();
  board.status = "flying";
  board.elapsed = 3;
  board.particles = [
    {
      id: 0,
      alive: false,
      position: { x: 3700, y: 500 },
      velocity: { x: 1, y: 0 },
      trail: [
        Object.assign({ x: 3550, y: 500 }, { time: 0 }),
        Object.assign({ x: 3600, y: 500 }, { time: 0.5 }),
        Object.assign({ x: 3650, y: 500 }, { time: 2.5 }),
      ],
    },
  ];
  const alphas: number[] = [];
  const polygons: unknown[][] = [];
  context.fill = vi.fn(() => {
    if (typeof context.fillStyle !== "object") return;
    alphas.push(context.globalAlpha as number);
    polygons.push([
      (context.moveTo as ReturnType<typeof vi.fn>).mock.calls.at(-1),
      ...(context.lineTo as ReturnType<typeof vi.fn>).mock.calls.slice(-3),
    ]);
  });
  renderer.render(board, [], 3);
  expect(alphas).toHaveLength(2);
  expect(polygons[0][1]).toEqual(polygons[1][0]);
  expect(polygons[0][2]).toEqual(polygons[1][3]);
  const gradients = (context.createLinearGradient as ReturnType<typeof vi.fn>)
    .mock.results;
  expect(gradients[0].value.addColorStop).toHaveBeenCalledWith(
    0,
    "rgba(164, 92, 82, 0)",
  );
  expect(gradients[1].value.addColorStop).toHaveBeenCalledWith(1, "#a45c52");
  expect(alphas[0]).toBeCloseTo(0.8 * Math.pow(1 / 6, 1.6));
  expect(alphas[1]).toBeCloseTo(0.8 * Math.pow(5 / 6, 1.6));
  alphas.length = 0;
  board.elapsed = 6;
  renderer.render(board, [], 6);
  expect(alphas).toHaveLength(0);
});

it("gives branched ships matching, distinct and visible tails", () => {
  const { renderer, context } = fixture();
  const board = snapshot();
  board.status = "flying";
  board.elapsed = 1;
  board.particles = [0, 1, 2].map((id) => ({
    id,
    alive: true,
    position: { x: 3700, y: 500 + id * 20 },
    velocity: { x: 1, y: 0 },
    trail: [
      { x: 3600, y: 500 + id * 20, time: 0.5 },
      { x: 3700, y: 500 + id * 20, time: 1 },
    ],
  }));
  const colors = ["#a45c52", "#64846a", "#8c6796"];
  const tails: { color: unknown; alpha: unknown; width: number }[] = [];
  const ships: unknown[] = [];
  context.fill = vi.fn(() => {
    if (typeof context.fillStyle === "object")
      tails.push({
        color: context.strokeStyle,
        alpha: context.globalAlpha,
        width: context.lineWidth as number,
      });
    else if (colors.includes(context.fillStyle as string))
      ships.push(context.fillStyle);
  });
  const coloredStrokes: unknown[] = [];
  context.stroke = vi.fn(() => {
    if (colors.includes(context.strokeStyle as string))
      coloredStrokes.push(context.strokeStyle);
  });

  renderer.render(board, [], 1);
  expect(tails.map((tail) => tail.color)).toEqual(colors);
  expect(tails.every((tail) => tail.alpha === 0.8 && tail.width >= 2.4)).toBe(
    true,
  );
  expect(ships).toEqual(colors);
  expect(coloredStrokes).toHaveLength(0);
});

it("applies bounded gameplay zoom consistently to transforms and visible flight bounds", () => {
  const { renderer } = fixture(),
    state = snapshot();
  renderer.prepareFrame(state, 0, { reducedMotion: true });
  const base = renderer.getViewport();
  const anchor = renderer.worldToScreen(state.sector.launch);
  expect(renderer.setZoom(8)).toBe(1.2);
  const zoomed = renderer.getViewport();
  expect(renderer.worldToScreen(state.sector.launch).x).toBeCloseTo(
    anchor.x,
    9,
  );
  expect(renderer.worldToScreen(state.sector.launch).y).toBeCloseTo(
    anchor.y,
    9,
  );
  expect(zoomed.scale).toBeCloseTo(base.scale * 1.2);
  expect(zoomed.bounds.width).toBeCloseTo(base.bounds.width / 1.2);
  expect(zoomed.bounds.height).toBeCloseTo(base.bounds.height / 1.2);
  const point = state.sector.launch,
    screen = renderer.worldToScreen(point),
    roundTrip = renderer.screenToWorld(screen.x, screen.y);
  expect(roundTrip.x).toBeCloseTo(point.x, 8);
  expect(roundTrip.y).toBeCloseTo(point.y, 8);
  renderer.resize(390, 844);
  expect(renderer.getZoom()).toBe(1.2);
  renderer.prepareFrame(snapshot(1), 1, { reducedMotion: true });
  expect(renderer.getZoom()).toBe(1.2);
  renderer.setWalkthroughFocus({
    position: point,
    radius: 20,
    area: { left: 0, top: 0, width: 390, height: 500 },
  });
  const lens = renderer.getViewport().scale;
  renderer.setZoom(0.8);
  expect(renderer.getViewport().scale).toBe(lens);
  renderer.destroy();
});

it("keeps the Odessey aiming preview short and fading despite a stale full-route option", () => {
  const { renderer, context } = fixture(),
    board = snapshot();
  const path = Array.from({ length: 661 }, (_, index) => ({
    x: board.sector.launch.x + index * 2,
    y: 500,
  }));
  const original = structuredClone(path);
  const dots: { x: number; y: number; alpha: unknown }[] = [];
  (context.arc as ReturnType<typeof vi.fn>).mockImplementation(
    (x: number, y: number) => {
      if (context.fillStyle === "#8a0f4b")
        dots.push({ x, y, alpha: context.globalAlpha });
    },
  );
  const options = {
    paused: true,
    slingshot: {
      anchor: board.sector.launch,
      pull: board.sector.launch,
      power: 0.5,
    },
  };
  const expected = Array.from({ length: 16 }, (_, index) => {
    const sample = (index + 1) * 3;
    const fade = 1 - sample / 49;
    return { x: path[sample].x, y: path[sample].y, alpha: 0.98 * fade * fade };
  });
  for (const renderOptions of [options, { ...options, pathAssist: "full" }]) {
    dots.length = 0;
    renderer.render(board, [path], 0, renderOptions);
    expect(dots).toEqual(expected);
    expect(path).toEqual(original);
  }
  dots.length = 0;
  renderer.render(board, [path], 1);
  expect(dots).toEqual([]);
  renderer.render({ ...board, status: "flying" }, [path], 2, options);
  expect(dots).toEqual([]);
});

for (const [width, height] of [
  [1440, 900],
  [390, 844],
  [844, 390],
])
  it(`fits both ends of a maximum-length Odessey course at ${width}x${height}`, () => {
    const { renderer } = fixture();
    renderer.resize(width, height);
    const board = { ...snapshot(), sector: generateSector(42, 14) };
    renderer.prepareFrame(board, 0, { reducedMotion: true });
    for (const zoom of [1, 0.25]) {
      renderer.setZoom(zoom);
      const bounds = renderer.getVisibleBounds();
      for (const circle of [
        { position: board.sector.launch, radius: 5 },
        board.sector.checkpoint,
      ]) {
        expect(circle.position.x - circle.radius).toBeGreaterThanOrEqual(
          bounds.x,
        );
        expect(circle.position.x + circle.radius).toBeLessThanOrEqual(
          bounds.x + bounds.width,
        );
        expect(circle.position.y - circle.radius).toBeGreaterThanOrEqual(
          bounds.y,
        );
        expect(circle.position.y + circle.radius).toBeLessThanOrEqual(
          bounds.y + bounds.height,
        );
      }
    }
    renderer.destroy();
  });
