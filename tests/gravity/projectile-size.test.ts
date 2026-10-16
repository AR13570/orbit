import { describe, expect, it } from "vitest";
import { GravityEngine } from "../../src/gravity/engine";
import { newDraft, toGravityLevel } from "../../src/gravity/creator/model";
import { planetAccelerations } from "../../src/gravity/physics";
import { buildGravityLayout, GRAVITY_LAYOUTS } from "../../src/gravity/layouts";
import { createState, fireFrom } from "../../src/gravity/simulation";
import {
  normalizeProjectileSize,
  projectileProfile,
} from "../../src/gravity/projectile-size";

function level(radius = 4, mass = 1) {
  const draft = newDraft();
  draft.bodies = [];
  draft.physics = {
    planetRadius: radius,
    planetMass: mass,
    planetGravity: true,
    bodyCollisions: false,
  };
  return toGravityLevel(draft);
}

describe("Gravity projectile size", () => {
  it("launches readable physical defaults without increasing their baseline mass", () => {
    const draft = newDraft();
    draft.bodies = [];
    const creator = new GravityEngine(42, toGravityLevel(draft));
    creator.launchFrom({ x: 100, y: 100 }, { x: 0, y: 0 });
    creator.setProjectileSize(2);
    creator.launchFrom({ x: 200, y: 100 }, { x: 0, y: 0 });
    expect(
      creator
        .getSnapshot()
        .particles.map(({ radius, mass }) => ({ radius, mass })),
    ).toEqual([
      { radius: 8, mass: 1 },
      { radius: 16, mass: 4 },
    ]);
    const regular = new GravityEngine(
      42,
      buildGravityLayout(GRAVITY_LAYOUTS[0], {
        index: 0,
        seed: 42,
        title: "Readable default",
        source: "campaign",
      }),
    );
    regular.launchFrom({ x: 100, y: 100 }, { x: 0, y: 0 });
    regular.setProjectileSize(2);
    regular.launchFrom({ x: 200, y: 100 }, { x: 0, y: 0 });
    expect(
      regular
        .getSnapshot()
        .particles.map(({ radius, mass }) => ({ radius, mass })),
    ).toEqual([
      { radius: 6, mass: 1 },
      { radius: 12, mass: 4 },
    ]);
  });

  it("launches distinct body colors with strong contrast against the field", () => {
    const state = createState(level());
    for (let n = 0; n < 12; n++)
      fireFrom(state, { x: 100 + n * 30, y: 100 }, { x: 0, y: 0 });
    const luminance = (hex: string) => {
      const channels = hex.match(/[a-f0-9]{2}/gi)!.map((channel) => {
        const value = parseInt(channel, 16) / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const ground = luminance("#e9ecef");
    expect(new Set(state.particles.map((planet) => planet.color)).size).toBe(
      12,
    );
    for (const planet of state.particles)
      expect(
        (ground + 0.05) / (luminance(planet.color) + 0.05),
      ).toBeGreaterThanOrEqual(3);
  });

  it("derives bounded profiles around custom authored mass and radius", () => {
    expect(projectileProfile(6, 3, 0.5)).toEqual({ radius: 6, mass: 3 });
    expect(projectileProfile(6, 3, 1)).toEqual({ radius: 6, mass: 3 });
    expect(projectileProfile(6, 3, 2)).toEqual({ radius: 12, mass: 12 });
    expect(projectileProfile(6, 3, 100)).toEqual({ radius: 12, mass: 12 });
    expect(projectileProfile(6, 3, NaN)).toEqual({ radius: 6, mass: 3 });
    expect(normalizeProjectileSize(-1)).toBe(1);
    expect(normalizeProjectileSize(1.35)).toBe(1.35);
    expect(normalizeProjectileSize(Infinity)).toBe(1);
  });
  it("captures the state size for direct simulation launches and defaults standalone worlds to one", () => {
    const state = createState(level());
    fireFrom(state, { x: 100, y: 100 }, { x: 0, y: 0 });
    state.projectileSize = 2;
    fireFrom(state, { x: 300, y: 100 }, { x: 0, y: 0 });
    state.projectileSize = 1;
    expect(state.particles.map((particle) => particle.projectileSize)).toEqual([
      1, 2,
    ]);
  });
  it("scales only new launches and leaves authored physics unchanged", () => {
    const authored = level(6, 3);
    const engine = new GravityEngine(42, authored);
    engine.launchFrom({ x: 100, y: 100 }, { x: 0, y: 0 });
    engine.setProjectileSize(2);
    engine.launchFrom({ x: 300, y: 100 }, { x: 0, y: 0 });
    engine.setProjectileSize(2);
    const snapshot = engine.getSnapshot();
    expect(engine.getProjectileSize()).toBe(2);
    expect(snapshot.physics).toMatchObject({
      planetRadius: 12,
      planetMass: 12,
    });
    expect(
      snapshot.particles.map(({ radius, mass }) => ({ radius, mass })),
    ).toEqual([
      { radius: 6, mass: 3 },
      { radius: 12, mass: 12 },
    ]);
    expect(snapshot.level.physics).toEqual(authored.physics);
    expect(authored.physics).toMatchObject({ planetRadius: 6, planetMass: 3 });
  });

  it("bounds invalid selections before they reach a launch", () => {
    const engine = new GravityEngine(42, level());
    for (const [input, radius, mass] of [
      [-100, 4, 1],
      [0.5, 4, 1],
      [100, 8, 4],
      [NaN, 4, 1],
      [Infinity, 4, 1],
      [1.3, 5.2, 1.69],
    ]) {
      engine.setProjectileSize(input);
      expect(engine.getSnapshot().physics.planetRadius).toBeCloseTo(radius);
      expect(engine.getSnapshot().physics.planetMass).toBeCloseTo(mass);
      engine.launchFrom({ x: 100, y: 100 }, { x: 0, y: 0 });
      const planet = engine.getSnapshot().particles.at(-1)!;
      expect(planet.radius).toBeCloseTo(radius);
      expect(planet.mass).toBeCloseTo(mass);
    }
  });

  it("reapplies the selected factor to each level baseline and to physics edits", () => {
    const provider = (_seed: number, index: number) => ({
      ...level(4 + index, 1 + index),
      index,
    });
    const engine = new GravityEngine(42, undefined, provider);
    engine.setProjectileSize(2);
    engine.retry();
    expect(engine.getSnapshot().physics).toMatchObject({
      planetRadius: 8,
      planetMass: 4,
    });
    engine.skip();
    expect(engine.getSnapshot().physics).toMatchObject({
      planetRadius: 10,
      planetMass: 8,
    });
    engine.goTo(3);
    expect(engine.getSnapshot().physics).toMatchObject({
      planetRadius: 14,
      planetMass: 16,
    });
    engine.setPhysics({ trailSeconds: 8 });
    expect(engine.getSnapshot().physics).toMatchObject({
      planetRadius: 14,
      planetMass: 16,
    });
    engine.setPhysics({ planetRadius: 6, planetMass: 3 });
    engine.retry();
    expect(engine.getProjectileSize()).toBe(2);
    expect(engine.getSnapshot().physics).toMatchObject({
      planetRadius: 12,
      planetMass: 12,
      trailSeconds: 8,
    });
    expect(engine.getSnapshot().level.physics).toMatchObject({
      planetRadius: 6,
      planetMass: 3,
    });
    engine.setProjectileSize(1);
    expect(engine.getSnapshot().physics).toMatchObject({
      planetRadius: 6,
      planetMass: 3,
    });
  });

  it("makes larger planets attract more strongly while retaining equal opposite forces", () => {
    const engine = new GravityEngine(42, level());
    engine.launchFrom({ x: 100, y: 100 }, { x: 0, y: 0 });
    engine.setProjectileSize(2);
    engine.launchFrom({ x: 300, y: 100 }, { x: 0, y: 0 });
    const state = engine.getSnapshot();
    const accelerations = planetAccelerations(
      state.particles,
      [],
      state.physics,
    );
    expect(accelerations[0].x).toBeGreaterThan(0);
    expect(accelerations[0].x).toBeCloseTo(-accelerations[1].x * 4, 12);
    expect(
      accelerations[0].x * state.particles[0].mass +
        accelerations[1].x * state.particles[1].mass,
    ).toBeCloseTo(0, 12);
    engine.setParticleInteraction(false);
    expect(
      planetAccelerations(state.particles, [], engine.getSnapshot().physics),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
  });
});
