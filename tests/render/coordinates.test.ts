import { describe, expect, it } from "vitest";
import {
  clientToWorld,
  fitCamera,
  fitFieldCamera,
  interpolateCamera,
  worldToClient,
  visibleWorldBounds,
  visiblePullPoint,
} from "../../src/render/coordinates";

const bounds = { x: 3400, y: -240, width: 1800, height: 1000 };
describe("global field camera", () => {
  it.each([
    [320, 568],
    [390, 844],
  ])(
    "keeps a full-power backward ghost inside %ipx portrait",
    (width, height) => {
      const anchor = Object.freeze({ x: 3520, y: 260 });
      const camera = fitFieldCamera(bounds, anchor, width, height);
      const pull = Object.freeze({
        x: anchor.x - 120 / camera.scale,
        y: anchor.y,
      });
      const ghost = visiblePullPoint(anchor, pull, camera, width, height);
      const screen = worldToClient(
        ghost,
        { left: 0, top: 0, width, height },
        camera,
      );
      expect(screen.x).toBeCloseTo(14, 9);
      expect(screen.y).toBeCloseTo(height / 2, 9);
      expect(Math.atan2(ghost.y - anchor.y, ghost.x - anchor.x)).toBe(
        Math.atan2(pull.y - anchor.y, pull.x - anchor.x),
      );
      expect(pull.x).toBe(anchor.x - 120 / camera.scale);
    },
  );
  it.each([
    [1440, 900],
    [320, 568],
    [390, 844],
    [844, 390],
  ])(
    "uses screen edges rather than generation bounds at %ix%i",
    (width, height) => {
      const camera = fitFieldCamera(bounds, { x: 3520, y: 260 }, width, height);
      const visible = visibleWorldBounds(camera, width, height);
      const rect = { left: 17, top: 29, width, height };
      expect(clientToWorld(17, 29, rect, camera)).toEqual({
        x: visible.x,
        y: visible.y,
      });
      const bottomRight = clientToWorld(17 + width, 29 + height, rect, camera);
      expect(bottomRight.x).toBeCloseTo(visible.x + visible.width, 9);
      expect(bottomRight.y).toBeCloseTo(visible.y + visible.height, 9);
      expect(visible).not.toEqual(bounds);
    },
  );
  it("frames portrait closely, follows rightward, and clamps to the field", () => {
    const initial = fitFieldCamera(bounds, { x: 3520, y: 260 }, 390, 844);
    expect(initial.scale).toBeCloseTo(390 / 900, 9);
    expect(initial.center.x).toBe(3850);
    const following = fitFieldCamera(
      bounds,
      { x: 3520, y: 260 },
      390,
      844,
      4500,
    );
    expect(following.center.x).toBe(4660);
    expect(
      fitFieldCamera(bounds, { x: 3520, y: 260 }, 390, 844, 6000).center.x,
    ).toBe(4750);
    expect(fitFieldCamera(bounds, { x: 3520, y: 260 }, 844, 390, 4500)).toEqual(
      fitCamera(bounds, 844, 390),
    );
  });
  it.each([
    [1440, 900],
    [390, 844],
    [320, 568],
    [844, 390],
  ])("fits offset bounds uniformly at %ix%i", (width, height) => {
    const camera = fitCamera(bounds, width, height);
    const rect = { left: 17, top: 29, width, height };
    const start = worldToClient({ x: bounds.x, y: bounds.y }, rect, camera);
    const end = worldToClient(
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      rect,
      camera,
    );
    expect(start.x).toBeGreaterThan(rect.left);
    expect(start.y).toBeGreaterThan(rect.top);
    expect(end.x).toBeLessThan(rect.left + width);
    expect(end.y).toBeLessThan(rect.top + height);
    expect((end.x - start.x) / bounds.width).toBeCloseTo(
      (end.y - start.y) / bounds.height,
      10,
    );
    for (const point of [
      { x: 3400, y: -240 },
      { x: 4300, y: 260 },
      { x: 5200, y: 760 },
      { x: 3902, y: 381 },
    ]) {
      const screen = worldToClient(point, rect, camera);
      const mapped = clientToWorld(screen.x, screen.y, rect, camera);
      expect(mapped.x).toBeCloseTo(point.x, 9);
      expect(mapped.y).toBeCloseTo(point.y, 9);
    }
  });
  it("keeps camera transitions monotonic and exact at the endpoints", () => {
    const from = fitCamera(bounds, 1440, 900);
    const to = fitCamera({ ...bounds, x: 5000 }, 1440, 900);
    expect(interpolateCamera(from, to, 0)).toEqual(from);
    expect(interpolateCamera(from, to, 1)).toEqual(to);
    let previous = from.center.x;
    for (let step = 1; step <= 10; step++) {
      const camera = interpolateCamera(from, to, step / 10);
      expect(camera.center.x).toBeGreaterThanOrEqual(previous);
      expect(camera.center.x).toBeLessThanOrEqual(to.center.x);
      expect(camera.scale).toBe(from.scale);
      previous = camera.center.x;
    }
  });
  it("rejects empty display bounds without making a usable aim point", () => {
    expect(
      clientToWorld(
        2,
        4,
        { left: 0, top: 0, width: 0, height: 0 },
        { center: { x: 0, y: 0 }, scale: 0 },
      ),
    ).toEqual({ x: NaN, y: NaN });
  });
});
