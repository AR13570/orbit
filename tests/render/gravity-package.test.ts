import { it, expect } from "vitest";
import { createWaveRenderer } from "gravity-wave";
import {
  createGravitySurface,
  drawGravitySurface,
} from "../../src/render/gravity-surface";
function capture() {
  const points: unknown[][] = [];
  let alpha = 0.8,
    style = "#303943";
  const stack: { alpha: number; style: string }[] = [];
  const ctx = {
    get globalAlpha() {
      return alpha;
    },
    set globalAlpha(v: number) {
      alpha = v;
    },
    get fillStyle() {
      return style;
    },
    set fillStyle(v: string) {
      style = v;
    },
    save() {
      stack.push({ alpha, style });
    },
    restore() {
      const state = stack.pop()!;
      alpha = state.alpha;
      style = state.style;
    },
    beginPath() {},
    fill() {},
    rect(x: number, y: number, w: number, h: number) {
      points.push([x, y, w, h, alpha, style]);
    },
  } as CanvasRenderingContext2D;
  return { ctx, points };
}
it.each([
  [false, false, 1],
  [true, false, 0.4],
  [false, true, 0.75],
] as const)(
  "adapts body radius, direction, zoom and reduced motion to the package (%s, %s, %s)",
  (repels, reducedMotion, scale) => {
    const actual = capture(),
      expected = capture();
    const surface = createGravitySurface(actual.ctx);
    const center = { x: 300, y: 250 };
    drawGravitySurface(
      actual.ctx,
      center,
      60,
      repels,
      scale,
      1.25,
      reducedMotion,
      "#527c9a",
      surface,
    );
    createWaveRenderer(expected.ctx).draw(
      [
        {
          center,
          innerRadius: 60,
          radius: 200,
          direction: repels ? "outward" : "inward",
          color: "#527c9a",
          shadowColor: "#527c9a",
        },
      ],
      1.25,
      { scale, reducedMotion },
    );
    expect(actual.points).toEqual(expected.points);
    expect(actual.ctx.globalAlpha).toBe(0.8);
    surface.destroy();
  },
);
