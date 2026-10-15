import { expect, it } from "vitest";
import { gravityAim, gravityPullDistance } from "../../src/gravity/input";
import { getGravityLevel } from "../../src/gravity/campaign";

it("keeps all campaign witness powers reachable by a deliberate drag above the tap deadzone", () => {
  for (let index = 0; index < 45; index++) {
    const level = getGravityLevel(42, index);
    for (const shot of level.witness) {
      for (const limit of [90, 48]) {
        const distance = limit * Math.sqrt(shot.power);
        expect(distance).toBeGreaterThanOrEqual(8);
        expect(distance).toBeLessThanOrEqual(limit);
        const mapped = gravityAim({
          angle: shot.angle,
          power: distance / limit,
        });
        expect(mapped.power).toBeCloseTo(shot.power, 12);
        expect(mapped.angle).toBe(shot.angle);
      }
    }
  }
});
it("uses reachable Gravity-only full-pull limits for mouse and touch layouts", () => {
  expect(gravityPullDistance("mouse", 1280, 800)).toBe(90);
  expect(gravityPullDistance("touch", 1280, 800)).toBe(48);
  expect(gravityPullDistance("mouse", 390, 844)).toBe(48);
  expect(gravityPullDistance("touch", 844, 390)).toBe(48);
});
it("shortens zoomed-out pulls gently and bounds the adjustment at extreme zoom", () => {
  for (const [pointer, width, height, base] of [
    ["mouse", 1280, 800, 90],
    ["touch", 390, 844, 48],
  ] as const) {
    const reduced = gravityPullDistance(pointer, width, height, 0.45);
    expect(reduced).toBeCloseTo(base * Math.sqrt(0.45), 10);
    expect(reduced).toBeGreaterThan(base * 0.45);
    expect(gravityPullDistance(pointer, width, height, 0.25)).toBeCloseTo(
      base * 0.65,
      10,
    );
    expect(gravityPullDistance(pointer, width, height, 3)).toBeCloseTo(
      base * 1.3,
      10,
    );
  }
});
