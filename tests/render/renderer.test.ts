import { describe, expect, it, vi } from "vitest";
import { createRenderer } from "../../src/render/renderer";
import type { GameSnapshot } from "../../src/game/types";

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
  const renderer = createRenderer(canvas);
  renderer.resize(1440, 900, 3);
  return { renderer, canvas, context };
}
describe("obstacle force motion", () => {
  function forceFixture(kind: "attractor" | "repellent" = "attractor") {
    const { renderer, context } = fixture();
    const board = snapshot();
    board.sector = {
      ...board.sector,
      bodies: [
        {
          id: "force",
          kind,
          position: { x: 3800, y: 300 },
          radius: 60,
          strength: 1,
        },
      ],
    };
    const arcs = context.arc as ReturnType<typeof vi.fn>;
    const samples: Array<{ radius: number; alpha: number }> = [];
    arcs.mockImplementation((x: number, y: number, radius: number) => {
      if (x === 3800 && y === 300 && radius > 60)
        samples.push({ radius, alpha: context.globalAlpha as number });
    });
    function rings(time: number, options = {}) {
      arcs.mockClear();
      samples.length = 0;
      renderer.render(board, [], time, options);
      return arcs.mock.calls
        .filter(([x, y, radius]) => x === 3800 && y === 300 && radius > 60)
        .map(([, , radius]) => radius as number);
    }
    return { renderer, board, rings, samples };
  }
  it.each(["attractor", "repellent"] as const)(
    "flows %s rings in their force direction",
    (kind) => {
      const { rings } = forceFixture(kind);
      const first = rings(1);
      const next = rings(1.05);
      expect(first).toHaveLength(3);
      expect(next).toHaveLength(3);
      for (let i = 0; i < first.length; i++) {
        if (kind === "attractor") expect(next[i]).toBeLessThan(first[i]);
        else expect(next[i]).toBeGreaterThan(first[i]);
      }
    },
  );
  it("freezes during pause and resumes without including suspended time or double-counting frame preparation", () => {
    const { renderer, board, rings } = forceFixture();
    rings(1);
    const active = rings(1.05);
    expect(rings(2, { paused: true })).toEqual(active);
    expect(rings(200, { paused: true })).toEqual(active);
    expect(rings(201)).toEqual(active);
    renderer.prepareFrame(board, 201.05);
    const resumed = rings(201.05);
    expect(resumed[0]).toBeLessThan(active[0]);
    expect(rings(201.05)).toEqual(resumed);
    expect(rings(500)).toEqual(resumed);
    expect(rings(500.05)[0]).toBeLessThan(resumed[0]);
  });
  it("keeps reduced-motion rings static across active and paused frames", () => {
    const { rings } = forceFixture();
    const first = rings(1, { reducedMotion: true });
    expect(first).toHaveLength(3);
    expect(rings(1.05, { reducedMotion: true })).toEqual(first);
    expect(rings(200, { reducedMotion: true, paused: true })).toEqual(first);
    expect(rings(201, { reducedMotion: true })).toEqual(first);
  });
  it("makes obstacle flow clearly visible without an opaque halo", () => {
    const { rings, samples } = forceFixture();
    rings(1);
    const peak = Math.max(...samples.map((sample) => sample.alpha));
    expect(peak).toBeGreaterThanOrEqual(0.18);
    expect(peak).toBeLessThanOrEqual(0.24);
  });
  it("fades rings to invisibility at wraps while keeping count and contact radii bounded", () => {
    const { rings, samples } = forceFixture("repellent");
    rings(1);
    let previous = samples.map((sample) => ({ ...sample }));
    let wraps = 0;
    for (let frame = 1; frame <= 120; frame++) {
      const radii = rings(1 + frame * 0.05);
      expect(radii).toHaveLength(3);
      for (let i = 0; i < radii.length; i++) {
        expect(radii[i]).toBeGreaterThan(60);
        expect(radii[i]).toBeLessThanOrEqual(119.4);
        if (radii[i] < previous[i].radius) {
          wraps++;
          expect(previous[i].alpha).toBeLessThan(0.001);
          expect(samples[i].alpha).toBeLessThan(0.001);
        }
      }
      previous = samples.map((sample) => ({ ...sample }));
    }
    expect(wraps).toBeGreaterThanOrEqual(3);
  });
});
describe("checkpoint gravity motion", () => {
  function goalFixture() {
    const { renderer, context } = fixture();
    const board = snapshot();
    const center = board.sector.checkpoint.position;
    const samples: Array<{ radius: number; alpha: number; color: unknown }> =
      [];
    (context.arc as ReturnType<typeof vi.fn>).mockImplementation(
      (x: number, y: number, radius: number) => {
        if (x === center.x && y === center.y)
          samples.push({
            radius,
            alpha: context.globalAlpha as number,
            color: context.strokeStyle,
          });
      },
    );
    function frame(time: number, options = {}) {
      samples.length = 0;
      renderer.render(board, [], time, options);
      return samples.map((sample) => ({ ...sample }));
    }
    return { frame };
  }
  it("flows three stronger electric-blue goal rings inward while keeping its identity fixed", () => {
    const { frame } = goalFixture();
    const first = frame(1),
      next = frame(1.05);
    for (let i = 0; i < 3; i++) {
      expect(next[i].radius).toBeLessThan(first[i].radius);
      expect(first[i].radius).toBeGreaterThan(45);
      expect(first[i].radius).toBeLessThanOrEqual(98.55);
      expect(first[i].color).toBe("#168dff");
    }
    expect(
      Math.max(...first.slice(0, 3).map((ring) => ring.alpha)),
    ).toBeGreaterThanOrEqual(0.18);
    expect(next.slice(3)).toEqual(first.slice(3));
  });
  it("freezes goal flow during pause and suspended gaps and uses fixed reduced-motion rings", () => {
    const { frame } = goalFixture();
    frame(1);
    const active = frame(1.05);
    expect(frame(2, { paused: true })).toEqual(active);
    expect(frame(200, { paused: true })).toEqual(active);
    expect(frame(201)).toEqual(active);
    expect(frame(201.05)[0].radius).toBeLessThan(active[0].radius);
    const reduced = frame(202, { reducedMotion: true });
    expect(frame(203, { reducedMotion: true })).toEqual(reduced);
    expect(frame(300, { reducedMotion: true, paused: true })).toEqual(reduced);
  });
});
describe("displayed camera contract", () => {
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
      const samples: Array<{ x: number; y: number; alpha: number }> = [];
      (context.arc as ReturnType<typeof vi.fn>).mockImplementation(
        (x: number, y: number) =>
          samples.push({ x, y, alpha: context.globalAlpha as number }),
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
      expect(first.alpha).toBeGreaterThan(0.5);
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
  it("draws an electric capture ring with two inner rings, a flag and no goal chevrons", () => {
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
    expect(contact.width * renderer.getViewport().scale).toBeCloseTo(2.8);
    expect(
      rings.filter((ring) => ring.radius > 45).length,
    ).toBeGreaterThanOrEqual(3);
    expect(
      rings.every((ring) => ring.start === 0 && ring.end === Math.PI * 2),
    ).toBe(true);
    expect(surfaces).toContainEqual({ radius: 45, color: "#e9ecef", alpha: 1 });
    expect([
      ...new Set(
        rings.filter((ring) => ring.radius < 45).map((ring) => ring.radius),
      ),
    ]).toEqual([32.4, 19.35]);
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
    const edgeColors: unknown[] = [];
    const effectColors: unknown[] = [];
    (context.arc as ReturnType<typeof vi.fn>).mockImplementation(
      (x, y, radius) => {
        if (x === 300 && radius === 6) edgeColors.push(context.strokeStyle);
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
    [4249.628125, false, "fully visible at screen x302.09"],
    [4314.0625, false, "partly visible beyond the right edge"],
    [3385.9375, false, "partly visible beyond the left edge"],
    [4356.25, true, "fully outside the right edge"],
    [3343.75, true, "fully outside the left edge"],
  ] as const)(
    "does not cover a rendered phone goal: %s, cue=%s (%s)",
    (x, expectedCue, _description) => {
      const { renderer, context } = fixture();
      const board = snapshot();
      board.sector = {
        ...board.sector,
        checkpoint: { radius: 45, position: { x, y: 409.4375 } },
      };
      renderer.resize(320, 568);
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
      expect(topLeft.x).toBeCloseTo(prepared.bounds.x, 9);
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
    expect(renderer.getViewport().center.x).toBe(5800);
    expect(renderer.getViewport().transitioning).toBe(false);
    renderer.render(snapshot(2), [], 1.15);
    renderer.resize(390, 844);
    expect(renderer.getViewport().center.x).toBe(6850);
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
          position: { x: 4500, y: 500 },
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
    expect(renderer.getViewport().transitioning).toBe(true);
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
