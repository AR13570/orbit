import { describe, expect, it } from "vitest";
import {
  MAX_GAMEPLAY_ZOOM,
  MIN_GAMEPLAY_ZOOM,
  MIN_GRAVITY_ZOOM,
  PinchZoom,
  clampGameplayZoom,
  zoomCamera,
} from "../../src/zoom";

describe("gameplay camera zoom", () => {
  it("keeps zoom inside the supported range", () => {
    expect(MIN_GAMEPLAY_ZOOM).toBe(0.25);
    expect(MAX_GAMEPLAY_ZOOM).toBe(4);
    expect(clampGameplayZoom(0.2)).toBe(0.25);
    expect(clampGameplayZoom(4)).toBe(4);
    expect(clampGameplayZoom(1.25)).toBe(1.25);
  });

  it("scales the fitted camera around its existing world center", () => {
    const camera = { center: { x: 340, y: 210 }, scale: 0.7 };
    const before = structuredClone(camera);
    expect(zoomCamera(camera, 1.4)).toEqual({
      center: camera.center,
      scale: 0.7 * 1.4,
    });
    expect(camera).toEqual(before);
    expect(zoomCamera(camera, 0.8).center).toEqual(camera.center);
  });
});

describe("pinch gesture ownership", () => {
  it("leaves a single pointer to the pull control, then scales from the initial pinch distance", () => {
    const pinch = new PinchZoom();
    expect(pinch.down(1, { x: 100, y: 100 }, 1)).toBe(false);
    expect(pinch.move(1, { x: 110, y: 100 })).toEqual({ consumed: false });
    expect(pinch.down(2, { x: 210, y: 100 }, 1)).toBe(true);
    expect(pinch.move(2, { x: 260, y: 100 })).toEqual({
      consumed: true,
      zoom: 1.5,
    });
    expect(pinch.move(2, { x: 510, y: 100 }).zoom).toBe(4);
    expect(pinch.move(2, { x: 120, y: 100 }).zoom).toBe(0.25);
  });

  it("keeps the first pinch pair stable when a third finger arrives", () => {
    const pinch = new PinchZoom();
    pinch.down(1, { x: 100, y: 100 }, 1);
    pinch.down(2, { x: 200, y: 100 }, 1);
    expect(pinch.down(3, { x: 500, y: 500 }, 1)).toBe(true);
    expect(pinch.move(3, { x: 900, y: 900 }).consumed).toBe(true);
    expect(pinch.move(2, { x: 250, y: 100 }).zoom).toBe(1.5);
    expect(pinch.up(3)).toBe(true);
    expect(pinch.move(2, { x: 220, y: 100 }).zoom).toBeCloseTo(1.2);
  });

  it("consumes the remaining finger until all fingers lift", () => {
    const pinch = new PinchZoom();
    pinch.down(1, { x: 100, y: 100 }, 1);
    pinch.down(2, { x: 200, y: 100 }, 1);
    expect(pinch.up(2)).toBe(true);
    expect(pinch.pointerIds).toEqual([1]);
    expect(pinch.move(1, { x: 180, y: 100 }).consumed).toBe(true);
    expect(pinch.up(1)).toBe(true);
    expect(pinch.pointerIds).toEqual([]);
    expect(pinch.down(4, { x: 100, y: 100 }, 1)).toBe(false);
    expect(pinch.up(4)).toBe(false);
  });

  it("reset cancels ownership and a new pinch uses the current zoom", () => {
    const pinch = new PinchZoom();
    pinch.down(1, { x: 100, y: 100 }, 1);
    pinch.down(2, { x: 200, y: 100 }, 1);
    pinch.reset();
    expect(pinch.pointerIds).toEqual([]);
    expect(pinch.down(3, { x: 100, y: 100 }, 1.2)).toBe(false);
    expect(pinch.down(4, { x: 200, y: 100 }, 1.2)).toBe(true);
    expect(pinch.move(4, { x: 225, y: 100 }).zoom).toBeCloseTo(1.5);
  });
});

it("uses Gravity's tighter minimum for clamp, camera, and the complete pinch session", () => {
  expect(clampGameplayZoom(0.01, MIN_GRAVITY_ZOOM)).toBe(0.5);
  expect(clampGameplayZoom(100, MIN_GRAVITY_ZOOM)).toBe(4);
  expect(
    zoomCamera({ center: { x: 0, y: 0 }, scale: 2 }, 0.01, MIN_GRAVITY_ZOOM)
      .scale,
  ).toBe(1);
  const pinch = new PinchZoom(MIN_GRAVITY_ZOOM);
  pinch.down(1, { x: 0, y: 0 }, 1);
  pinch.down(2, { x: 100, y: 0 }, 1);
  expect(pinch.move(2, { x: 1, y: 0 }).zoom).toBe(0.5);
  expect(pinch.move(2, { x: 500, y: 0 }).zoom).toBe(4);
});
