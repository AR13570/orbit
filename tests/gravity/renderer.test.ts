import { describe, expect, it, vi } from "vitest";
import {
  createGravityRenderer,
  fitGravityFrame,
} from "../../src/gravity/renderer";
import { worldToClient } from "../../src/render/coordinates";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
function fixture() {
  const canvas = document.createElement("canvas"),
    segments: { alpha: number; color: string }[] = [],
    gradients: { stops: { offset: number; color: string }[] }[] = [],
    fills: unknown[] = [];
  const context = new Proxy(
    { globalAlpha: 1, strokeStyle: "" } as Record<string, unknown>,
    {
      get(target, key: string) {
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
        if (key === "fill") return () => fills.push(target.fillStyle);
        if (key === "stroke")
          return () =>
            segments.push({
              alpha: target.globalAlpha as number,
              color: target.strokeStyle as string,
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
  };
}
describe("Gravity rendering", () => {
  it.each([
    [390, 844],
    [844, 390],
    [600, 960],
    [1024, 768],
  ])(
    "keeps tablet and phone launch controls and orbit space inside %ix%i",
    (width, height) => {
      const level = new GravityEngine(42).getSnapshot().level;
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
    const snapshot = new GravityEngine(42).getSnapshot();
    renderer.resize(844, 390, 1);
    renderer.render(snapshot, [], 0, { paused: true, reducedMotion: true });
    expect(renderer.getScale()).toBeGreaterThan(0.5);
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
  it("draws continuous colored ribbon tails with opacity gradients based on age", () => {
    const { renderer, segments, gradients, fills } = fixture();
    renderer.resize(390, 844, 1);
    const engine = new GravityEngine(42),
      s = engine.getSnapshot();
    s.elapsed = 10;
    s.particles = [
      {
        id: 1,
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
    expect(gradients[0].stops[0].color.startsWith("rgba(164, 92, 82,")).toBe(
      true,
    );
    expect(alpha(gradients[0].stops[0].color)).toBeLessThan(
      alpha(gradients[0].stops[1].color),
    );
    expect(alpha(gradients[1].stops[0].color)).toBeLessThan(
      alpha(gradients[1].stops[1].color),
    );
    const trailGradients = gradients.length;
    s.elapsed = 14;
    renderer.render(s, [], 0, { paused: false, reducedMotion: true });
    expect(gradients).toHaveLength(trailGradients);
  });
});
