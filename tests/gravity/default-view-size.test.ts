import { expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { getGravityLevel } from "../../src/gravity/campaign";
import { fitGravityFrame } from "../../src/gravity/renderer";
import type { GravityLevel } from "../../src/gravity/types";

const provider = (_seed: number, index: number): GravityLevel => ({
  index,
  seed: 42,
  family: "none",
  bounds: { x: 0, y: 0, width: 900, height: 900 },
  launch: { x: 450, y: 450 },
  bodies: [],
  objective: { kind: "none", count: 1, turns: 1, hold: 0 },
  physics: {
    planetRadius: 6 + index,
    planetMass: 2 + index,
    bodyCollisions: false,
  },
  witness: [],
});

it("captures the default-view radius for new launches without changing authored mass or flying planets", () => {
  const engine = new GravityEngine(42, undefined, provider);
  engine.setDefaultViewScale(1.5);
  engine.launchFrom({ x: 100, y: 100 }, { x: 0, y: 0 });
  engine.setProjectileSize(2);
  engine.launchFrom({ x: 200, y: 100 }, { x: 0, y: 0 });
  expect(
    engine
      .getSnapshot()
      .particles.map(({ radius, mass }) => ({ radius, mass })),
  ).toEqual([
    { radius: 4, mass: 2 },
    { radius: 8, mass: 8 },
  ]);
  engine.setDefaultViewScale(0.5);
  engine.setDefaultViewScale(0.5);
  engine.setDefaultViewScale(NaN);
  engine.setDefaultViewScale(0);
  engine.setDefaultViewScale(Infinity);
  engine.launchFrom({ x: 300, y: 100 }, { x: 0, y: 0 });
  expect(
    engine
      .getSnapshot()
      .particles.map(({ radius, mass }) => ({ radius, mass })),
  ).toEqual([
    { radius: 4, mass: 2 },
    { radius: 8, mass: 8 },
    { radius: 24, mass: 8 },
  ]);
  expect(engine.getSnapshot().level.physics).toMatchObject({
    planetRadius: 6,
    planetMass: 2,
  });
  engine.retry();
  expect(engine.getSnapshot().physics).toMatchObject({
    planetRadius: 24,
    planetMass: 8,
  });
  engine.goTo(1);
  engine.setDefaultViewScale(0.25);
  expect(engine.getSnapshot().physics).toMatchObject({
    planetRadius: 32,
    planetMass: 12,
  });
  expect(engine.getSnapshot().level.physics).toMatchObject({
    planetRadius: 7,
    planetMass: 3,
  });
});

it("keeps custom authoring and tutorial physics independent of responsive calibration", () => {
  const custom = new GravityEngine(42, provider(42, 0));
  custom.setDefaultViewScale(0.25);
  custom.setProjectileSize(2);
  custom.launchFrom({ x: 100, y: 100 }, { x: 0, y: 0 });
  expect(custom.getSnapshot().particles[0]).toMatchObject({
    radius: 12,
    mass: 8,
  });
});

it.each([
  [1200, 800, 0, 4],
  [390, 844, 0, 4.392],
  [844, 390, 0, 4.0754716981132075],
  [1200, 800, 30, 6.526411502028423],
  [390, 844, 30, 9.652173913043478],
  [844, 390, 30, 9.765653874522794],
])(
  "calibrates the actual %ix%i default view for campaign index %i",
  (width, height, index, radius) => {
    const engine = new GravityEngine(42, undefined, getGravityLevel);
    engine.goTo(index);
    const authored = engine.getSnapshot().level.physics;
    const { camera } = fitGravityFrame(
      engine.getSnapshot().level,
      width,
      height,
    );
    engine.setDefaultViewScale(camera.scale);
    engine.launchFrom({ x: 100, y: 100 }, { x: 0, y: 0 });
    expect(engine.getSnapshot().particles[0].radius).toBeCloseTo(radius, 8);
    expect(engine.getSnapshot().particles[0].mass).toBe(
      authored?.planetMass ?? 1,
    );
    expect(engine.getSnapshot().level.physics).toEqual(authored);
  },
);

it("predicts the calibrated launch with the same physical radius and mass as play", () => {
  const engine = new GravityEngine(42, undefined, provider);
  engine.setTimeScale(1);
  engine.setDefaultViewScale(0.5);
  engine.setProjectileSize(2);
  engine.launchFrom({ x: 400, y: 450 }, { x: 0, y: 0 });
  const before = engine.getSnapshot();
  const path = engine.predictFrom({ x: 460, y: 450 }, { x: -20, y: 0 }, 1);
  expect(engine.getSnapshot()).toEqual(before);
  engine.launchFrom({ x: 460, y: 450 }, { x: -20, y: 0 });
  for (let n = 0; n < 120; n++) engine.update(1 / 120);
  const actual = engine.getSnapshot().particles[1];
  expect(actual.radius).toBe(24);
  expect(actual.mass).toBe(8);
  expect(actual.position.x).toBeCloseTo(path.at(-1)!.x, 9);
  expect(actual.position.y).toBeCloseTo(path.at(-1)!.y, 9);
});
