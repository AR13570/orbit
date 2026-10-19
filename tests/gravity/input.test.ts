import { expect, it } from "vitest";
import {
  gravityAim,
  gravityLaunchIsClear,
  gravityPullDistance,
  gravityPullFraction,
} from "../../src/gravity/input";
import { GravityEngine } from "../../src/gravity/engine";
import { getGravityLevel } from "../../src/gravity/campaign";

it("preserves precise short pulls and smoothly approaches a safe ceiling for long pulls", () => {
  for (const fraction of [0, 0.1, 0.25, 0.5, 0.8])
    expect(gravityAim({ power: fraction }).power).toBeCloseTo(
      fraction ** 2,
      12,
    );
  const powers = [0.8, 1, 1.2, 1.4, 1.6, 2, 4].map(
    (power) => gravityAim({ power }).power,
  );
  for (let i = 1; i < powers.length; i++) {
    expect(powers[i]).toBeGreaterThan(powers[i - 1]);
    expect(powers[i]).toBeLessThanOrEqual(1);
  }
  expect(powers[1]).toBeLessThan(1);
  expect(powers[2] - powers[1]).toBeGreaterThan(powers[3] - powers[2]);
  const epsilon = 1e-5;
  const before =
    (gravityAim({ power: 0.8 }).power -
      gravityAim({ power: 0.8 - epsilon }).power) /
    epsilon;
  const after =
    (gravityAim({ power: 0.8 + epsilon }).power -
      gravityAim({ power: 0.8 }).power) /
    epsilon;
  expect(after).toBeCloseTo(before, 3);
});

it("keeps all campaign witness powers reachable by a deliberate drag above the tap deadzone", () => {
  for (let index = 0; index < 45; index++) {
    const level = getGravityLevel(42, index);
    for (const shot of level.witness) {
      for (const limit of [153, 81.6]) {
        const distance = limit * gravityPullFraction(shot.power);
        expect(distance).toBeGreaterThanOrEqual(8);
        expect(distance).toBeLessThanOrEqual(limit * 1.2);
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
  expect(gravityPullDistance("mouse", 1280, 800)).toBe(153);
  expect(gravityPullDistance("touch", 1280, 800)).toBe(81.6);
  expect(gravityPullDistance("mouse", 390, 844)).toBe(81.6);
  expect(gravityPullDistance("touch", 844, 390)).toBe(81.6);
});
it("shortens zoomed-out pulls gently and bounds the adjustment at extreme zoom", () => {
  for (const [pointer, width, height, base] of [
    ["mouse", 1280, 800, 153],
    ["touch", 390, 844, 81.6],
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
  expect(gravityLaunchIsClear(core.position, engine.getRenderSnapshot())).toBe(
    true,
  );
});
