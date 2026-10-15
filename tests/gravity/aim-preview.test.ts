import { describe, expect, it } from "vitest";
import {
  gravityAimPredictionSeconds,
  sampleGravityAimPreview,
} from "../../src/gravity/aim-preview";

describe("Gravity aim preview", () => {
  it("extends a zoomed-out physical prediction without making zoomed-in hints longer", () => {
    expect(gravityAimPredictionSeconds("partial", 1, 200)).toBeCloseTo(1.4);
    expect(gravityAimPredictionSeconds("partial", 0.4, 200)).toBeCloseTo(2);
    expect(gravityAimPredictionSeconds("partial", 0.1, 200)).toBeCloseTo(4);
    expect(gravityAimPredictionSeconds("partial", 4, 200)).toBeCloseTo(1.4);
  });
  it("bounds prediction work in dense skies and keeps full assist at ten seconds", () => {
    expect(
      gravityAimPredictionSeconds("partial", 0.1, 200, 32),
    ).toBeLessThanOrEqual(2.4);
    expect(
      gravityAimPredictionSeconds("partial", 0.1, 200, 128),
    ).toBeLessThanOrEqual(1.4);
    expect(gravityAimPredictionSeconds("full", 0.1, 200, 128)).toBe(10);
    expect(gravityAimPredictionSeconds("partial", 0, 0)).toBe(4);
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
      [9, 0],
      [18, 0],
      [20, 7],
      [20, 16],
      [20, 25],
    ]);
    expect(dots.map(({ distance }) => distance)).toEqual([9, 18, 27, 36, 45]);
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
    expect(collision.dots).toEqual([{ x: 9, y: 0, distance: 9 }]);
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
      { x: 1000, y: 0 },
    ];
    const partial = sampleGravityAimPreview(route, 0.5, "partial");
    const full = sampleGravityAimPreview(route, 0.5, "full");
    expect(partial.length).toBe(200);
    expect(partial.dots.at(-1)!.distance).toBe(198);
    expect(full.length).toBe(500);
    expect(full.dots.at(-1)!.distance).toBe(495);
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
    expect(dots.length).toBeLessThanOrEqual(240);
    expect(dots.length).toBeGreaterThan(200);
    expect(dots.at(-1)!.x).toBeLessThanOrEqual(10000);
    expect(
      dots.every(
        (dot, i) => i === 0 || dot.distance - dots[i - 1].distance >= 9,
      ),
    ).toBe(true);
  });
});
