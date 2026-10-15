import { describe, expect, it, vi } from "vitest";
import {
  createGravityRenderer,
  fitGravityFrame,
} from "../../src/gravity/renderer";
import { worldToClient } from "../../src/render/coordinates";
import { getGravityLevel } from "../../src/gravity/campaign";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
function fixture() {
  const canvas = document.createElement("canvas"),
    segments: { alpha: number; color: string; width: number }[] = [],
    gradients: { stops: { offset: number; color: string }[] }[] = [],
    fills: unknown[] = [],
    fillRecords: { color: unknown; alpha: number; circle: number[] }[] = [];
  let lastCircle: number[] = [];
  const context = new Proxy(
    { globalAlpha: 1, strokeStyle: "" } as Record<string, unknown>,
    {
      get(target, key: string) {
        if (key === "arc")
          return (...values: number[]) => {
            lastCircle = values;
          };
        if (key === "createLinearGradient")
          return () => {
            const gradient = {
              stops: [] as { offset: number; color: string }[],
              addColorStop(offset: number, color: string) {
                this.stops.push({ offset, color });
              },
            };
            gradients.push(gradient);
            return gradient;
          };
        if (key === "fill")
          return () => {
            fills.push(target.fillStyle);
            fillRecords.push({
              color: target.fillStyle,
              alpha: target.globalAlpha as number,
              circle: lastCircle,
            });
          };
        if (key === "stroke")
          return () =>
            segments.push({
              alpha: target.globalAlpha as number,
              color: target.strokeStyle as string,
              width: target.lineWidth as number,
            });
        return target[key] ?? (target[key] = vi.fn());
      },
    },
  );
  vi.spyOn(canvas, "getContext").mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  );
  return {
    renderer: createGravityRenderer(canvas),
    canvas,
    context,
    segments,
    gradients,
    fills,
    fillRecords,
  };
}
describe("Gravity rendering", () => {
  it("keeps each flying planet's visible size after choosing a different next launch", () => {
    const { renderer, fillRecords } = fixture();
    const engine = new GravityEngine(42, getGravityLevel(42, 0));
    engine.setProjectileSize(2);
    engine.launchFrom({ x: 200, y: 300 }, { x: 0, y: 0 });
    engine.setProjectileSize(1);
    engine.setPhysics({ planetRadius: 6, planetMass: 3 });
    engine.launchFrom({ x: 400, y: 300 }, { x: 0, y: 0 });
    renderer.resize(390, 844);
    renderer.setZoom(0.25);
    renderer.render(engine.getSnapshot(), [], 0, {
      paused: true,
      reducedMotion: true,
      pull: { x: -72, y: 0 },
    });
    const first = fillRecords.find(({ color }) => color === "#ff6b8b")!;
    const second = fillRecords.find(({ color }) => color === "#53d9ff")!;
    const aim = fillRecords.find(({ color }) => color === "#7a60d6")!;
    expect(first.circle[2] * renderer.getScale()).toBeCloseTo(9);
    expect(second.circle[2] * renderer.getScale()).toBeCloseTo(4.5);
    expect(aim.circle[2] * renderer.getScale()).toBeCloseTo(5);
  });
  it.each([1, 1.5, 2])(
    "keeps projectile size %f visible in flight and while aiming at minimum zoom",
    (size) => {
      const { renderer, fillRecords } = fixture();
      const engine = new GravityEngine(42, getGravityLevel(42, 0));
      engine.setProjectileSize(size);
      engine.launchFrom({ x: 200, y: 300 }, { x: 0, y: 0 });
      renderer.resize(390, 844);
      renderer.setZoom(0.25);
      renderer.render(engine.getSnapshot(), [], 0, {
        paused: true,
        reducedMotion: true,
        pull: { x: -72, y: 0 },
      });
      const actual = fillRecords.find(({ color }) => color === "#ff6b8b")!;
      const aim = fillRecords.find(({ color }) => color === "#7a60d6")!;
      expect(actual.circle[2] * renderer.getScale()).toBeCloseTo(4.5 * size);
      expect(aim.circle[2] * renderer.getScale()).toBeCloseTo(5 * size);
    },
  );
  it.each(["partial", "full"] as const)(
    "fades %s preview progressively along its whole length",
    (pathAssist) => {
      const { renderer, fillRecords } = fixture();
      renderer.resize(390, 844);
      renderer.render(
        new GravityEngine(42, getGravityLevel(42, 0)).getSnapshot(),
        Array.from({ length: 180 }, (_, i) => ({ x: 250 + i * 10, y: 400 })),
        0,
        { paused: true, reducedMotion: true, pathAssist },
      );
      const dots = fillRecords
        .filter(({ color }) => color === "#7956cf")
        .map(({ alpha }) => alpha);
      expect(dots.length).toBeGreaterThan(15);
      expect(dots[0]).toBeGreaterThan(0.75);
      expect(dots[Math.floor(dots.length / 2)]).toBeLessThan(0.45);
      expect(dots.at(-1)).toBeLessThan(0.01);
      expect(dots.every((a, i) => i === 0 || a < dots[i - 1])).toBe(true);
    },
  );
  it.each(
    [1280, 390, 844, 320].flatMap((width, i) =>
      [0.25, 0.45, 1, 2, 4].map((zoom) => [
        width,
        [800, 844, 390, 568][i],
        zoom,
      ]),
    ),
  )(
    "keeps partial dots legible with even screen spacing at %ix%i zoom %f",
    (width, height, zoom) => {
      const { renderer, fillRecords } = fixture();
      const snapshot = new GravityEngine(
        42,
        getGravityLevel(42, 0),
      ).getSnapshot();
      renderer.resize(width, height);
      renderer.setZoom(zoom);
      renderer.render(snapshot, [], 0, { paused: true, reducedMotion: true });
      const scale = renderer.getScale();
      // Irregular physical samples must produce the same readable screen-space path.
      const points = [0, 2, 7, 31, 80, 400].map((x) => ({
        x: 250 + x / scale,
        y: 400,
      }));
      renderer.render(snapshot, points, 0, {
        paused: true,
        reducedMotion: true,
        pathAssist: "partial",
      });
      const dots = fillRecords.filter(({ color }) => color === "#7956cf");
      expect(dots.length).toBeGreaterThanOrEqual(20);
      expect(dots.length).toBeLessThanOrEqual(24);
      expect(dots[0].alpha).toBeGreaterThan(0.75);
      for (const dot of dots) expect(dot.circle[2] * scale).toBeCloseTo(2.3);
      for (let i = 1; i < dots.length; i++) {
        expect((dots[i].circle[0] - dots[i - 1].circle[0]) * scale).toBeCloseTo(
          9,
        );
        expect(dots[i].alpha).toBeLessThan(dots[i - 1].alpha);
      }
      expect((dots.at(-1)!.circle[0] - 250) * scale).toBeLessThanOrEqual(200);
      expect(dots.at(-1)!.alpha).toBeLessThan(0.01);
    },
  );
  it("has no fixed launcher and shows a circular planet only at the current aim origin", () => {
    const { renderer, segments, fills } = fixture();
    const snapshot = new GravityEngine(
      42,
      getGravityLevel(42, 0),
    ).getSnapshot();
    snapshot.launchPosition = { x: 200, y: 300 };
    renderer.resize(390, 844);
    renderer.render(snapshot, [], 1, { paused: false, reducedMotion: true });
    expect(segments.some((segment) => segment.color === "#c3a446")).toBe(false);
    expect(fills).not.toContain("#7a60d6");
    renderer.render(snapshot, [], 2, {
      paused: false,
      reducedMotion: true,
      pull: { x: -72, y: 0 },
    });
    expect(fills).toContain("#7a60d6");
  });
  it.each([
    [390, 844],
    [844, 390],
    [600, 960],
    [1024, 768],
  ])(
    "keeps tablet and phone launch controls and orbit space inside %ix%i",
    (width, height) => {
      const level = new GravityEngine(42, getGravityLevel(42, 0)).getSnapshot()
        .level;
      const { camera, area } = fitGravityFrame(level, width, height, true);
      const rect = {
        left: area.x,
        top: area.y,
        width: area.width,
        height: area.height,
      };
      const launcher = worldToClient(level.launch, rect, camera);
      expect(launcher.x - 72).toBeGreaterThanOrEqual(area.x + 18 - 1e-8);
      expect(launcher.y - 72).toBeGreaterThanOrEqual(area.y + 18 - 1e-8);
      expect(launcher.y + 72).toBeLessThanOrEqual(
        area.y + area.height - 18 + 1e-8,
      );
      for (const body of level.bodies) {
        const center = worldToClient(body.position, rect, camera);
        const radius = (body.radius + 40) * camera.scale;
        expect(center.x - radius).toBeGreaterThan(area.x);
        expect(center.x + radius).toBeLessThan(area.x + area.width);
        expect(center.y - radius).toBeGreaterThan(area.y);
        expect(center.y + radius).toBeLessThan(area.y + area.height);
      }
    },
  );
  it("uses meaningful orbit extents and landscape space rather than the 900-unit square", () => {
    const { renderer } = fixture();
    const snapshot = new GravityEngine(
      42,
      getGravityLevel(42, 0),
    ).getSnapshot();
    renderer.resize(844, 390, 1);
    renderer.render(snapshot, [], 0, { paused: true, reducedMotion: true });
    expect(renderer.getScale()).toBeGreaterThan((390 - 36) / 900);
  });
  it("centres the visible letter glyphs vertically with the body chevrons", () => {
    const { renderer, context } = fixture();
    context.measureText = vi.fn((letter: string) => ({
      actualBoundingBoxAscent: letter === "A" ? 8 : 10,
      actualBoundingBoxDescent: letter === "A" ? 2 : 0,
    }));
    const draft = newDraft();
    draft.bodies.push({
      ...draft.bodies[0],
      id: "body-2",
      position: { x: 650, y: 550 },
    });
    renderer.resize(900, 900, 1);
    renderer.render(
      new GravityEngine(42, toGravityLevel(draft)).getSnapshot(),
      [],
      0,
      { paused: false, reducedMotion: true },
    );
    expect(context.fillText).toHaveBeenCalledWith("A", 450, 453);
    expect(context.fillText).toHaveBeenCalledWith("B", 650, 555);
    expect(context.textBaseline).toBe("alphabetic");
    expect(context.font).toMatch(/^700 /);
  });
  it("fits a stable field on portrait and landscape screens and caps pixel density", () => {
    const { renderer, canvas } = fixture();
    renderer.resize(390, 844, 4);
    expect(renderer.getScale()).toBeGreaterThan(0);
    expect(canvas.width).toBe(780);
    renderer.resize(844, 390, 4);
    expect(renderer.getScale()).toBeGreaterThan(0);
    renderer.destroy();
  });
  it("keeps all 16 live planet colors in long trails, including generated HSL colors, with bounded draw batches", () => {
    const { renderer, segments, gradients, fills } = fixture();
    const draft = newDraft();
    draft.bodies = [];
    draft.physics = {
      planetGravity: false,
      planetCollisions: "none",
      bodyCollisions: false,
      trailSeconds: 30,
    };
    const engine = new GravityEngine(42, toGravityLevel(draft));
    for (let i = 0; i < 16; i++)
      engine.launchFrom({ x: 150 + i * 20, y: 400 }, { x: 20, y: 5 });
    const state = engine.getSnapshot();
    state.elapsed = 30;
    for (const planet of state.particles)
      planet.trail = Array.from({ length: 512 }, (_, i) => ({
        x: planet.position.x + i / 10,
        y: planet.position.y,
        time: (i * 30) / 511,
      }));
    expect(new Set(state.particles.map((planet) => planet.color)).size).toBe(
      16,
    );
    const extra = state.particles.filter((planet) =>
      planet.color.startsWith("hsl("),
    );
    expect(extra).toHaveLength(4);
    renderer.resize(390, 844);
    renderer.render(state, [], 0, { paused: true, reducedMotion: true });
    expect(segments).toHaveLength(16 * 8);
    const bandAlpha = (color: string) =>
      Number(color.match(/(?:, | \/ )([\d.e+-]+)\)$/)?.[1]);
    for (let planet = 0; planet < 16; planet++) {
      const bands = segments
        .slice(planet * 8, planet * 8 + 8)
        .map(({ color }) => bandAlpha(color));
      expect(bands.every((alpha, i) => i === 0 || alpha > bands[i - 1])).toBe(
        true,
      );
      expect(bands[7]).toBeLessThanOrEqual(0.52);
      expect(bands[0]).toBeLessThan(0.02);
    }
    expect(gradients).toHaveLength(0);
    for (const planet of extra) {
      expect(fills).toContain(planet.color);
      expect(segments.some((segment) => segment.color.startsWith("hsl("))).toBe(
        true,
      );
    }
    expect(
      segments.some((segment) =>
        segment.color.startsWith("rgba(82, 124, 154,"),
      ),
    ).toBe(false);
    // The short ribbon path preserves the color family with a continuous opacity gradient.
    const planet = extra[0];
    state.particles = [{ ...planet, trail: planet.trail.slice(-3) }];
    renderer.render(state, [], 1, { paused: true, reducedMotion: true });
    expect(gradients).toHaveLength(2);
    expect(
      gradients.every((gradient) =>
        gradient.stops.every((stop) => stop.color.startsWith("hsl(")),
      ),
    ).toBe(true);
  });
  it("fades the far end of a fresh dense trail before its lifetime expires", () => {
    const { renderer, segments } = fixture();
    const engine = new GravityEngine(42, toGravityLevel(newDraft()));
    engine.launchFrom({ x: 250, y: 500 }, { x: 10, y: 0 });
    const state = engine.getSnapshot();
    state.elapsed = 1;
    state.particles[0].trail = Array.from({ length: 512 }, (_, i) => ({
      x: 250 + i / 10,
      y: 500,
      time: 0.1 + (0.9 * i) / 511,
    }));
    renderer.resize(390, 844);
    renderer.render(state, [], 0, { paused: true, reducedMotion: true });
    const alpha = (color: string) =>
      Number(color.match(/, ([\d.e+-]+)\)$/)?.[1]);
    const bands = segments.slice(0, 8).map(({ color }) => alpha(color));
    expect(bands).toHaveLength(8);
    expect(bands[0]).toBeLessThan(0.04);
    expect(bands[7]).toBeGreaterThan(0.45);
    expect(bands.every((value, i) => i === 0 || value > bands[i - 1])).toBe(
      true,
    );
  });
  it("draws continuous colored ribbon tails with opacity gradients based on age", () => {
    const { renderer, segments, gradients, fills } = fixture();
    renderer.resize(390, 844, 1);
    const engine = new GravityEngine(42, getGravityLevel(42, 0)),
      s = engine.getSnapshot();
    s.elapsed = 10;
    s.particles = [
      {
        id: 1,
        mass: 1,
        radius: 5,
        position: { x: 400, y: 400 },
        velocity: { x: 1, y: 0 },
        alive: false,
        color: "#a45c52",
        born: 0,
        outside: 0,
        orbits: {},
        trail: [
          { x: 380, y: 400, time: 7.1 },
          { x: 390, y: 400, time: 8 },
          { x: 400, y: 400, time: 9.9 },
        ],
      },
    ];
    renderer.render(s, [], 0, { paused: false, reducedMotion: true });
    expect(segments.filter((s) => s.color === "#a45c52")).toHaveLength(0);
    expect(
      fills.filter((fill) =>
        gradients.includes(fill as (typeof gradients)[number]),
      ),
    ).toHaveLength(2);
    expect(gradients).toHaveLength(2);
    const alpha = (color: string) =>
      Number(color.match(/rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)/)?.[1]);
    expect(gradients[0].stops).toHaveLength(2);
    expect(gradients[0].stops[0].color.startsWith("rgba(183, 132, 126,")).toBe(
      true,
    );
    expect(alpha(gradients[0].stops[0].color)).toBeLessThan(
      alpha(gradients[0].stops[1].color),
    );
    expect(alpha(gradients[1].stops[0].color)).toBeLessThan(
      alpha(gradients[1].stops[1].color),
    );
    // Even a new, short flight fades at its oldest visible end rather than waiting 24 seconds.
    s.elapsed = 1;
    s.particles[0].trail = [
      { x: 380, y: 400, time: 0.1 },
      { x: 390, y: 400, time: 0.5 },
      { x: 400, y: 400, time: 0.99 },
    ];
    renderer.render(s, [], 0, { paused: false, reducedMotion: true });
    expect(alpha(gradients.at(-2)!.stops[0].color)).toBe(0);
    expect(alpha(gradients.at(-1)!.stops[1].color)).toBeGreaterThan(0.5);
    const trailGradients = gradients.length;
    s.elapsed = 10 + s.physics.trailSeconds + 1;
    renderer.render(s, [], 0, { paused: false, reducedMotion: true });
    expect(gradients).toHaveLength(trailGradients);
  });
});

