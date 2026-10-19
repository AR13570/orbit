import { expect, it } from "vitest";
import { buildGravityLayout, GRAVITY_LAYOUTS } from "../../src/gravity/layouts";
import { createState } from "../../src/gravity/simulation";
import { getGravityLevel } from "../../src/gravity/campaign";
import {
  buildCampaignEndlessLevel,
  CAMPAIGN_ENDLESS_IDS,
} from "../../src/gravity/campaign-endless";
import {
  gravityLaunchPower,
  PARTICLE_GRAVITY_STRENGTH,
} from "../../src/gravity/physics";

it("keeps grouping off and mutual attraction on across the actual campaign and endless profiles", () => {
  const levels = [
    ...Array.from({ length: 45 }, (_, index) => getGravityLevel(42, index)),
    ...CAMPAIGN_ENDLESS_IDS.flatMap((profile) =>
      [45, 85, 125].map((index) =>
        buildCampaignEndlessLevel(42, index, profile),
      ),
    ),
  ];
  for (const level of levels)
    expect(createState(level).physics, level.title).toMatchObject({
      planetGravity: true,
      planetCollisions: "none",
    });
});

it("retains opposite-direction authoring fixtures under rotation and explicit force scaling", () => {
  const layout = GRAVITY_LAYOUTS.find((item) => item.id === "counterflow")!;
  const baseline = buildGravityLayout(layout, {
    index: 4,
    seed: 42,
    title: "Custom directions",
    source: "custom",
  });
  for (const [rotation, strength] of [
    [0, 1],
    [0.371, 0.7],
    [1.413, 1.3],
  ]) {
    const level = buildGravityLayout(layout, {
      index: 4,
      seed: 42,
      title: "Custom directions",
      source: "custom",
      rotation,
      strength,
    });
    expect(level.objective.kind).toBe("counter");
    expect(createState(level).physics).toMatchObject({
      planetCollisions: "soft",
      planetGravityStrength: PARTICLE_GRAVITY_STRENGTH * strength,
    });
    const core = level.bodies[0];
    expect(core.strength).toBeCloseTo(
      baseline.bodies[0].strength * strength,
      8,
    );
    const signs = level.witness.map((shot, index) => {
      const radius = {
        x: shot.position!.x - core.position.x,
        y: shot.position!.y - core.position.y,
      };
      const speed = Math.hypot(shot.velocity!.x, shot.velocity!.y);
      expect(speed).toBeCloseTo(
        Math.hypot(
          baseline.witness[index].velocity!.x,
          baseline.witness[index].velocity!.y,
        ) * Math.sqrt(strength),
        8,
      );
      expect(shot.power).toBeCloseTo(gravityLaunchPower(speed), 12);
      return Math.sign(
        radius.x * shot.velocity!.y - radius.y * shot.velocity!.x,
      );
    });
    expect(new Set(signs)).toEqual(new Set([-1, 1]));
  }
});

it("retains explicit custom populations and masses without asserting old simultaneous witness solvability", () => {
  const shell = GRAVITY_LAYOUTS.find(
    (item) => item.id === "concentric-shells",
  )!;
  const level = buildGravityLayout(shell, {
    index: 0,
    seed: 42,
    title: "Custom shell",
    source: "custom",
    count: 12,
    turns: 2,
  });
  expect(level.requirements).toEqual([
    { bodyId: "well-1", count: 12, turns: 2 },
  ]);
  expect(level.witness).toHaveLength(12);
  expect(createState(level).physics.planetCollisions).toBe("soft");
  for (const [id, mass] of [
    ["elastic-pair", 2],
    ["merging-swarm", 3],
  ] as const) {
    const layout = GRAVITY_LAYOUTS.find((item) => item.id === id)!;
    const custom = buildGravityLayout(layout, {
      index: 0,
      seed: 42,
      title: id,
      source: "custom",
      strength: 1.3,
    });
    expect(createState(custom).physics).toMatchObject({
      planetGravity: true,
      planetCollisions: "soft",
      planetMass: mass,
      planetGravityStrength: PARTICLE_GRAVITY_STRENGTH * 1.3,
    });
  }
});
