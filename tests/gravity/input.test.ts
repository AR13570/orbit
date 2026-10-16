import { expect, it } from "vitest";
import {
  gravityAim,
  gravityLaunchIsClear,
  gravityPullDistance,
} from "../../src/gravity/input";
import { GravityEngine } from "../../src/gravity/engine";
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

it("requires physical clearance for the selected size and honors disabled core collisions", () => {
  const engine = new GravityEngine(42, getGravityLevel(42, 0));
  const initial = engine.getRenderSnapshot();
  const core = initial.level.bodies[0];
  const nearCore = {
    x: core.position.x + core.radius + initial.physics.planetRadius + 0.001,
    y: core.position.y,
  };
  expect(gravityLaunchIsClear(nearCore, initial)).toBe(true);
  engine.setProjectileSize(2);
  const doubled = engine.getRenderSnapshot();
  expect(gravityLaunchIsClear(nearCore, doubled)).toBe(false);
  const boundary = {
    x: core.position.x + core.radius + doubled.physics.planetRadius,
    y: core.position.y,
  };
  expect(gravityLaunchIsClear(boundary, doubled)).toBe(false);
  expect(
    gravityLaunchIsClear({ ...boundary, x: boundary.x + 0.001 }, doubled),
  ).toBe(true);
  engine.setPhysics({ bodyCollisions: false });
  expect(
    gravityLaunchIsClear(core.position, engine.getRenderSnapshot()),
  ).toBe(true);
});
