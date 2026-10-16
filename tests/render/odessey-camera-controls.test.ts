import { expect, it, vi } from "vitest";
import { createRenderer } from "../../src/render/renderer";
import { OrbitEngine } from "../../src/game/engine";
import { pullDistance } from "../../src/controls";
function renderer(width: number, height: number) {
  const canvas = document.createElement("canvas");
  const context = new Proxy({} as Record<string, unknown>, {
    get: (obj, key: string) => obj[key] ?? (obj[key] = vi.fn()),
  });
  vi.spyOn(canvas, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width,
    height,
  } as DOMRect);
  const result = createRenderer(canvas);
  result.resize(width, height, 1);
  return result;
}
it.each([
  [1280, 800],
  [504, 893],
  [390, 844],
  [844, 390],
])(
  "frames Odessey bottom-to-top in portrait and left-to-right in landscape on %sx%s",
  (width, height) => {
    const r = renderer(width, height),
      engine = new OrbitEngine(42),
      s = engine.getSnapshot();
    r.prepareFrame(s, 0, { reducedMotion: true });
    for (const zoom of [1 / 1.2, 1, 1.2]) {
      r.setZoom(zoom);
      const p = r.worldToScreen(s.sector.launch),
        reach = pullDistance("mouse", width, height);
      if (width < height) {
        expect(p.x).toBeCloseTo(width / 2);
        expect(p.y).toBeGreaterThan(height * 0.65);
        expect(height - p.y).toBeGreaterThanOrEqual(reach + 60);
      } else {
        expect(p.x).toBeGreaterThanOrEqual(reach + 16);
        expect(p.x).toBeLessThan(width * 0.36);
        expect(p.y).toBeGreaterThan(reach + 24);
        expect(height - p.y).toBeGreaterThan(reach + 24);
      }
      const goal = r.worldToScreen(s.sector.checkpoint.position);
      const radius = s.sector.checkpoint.radius * r.getViewport().scale;
      if (width < height && zoom <= 1) {
        expect(goal.y).toBeLessThan(p.y - height * 0.3);
        expect(goal.y - radius).toBeGreaterThan(80);
      } else if (width >= height) expect(goal.x).toBeGreaterThan(p.x);
      if (zoom <= 1) {
        expect(goal.x - radius).toBeGreaterThan(16);
        expect(goal.x + radius).toBeLessThan(width - 16);
        expect(goal.y - radius).toBeGreaterThan(16);
        expect(goal.y + radius).toBeLessThan(height - 16);
      }
    }
    expect(r.setZoom(0.01)).toBeCloseTo(1 / 1.2);
    expect(r.setZoom(4)).toBe(1.2);
    r.destroy();
  },
);
it("pans at the same zoom, retains the view during flight and recenters on request", () => {
  const r = renderer(1280, 800),
    engine = new OrbitEngine(42),
    s = engine.getSnapshot();
  r.prepareFrame(s, 0, { reducedMotion: true });
  const before = r.worldToScreen(s.sector.launch),
    scale = r.getViewport().scale;
  r.panBy(80, -30);
  const panned = r.worldToScreen(s.sector.launch);
  expect(panned.x - before.x).toBeCloseTo(80);
  expect(panned.y - before.y).toBeCloseTo(-30);
  expect(r.getViewport().scale).toBe(scale);
  engine.launch();
  r.prepareFrame(engine.getSnapshot(), 1, {
    reducedMotion: true,
    paused: true,
  });
  expect(r.worldToScreen(s.sector.launch)).toEqual(panned);
  r.resetPan();
  expect(r.worldToScreen(s.sector.launch)).toEqual(before);
  r.destroy();
});

it.each([
  [390, 844],
  [504, 893],
  [844, 390],
  [1440, 900],
])(
  "fits all physical content with padding at the default view on %sx%s",
  (width, height) => {
    const r = renderer(width, height);
    for (const seed of [4, 21, 42, 91]) {
      const s = new OrbitEngine(seed).getSnapshot();
      r.prepareFrame(s, seed, { reducedMotion: true });
      for (const item of [...s.sector.bodies, s.sector.checkpoint]) {
        const p = r.worldToScreen(item.position);
        const radius = item.radius * r.getViewport().scale;
        expect(p.x - radius).toBeGreaterThanOrEqual(24);
        expect(p.x + radius).toBeLessThanOrEqual(width - 24);
        expect(p.y - radius).toBeGreaterThanOrEqual(80);
        expect(p.y + radius).toBeLessThanOrEqual(height - 60);
      }
    }
    r.destroy();
  },
);

it("portrait pan follows screen axes and resizing restores horizontal framing", () => {
  const canvas = document.createElement("canvas");
  const context = new Proxy({} as Record<string, unknown>, {
    get: (obj, key: string) => obj[key] ?? (obj[key] = vi.fn()),
  });
  vi.spyOn(canvas, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  let width = 390,
    height = 844;
  vi.spyOn(canvas, "getBoundingClientRect").mockImplementation(
    () => ({ left: 0, top: 0, width, height }) as DOMRect,
  );
  const r = createRenderer(canvas),
    s = new OrbitEngine(42).getSnapshot();
  r.resize(width, height, 1);
  r.prepareFrame(s, 0, { reducedMotion: true });
  const before = r.worldToScreen(s.sector.launch);
  r.panBy(40, 25);
  const after = r.worldToScreen(s.sector.launch);
  expect(after.x - before.x).toBeCloseTo(40);
  expect(after.y - before.y).toBeCloseTo(25);
  [width, height] = [844, 390];
  r.resize(width, height, 1);
  expect(r.getViewport().rotation ?? 0).toBe(0);
  const launch = r.worldToScreen(s.sector.launch),
    goal = r.worldToScreen(s.sector.checkpoint.position);
  expect(launch.x).toBeLessThan(width * 0.3);
  expect(goal.x).toBeGreaterThan(launch.x);
  r.destroy();
});

it("follows inside the course, stops chasing escaped shots, and yields to a manual pan", () => {
  const r = renderer(390, 844),
    engine = new OrbitEngine(42),
    initial = engine.getSnapshot();
  r.prepareFrame(initial, 0, { reducedMotion: true });
  r.setZoom(1.2);
  const center = r.getViewport().center.x;
  engine.launch();
  const board = engine.getSnapshot();
  board.particles[0].position = {
    x: board.sector.bounds.x + board.sector.bounds.width - 8,
    y: board.sector.launch.y,
  };
  r.prepareFrame(board, 1, { reducedMotion: true });
  const following = r.getViewport().center.x;
  expect(following).toBeGreaterThan(center);
  board.particles[0].position.x += 10000;
  r.prepareFrame(board, 2, { reducedMotion: true });
  expect(r.getViewport().center.x).toBe(following);
  r.panBy(50, 0);
  const manual = r.getViewport().center.x;
  board.particles[0].position.x -= 10000;
  r.prepareFrame(board, 3, { reducedMotion: true });
  expect(r.getViewport().center.x).toBe(manual);
  r.destroy();
});
