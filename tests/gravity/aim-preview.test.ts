import { describe, expect, it, vi } from "vitest";
import {
  gravityAimPredictionSeconds,
  sampleGravityAimPreview,
} from "../../src/gravity/aim-preview";

describe("Gravity aim preview", () => {
  it("measures each visible segment once while retaining exact resampled dots", () => {
    const route = [
      { x: 0, y: 0 },
      { x: 9, y: 12 },
      { x: 9, y: 12 },
      { x: 29, y: 12 },
    ];
    const before = structuredClone(route);
    const hypot = vi.spyOn(Math, "hypot");
    try {
      const result = sampleGravityAimPreview(route, 1, "full");
      expect(result).toEqual({
        dots: [
          { x: 7.2, y: 9.600000000000001, distance: 12 },
          { x: 18, y: 12, distance: 24 },
        ],
        length: 35,
      });
      expect(route).toEqual(before);
      expect(hypot).toHaveBeenCalledTimes(route.length - 1);
      result.dots[0].x = 100;
      expect(route).toEqual(before);
    } finally {
      hypot.mockRestore();
    }
  });
  it("stops measuring at the partial cutoff and retains invalid-segment handling", () => {
    const route = [
      { x: 0, y: 0 },
      { x: NaN, y: 0 },
      { x: 0, y: 0 },
      { x: Infinity, y: 0 },
      { x: 0, y: 0 },
      { x: 768, y: 0 },
      { x: 1536, y: 0 },
    ];
    const hypot = vi.spyOn(Math, "hypot");
    try {
      expect(sampleGravityAimPreview(route, 1)).toEqual({
        dots: Array.from({ length: 50 }, (_, index) => ({
          x: (index + 1) * 12,
          y: 0,
          distance: (index + 1) * 12,
        })),
        length: 600,
      });
      expect(hypot).toHaveBeenCalledTimes(5);
    } finally {
      hypot.mockRestore();
    }
    for (const scale of [0, -1, -Infinity, NaN, Infinity])
      expect(sampleGravityAimPreview(route, scale)).toEqual({
        dots: [],
        length: 0,
      });
  });
  it("extends a zoomed-out physical prediction without making zoomed-in hints longer", () => {
    expect(gravityAimPredictionSeconds("partial", 1, 200)).toBeCloseTo(4.2);
    expect(gravityAimPredictionSeconds("partial", 0.4, 200)).toBeCloseTo(6);
    expect(gravityAimPredictionSeconds("partial", 0.1, 200)).toBeCloseTo(12);
    expect(gravityAimPredictionSeconds("partial", 4, 200)).toBeCloseTo(4.2);
  });
  it("bounds prediction work in dense skies and keeps full assist at twenty seconds", () => {
    expect(
      gravityAimPredictionSeconds("partial", 0.1, 200, 32),
    ).toBeLessThanOrEqual(7.2);
    expect(
      gravityAimPredictionSeconds("partial", 0.1, 200, 128),
    ).toBeLessThanOrEqual(4.2);
    expect(gravityAimPredictionSeconds("full", 0.1, 200, 128)).toBe(20);
    expect(gravityAimPredictionSeconds("partial", 0, 0)).toBe(12);
  });
  it("follows a bend instead of joining the beginning and end with a fake straight path", () => {
    const { dots, length } = sampleGravityAimPreview(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 30 },
      ],
      1,
      "partial",
    );
    expect(length).toBeCloseTo(50);
    expect(dots.map(({ x, y }) => [x, y])).toEqual([
      [12, 0],
      [20, 4],
      [20, 16],
      [20, 28],
    ]);
    expect(dots.map(({ distance }) => distance)).toEqual([12, 24, 36, 48]);
  });
  it("never draws past a collision-shortened path or extends a stationary path", () => {
    const collision = sampleGravityAimPreview(
      [
        { x: 0, y: 0 },
        { x: 12, y: 0 },
      ],
      1,
      "partial",
    );
    expect(collision.length).toBe(12);
    expect(collision.dots).toEqual([{ x: 12, y: 0, distance: 12 }]);
    expect(
      sampleGravityAimPreview(
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
        1,
        "partial",
      ).dots,
    ).toEqual([]);
  });
  it("limits partial assist to a short visible section but retains the full simulated route", () => {
    const route = [
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
    ];
    const partial = sampleGravityAimPreview(route, 0.5, "partial");
    const full = sampleGravityAimPreview(route, 0.5, "full");
    expect(partial.length).toBe(600);
    expect(partial.dots.at(-1)!.distance).toBe(600);
    expect(full.length).toBe(1000);
    expect(full.dots.at(-1)!.distance).toBe(996);
  });
  it("bounds full-preview drawing for a fast trajectory at maximum zoom", () => {
    const { dots, length } = sampleGravityAimPreview(
      [
        { x: 0, y: 0 },
        { x: 10000, y: 0 },
      ],
      4,
      "full",
    );
    expect(length).toBe(40000);
    expect(dots.length).toBeLessThanOrEqual(180);
    expect(dots.length).toBeGreaterThan(150);
    expect(dots.at(-1)!.x).toBeLessThanOrEqual(10000);
    expect(
      dots.every(
        (dot, i) => i === 0 || dot.distance - dots[i - 1].distance >= 12,
      ),
    ).toBe(true);
  });
});