it("keeps Gravity zoom, projection and visible bounds aligned across resize", () => {
  const { renderer, canvas } = fixture();
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    left: 17,
    top: 29,
    width: 800,
    height: 600,
    right: 817,
    bottom: 629,
    x: 17,
    y: 29,
    toJSON: () => ({}),
  });
  const state = new GravityEngine(42, getGravityLevel(42, 0)).getSnapshot();
  renderer.resize(800, 600);
  renderer.render(state, [], 0, { paused: false, reducedMotion: true });
  const baseScale = renderer.getScale(),
    baseBounds = renderer.getVisibleBounds();
  expect(renderer.setZoom(1.5)).toBe(1.5);
  expect(renderer.getScale()).toBeCloseTo(baseScale * 1.5);
  expect(renderer.getVisibleBounds().width).toBeCloseTo(baseBounds.width / 1.5);
  const point = state.level.launch,
    screen = renderer.worldToScreen(point),
    roundTrip = renderer.screenToWorld(screen.x, screen.y);
  expect(roundTrip.x).toBeCloseTo(point.x, 8);
  expect(roundTrip.y).toBeCloseTo(point.y, 8);
  renderer.resize(390, 844);
  expect(renderer.getZoom()).toBe(1.5);
  renderer.setWalkthroughFocus({
    position: point,
    radius: 20,
    area: { left: 0, top: 0, width: 390, height: 500 },
  });
  const lens = renderer.getScale();
  renderer.setZoom(0.8);
  expect(renderer.getScale()).toBe(lens);
  renderer.destroy();
});

it("keeps an obstructed held planet visible with a clear warning and no trajectory dots", () => {
  const { renderer, fillRecords, context } = fixture();
  const engine = new GravityEngine(42, getGravityLevel(42, 0));
  engine.setLaunch({ x: 450, y: 450 }, { angle: 0, power: 0.25 });
  renderer.resize(1200, 800);
  renderer.render(
    engine.getSnapshot(),
    [
      { x: 450, y: 450 },
      { x: 650, y: 450 },
    ],
    0,
    {
      paused: true,
      reducedMotion: true,
      pull: { x: -45, y: 0 },
      pathAssist: "full",
    },
  );
  const marker = fillRecords.find(({ color }) => color === "#c9675e");
  expect(marker?.alpha).toBe(1);
  expect(marker?.circle.slice(0, 2)).toEqual([450, 450]);
  expect(fillRecords.filter(({ color }) => color === "#7956cf")).toHaveLength(
    0,
  );
  expect(context.fillText).toHaveBeenCalledWith(
    "Start in clear space",
    450,
    expect.any(Number),
  );
  expect(context.strokeText).toHaveBeenCalledWith(
    "Start in clear space",
    450,
    expect.any(Number),
  );
});
